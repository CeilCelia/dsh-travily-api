/**
 * Browser-half harness: execute `lib/client.js` the way the dsh Web kernel does
 * (a `window.__ModuleLoader__` registration whose factory is materialized with
 * only the platform seed modules), mount its plugin on a real Cordis context
 * with stub client services, and render the card for both slot views.
 *
 * This reproduces what the Settings → Plugins page does, so a registration or
 * render fault shows up here instead of only inside the running GUI.
 *
 * Usage: node .tools/client-harness.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { Context } from '@deepseek-ai/cordis'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const require = createRequire(join(repo, 'node_modules', 'noop.js'))
const react = require('react')
const ReactDOMServer = require('react-dom/server')

// ── 1. execute the bundle exactly as the kernel does ────────────────────────
const source = readFileSync(join(repo, 'lib/client.js'), 'utf8')
const registrations = []
const probeCalls = []
const seed = { react, 'react/jsx-runtime': require('react/jsx-runtime') }

const documentStub = {
  querySelector: () => null,
  createElement: () => ({ setAttribute() {}, remove() {}, dataset: {}, textContent: '' }),
  head: { appendChild() {} },
}
const sandbox = {
  window: { __ModuleLoader__: { load: (registration) => registrations.push(registration) } },
  document: documentStub,
  console,
  setTimeout,
  clearTimeout,
  // The card's connection test posts to the host route through this fetch.
  fetch: (url, init) => {
    probeCalls.push({ url, init })
    return Promise.resolve({
      status: 200,
      json: async () => ({ ok: true, mode: 'keyless' }),
    })
  },
  DOMException,
  URL,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'client.js' })

assert.equal(registrations.length, 1, 'the bundle registers exactly one module')
const [registration] = registrations
assert.equal(registration.id, 'dsh-travily-api', 'the registration id is the package name')

const client = registration.factory((specifier) => {
  if (specifier in seed) return seed[specifier]
  throw new Error(`client bundle requested an unseeded module: ${specifier}`)
})
assert.equal(typeof client.apply, 'function', 'the bundle exports apply()')
assert.deepEqual(
  [...client.inject].sort(),
  ['configForms', 'locale', 'remote', 'remote.credentials', 'slots'],
  'declared client services',
)

// ── 2. stub client services, faithful to the shipped contracts ──────────────
const calls = []
const dictionaries = new Map()
const strings = new Map()
const scopeListeners = new Set()
const formValue = { enabled: false, apiKeyEnv: 'TAVILY_API_KEY', baseURL: 'https://api.tavily.com' }

const scope = {
  getSnapshot: () => ({
    status: 'ready',
    writable: true,
    value: formValue,
    base: formValue,
    user: {},
    revision: 0,
  }),
  subscribe: (listener) => {
    scopeListeners.add(listener)
    return () => scopeListeners.delete(listener)
  },
  set: async (field, value) => {
    formValue[field] = value
    for (const listener of scopeListeners) listener()
    return true
  },
  unset: async (field) => {
    Reflect.deleteProperty(formValue, field)
    for (const listener of scopeListeners) listener()
    return true
  },
  mutate: async () => true,
}

const credentialsApi = {
  describe: async () => ({ ok: true, value: { TAVILY_API_KEY: { configured: false, writable: true } } }),
  set: async () => ({ ok: true, value: {} }),
  unset: async () => ({ ok: true, value: {} }),
}
const remoteApi = { credentials: credentialsApi, $on: () => () => {} }

const root = new Context()
// The GUI reaches these through the remotes plugin's mount, which publishes the
// namespace as its own injectable service beside the `remote` parent.
root.provide('remote', remoteApi)
root.provide('remote.credentials', credentialsApi)
root.provide('slots', {
  inject: (name, register) => {
    calls.push({ kind: 'inject', name })
    // slots.inject runs the registration immediately when the slot exists.
    return register()
  },
  register: (options, component) => {
    calls.push({ kind: 'register', options, component })
    return () => {}
  },
})
root.provide('locale', {
  bind: (ns) => (key) => strings.get(`${ns}:${key}`) ?? key,
  register(ns, dicts) {
    dictionaries.set(ns, dicts)
    for (const [locale, entries] of Object.entries(dicts)) {
      for (const [key, value] of Object.entries(entries)) strings.set(`${ns}:${key}`, value)
    }
    return () => {}
  },
})
root.provide('configForms', {
  get: (entryId) => {
    assert.equal(entryId, 'web-search-tavily', 'the card asks for its own entry id')
    return scope
  },
  whileServed: (namespaces, register) => {
    assert.deepEqual([...namespaces], ['web-search-tavily'], 'the card follows its own namespace')
    return register(new Set(namespaces))
  },
})

const fiber = root.plugin({ name: 'client-half', inject: client.inject, apply: client.apply })
await fiber
assert.equal(fiber.state, 2, 'the client plugin mounted (2 = active)')

// ── 3. the card must have reached the Plugins page's item slot ──────────────
assert.ok(dictionaries.has('settings.web-search-tavily'), 'the card registers its dictionaries')
const pluginItem = calls.find((call) => call.kind === 'register' && call.options.name === 'plugins.item')
assert.ok(pluginItem, 'a plugins.item registration reached the slot registry')

const { options, component } = pluginItem
assert.equal(options.id, 'tavily', 'list slots require an id')
assert.equal(options.key, 'web-search-tavily', 'the configuration-ledger key is the host entry id')
assert.equal(typeof options.label, 'function', 'list slots require a label')
assert.equal(options.locale, 'settings.web-search-tavily', 'the card declares its dictionary namespace')
assert.equal(typeof options.inject, 'function', 'the card supplies its business props')

const props = options.inject()
assert.ok(props.hooks?.tavilyCard, 'the injector contributes the tavilyCard hook source')
assert.equal(typeof props.save, 'function', 'the injector contributes save()')
assert.equal(typeof props.probe, 'function', 'the injector contributes probe()')

// ── 4. render both views through the real component ─────────────────────────
const store = props.hooks.tavilyCard
const t = (key) => strings.get(`settings.web-search-tavily:${key}`) ?? key
const baseProps = {
  ...props,
  t,
  useTavilyCard: (selector) => selector(store.getSnapshot()),
  renderSlot: () => null,
}

/** Render the card with its disclosure already open, without a DOM to click. */
function renderExpanded(component, baseProps) {
  const original = react.useState
  react.useState = (initial) => {
    react.useState = original
    return [typeof initial === 'boolean' ? true : initial, () => {}]
  }
  try {
    return ReactDOMServer.renderToStaticMarkup(
      react.createElement(component, { ...baseProps, view: 'page' }),
    )
  } finally {
    react.useState = original
  }
}

const summary = ReactDOMServer.renderToStaticMarkup(
  react.createElement(component, { ...baseProps, view: 'summary' }),
)
assert.ok(summary.includes('Tavily'), 'the summary view explains the card')

const collapsed = ReactDOMServer.renderToStaticMarkup(
  react.createElement(component, { ...baseProps, view: 'page' }),
)
assert.ok(collapsed.includes('tvapi_card'), 'the page view renders the card')
assert.ok(collapsed.includes('tvapi_chevron'), 'the card renders its disclosure chevron')
assert.ok(collapsed.includes('Tavily'), 'the card shows its title in the list row')

const page = renderExpanded(component, baseProps)
assert.ok(page.includes('tvapi_switchInput'), 'the expanded card renders the on/off switch')
assert.ok(page.includes('tvapi_input'), 'the expanded card renders the API key input')
assert.ok(page.includes('tvapi_btn'), 'the expanded card renders its buttons')
assert.ok(page.includes('tvapi_btnPrimary'), 'the card renders its save button')

console.log('summary:', summary)
console.log('page bytes:', String(page.length))

// ── 5. the staged actions must behave ──────────────────────────────────────
// Staging is what the controls call; nothing may reach the Host until save.
props.setEnabled(true)
assert.equal(store.getSnapshot().enabled, true, 'staging the switch updates the snapshot')
assert.equal(store.getSnapshot().dirty, true, 'staging marks the form dirty')
props.setKey('tvly-draft')
assert.equal(store.getSnapshot().draftKey, 'tvly-draft', 'staging the key updates the snapshot')

const saved = await props.save()
assert.equal(saved === undefined || saved === true, true, 'save() resolves')
assert.equal(store.getSnapshot().failed, false, 'save() did not fail')
assert.equal(store.getSnapshot().dirty, false, 'a landed save clears the staged edits')
assert.equal(formValue.enabled, true, 'the switch reached the settings section')

// A staged key alone is enough to test the connection; save() clears the draft.
props.setKey('tvly-draft')
await props.probe()
assert.equal(probeCalls.length, 1, 'the connection test posts once')
assert.equal(probeCalls[0].url, '/api/tavily/probe', 'the test uses the host route')
assert.deepEqual(
  JSON.parse(probeCalls[0].init.body),
  { apiKey: 'tvly-draft' },
  'the test sends the staged key without saving it',
)
assert.equal(store.getSnapshot().probeStatus, 'ok', 'a successful test reports ok')

console.log('client-harness: the card registers, renders, saves and tests')

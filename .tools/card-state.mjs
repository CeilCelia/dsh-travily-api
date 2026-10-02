/**
 * Card-state harness: does the Settings card show the switch as ON when the
 * saved section arrives, even though the page's configuration mirror is still
 * loading when the card first renders?
 *
 * The real `ConfigFormController` hands out `status: "loading"` with no value
 * until its mirror read lands, then republishes with the stored section.
 *
 * Usage: node .tools/card-state.mjs
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

// ── load the bundle the way the kernel does ─────────────────────────────────
const registrations = []
const sandbox = {
  window: { __ModuleLoader__: { load: (registration) => registrations.push(registration) } },
  document: {
    querySelector: () => null,
    createElement: () => ({ setAttribute() {}, remove() {}, dataset: {}, textContent: '' }),
    head: { appendChild() {} },
  },
  console,
  setTimeout,
  clearTimeout,
  fetch: () => Promise.reject(new Error('no network')),
  DOMException,
  URL,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(readFileSync(join(repo, 'lib/client.js'), 'utf8'), sandbox, { filename: 'client.js' })
const client = registrations[0].factory((specifier) => {
  if (specifier === 'react') return react
  if (specifier === 'react/jsx-runtime') return require('react/jsx-runtime')
  throw new Error(`unseeded module: ${specifier}`)
})

// ── a scope that reports "loading" first, then the saved section ────────────
const listeners = new Set()
const saved = { enabled: true, apiKeyEnv: 'TAVILY_API_KEY', baseURL: 'https://api.tavily.com' }
let snapshot = { status: 'loading', writable: true, value: undefined, base: undefined, user: {}, revision: undefined }
const scope = {
  getSnapshot: () => snapshot,
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  // A write lands on the section and republishes it, which is what the real
  // form controller does when the Host accepts the mutation.
  set: async (field, value) => {
    saved[field] = value
    publish({ ...snapshot, status: 'ready', value: { ...saved }, base: { ...saved } })
    return true
  },
  unset: async (field) => {
    Reflect.deleteProperty(saved, field)
    publish({ ...snapshot, status: 'ready', value: { ...saved }, base: { ...saved } })
    return true
  },
  mutate: async () => true,
}
const publish = (next) => {
  snapshot = next
  for (const listener of [...listeners]) listener()
}
/** What the mirror does once its read lands. */
const ready = () =>
  publish({ status: 'ready', writable: true, value: saved, base: saved, user: {}, revision: 0 })

const calls = []
const root = new Context()
root.provide('remote', { credentials: { describe: async () => ({ ok: true, value: {} }) }, $on: () => () => {} })
root.provide('remote.credentials', { describe: async () => ({ ok: true, value: {} }), set: async () => ({ ok: true }), unset: async () => ({ ok: true }) })
root.provide('locale', { bind: () => (key) => key, register: () => () => {} })
root.provide('slots', {
  inject: (name, register) => {
    calls.push({ name })
    return register()
  },
  register: (options, component) => {
    calls.push({ options, component })
    return () => {}
  },
})
root.provide('configForms', { get: () => scope, whileServed: (_ns, register) => register(new Set()) })

const fiber = root.plugin({ name: 'card-state', inject: client.inject, apply: client.apply })
await fiber

const item = calls.find((call) => call.options?.name === 'plugins.bundle.config')
assert.ok(item, 'the card registered on the installed package page')
assert.equal(item.options.key, 'dsh-travily-api', 'it files itself under its package name')
const props = item.options.inject()

// The card is asked for the page before the mirror has answered.
const before = props.hooks.tavilyCard.getSnapshot()
assert.equal(before.enabled, false, 'the loading section renders the switch off')

// Now the saved section arrives, exactly as the real mirror republishes it.
ready()

const after = props.hooks.tavilyCard.getSnapshot()
console.log('after the section arrives: enabled =', after.enabled, ' dirty =', after.dirty)
assert.equal(after.enabled, true, 'the switch follows the stored section once it arrives')
assert.equal(after.dirty, false, 'an untouched card is not dirty')

// Staging still works, and saving clears the staged value.
props.setEnabled(false)
assert.equal(props.hooks.tavilyCard.getSnapshot().enabled, false, 'a staged toggle shows immediately')
assert.equal(props.hooks.tavilyCard.getSnapshot().dirty, true, 'a staged toggle is dirty')
await props.save()
assert.equal(props.hooks.tavilyCard.getSnapshot().enabled, false, 'the save keeps the staged value')
assert.equal(props.hooks.tavilyCard.getSnapshot().dirty, false, 'a landed save is clean again')
assert.equal(saved.enabled, false, 'the staged value reached the section')
console.log('card-state: the switch reflects the stored section and saves staged edits')

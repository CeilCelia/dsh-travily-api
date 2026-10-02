/**
 * Integration check for the host half: mount the real plugin on a real Cordis
 * Context with stub services, then exercise one search with the switch on and
 * one with it off, plus the probe route the Settings card calls.
 *
 * Usage: node .tools/integration.mjs
 */
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { resolveConfig } from '@deepseek-ai/cordis'
import { updateVolatile } from '@deepseek-ai/cosmokit'
import * as plugin from '../lib/index.js'

/** The reference the running plugin observes, captured from its own apply(). */
let liveConfig

const routes = []
const registered = []
let credentialValue

const root = new Context()

// ── stub services the plugin declares ───────────────────────────────────────
// Each registrar returns a plain disposer, which is what `ctx.effect` collects
// on the calling fiber. The harness asserts the registration, not Cordis's own
// teardown ordering.
root.provide('web', {
  searchProviders: new Map(),
  searchProviderId: undefined,
  registerSearchProvider(provider) {
    if (this.searchProviders.has(provider.id)) throw new Error('duplicate provider')
    this.searchProviders.set(provider.id, provider)
    registered.push(provider.id)
    return () => {
      this.searchProviders.delete(provider.id)
      const at = registered.indexOf(provider.id)
      if (at !== -1) registered.splice(at, 1)
    }
  },
})

root.provide('settings', { configured: 0 })
root.provide('credentials', {
  resolve: async () => (credentialValue === undefined ? undefined : { value: credentialValue }),
})
root.provide('launchEnvironment', { get: () => undefined })
root.provide('webServer', {
  register(route) {
    routes.push(route)
    return () => {
      const at = routes.indexOf(route)
      if (at !== -1) routes.splice(at, 1)
    }
  },
})

// The platform provider the switch falls back to while it is off.
const platform = {
  id: plugin.DEEPSEEK_PROVIDER_ID,
  available: () => true,
  async search() {
    return { sources: [{ url: 'https://platform.test/' }], truncated: false }
  },
}
root.web.searchProviders.set(platform.id, platform)

// ── mount ───────────────────────────────────────────────────────────────────
// The real plugin, wrapped only to capture the resolved config reference that
// the running provider reads — the same reference a settings write commits into.
const mountable = {
  name: plugin.name,
  inject: plugin.inject,
  Config: plugin.Config,
  apply(ctx, config) {
    liveConfig = config
    return plugin.apply(ctx, config)
  },
}
const fiber = root.plugin(mountable, { enabled: false })
await fiber
assert.ok(liveConfig, 'apply() received the resolved section')

assert.deepEqual(registered, ['tavily'], 'the tavily provider is registered')
assert.deepEqual(
  routes.map((route) => `${route.kind} ${route.path}`),
  ['exact /api/tavily/probe'],
  'the probe route is mounted',
)

const tavily = root.web.searchProviders.get('tavily')
assert.ok(tavily, 'the registry holds the tavily provider')

// ── switch off delegates to the platform provider ───────────────────────────
assert.deepEqual(await tavily.search({ query: 'q' }), {
  sources: [{ url: 'https://platform.test/' }],
  truncated: false,
})

// ── switch on calls Tavily ──────────────────────────────────────────────────
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  calls.push({ url, init })
  return Response.json({    results: [
      { url: 'https://a.test/', title: 'A', content: 'alpha' },
      { url: 'https://b.test/', content: 'beta', published_date: '2026-02-02' },
    ],
  })
}

try {
  // Flip the switch the way a Settings write does: re-resolve the effective
  // section, then commit the volatile reference's next value in place (the
  // Cordis Loader's `_commitVolatile` path).
  updateVolatile(liveConfig.enabled, resolveConfig(mountable, { enabled: true }).enabled)
  assert.equal(liveConfig.enabled.get(), true, 'the running section observes the switch write')

  const result = await tavily.search({ query: 'hello', maxResults: 2 })
  assert.deepEqual(result, {
    sources: [
      { url: 'https://a.test/', title: 'A', snippet: 'alpha' },
      { url: 'https://b.test/', snippet: 'beta', publishedAt: '2026-02-02' },
    ],
    truncated: false,
  })
  assert.equal(calls.length, 1, 'one Tavily request per search')
  assert.equal(calls[0].url, 'https://api.tavily.com/search')
  assert.equal(calls[0].init.headers['x-tavily-access-mode'], 'keyless')
  assert.equal(JSON.parse(calls[0].init.body).max_results, 2)

  // A stored credential is used when one resolves.
  credentialValue = 'tvly-secret'
  await tavily.search({ query: 'hello', maxResults: 2 })
  assert.equal(calls[1].init.headers.authorization, 'Bearer tvly-secret')

  // ── the switch alone must not require a fallback provider ─────────────────
  // With the switch on, a deployment that registers no other search provider
  // must still search: the fallback is looked up only on a fallen-back search.
  const lonely = new Context()
  lonely.provide('credentials', { resolve: async () => undefined })
  lonely.provide('settings', {})
  lonely.provide('webServer', { register: () => () => {} })
  lonely.provide('web', {
    searchProviders: new Map(),
    searchProviderId: 'tavily',
    registerSearchProvider(provider) {
      this.searchProviders.set(provider.id, provider)
      return () => {}
    },
  })
  const lonelyFiber = lonely.plugin(
    { name: plugin.name, inject: plugin.inject, Config: plugin.Config, apply: plugin.apply },
    { enabled: true },
  )
  await lonelyFiber
  const lonelyTavily = lonely.web.searchProviders.get('tavily')
  const lonelyResult = await lonelyTavily.search({ query: 'hello', maxResults: 1 })
  assert.equal(lonelyResult.sources[0].url, 'https://a.test/', 'the switch alone is enough to search')
  await lonelyFiber.dispose()

  // ── the probe route ───────────────────────────────────────────────────────
  const route = routes[0]
  const callProbe = async (body, method = 'POST') => {
    const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
    const req = {
      method,
      on(event, handler) {
        if (event === 'data') for (const chunk of chunks) handler(chunk)
        if (event === 'end') handler()
      },
    }
    let status
    let payload
    const res = {
      writeHead(code) {
        status = code
      },
      end(text) {
        payload = JSON.parse(text)
      },
    }
    await route.handler(req, res)
    return { status, payload }
  }

  const before = calls.length
  const ok = await callProbe({ apiKey: 'tvly-draft' })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.payload, { ok: true, mode: 'key' })
  assert.equal(calls.length, before + 1, 'the probe performs one Tavily request')
  assert.equal(calls.at(-1).init.headers.authorization, 'Bearer tvly-draft')

  const keyless = await callProbe({ clearKey: true })
  assert.deepEqual(keyless.payload, { ok: true, mode: 'keyless' })

  globalThis.fetch = async () => new Response('nope', { status: 401 })
  const rejected = await callProbe({})
  assert.equal(rejected.status, 200)
  assert.deepEqual(rejected.payload, { ok: false, code: 'invalid_key', status: 401 })

  // A body an operator cannot produce is rejected as a bad request.
  const malformed = await (async () => {
    const req = {
      method: 'POST',
      on(event, handler) {
        if (event === 'data') handler(Buffer.from('{not json'))
        if (event === 'end') handler()
      },
    }
    let status
    let payload
    await route.handler(req, {
      writeHead(code) {
        status = code
      },
      end(text) {
        payload = JSON.parse(text)
      },
    })
    return { status, payload }
  })()
  assert.equal(malformed.status, 400)
  assert.equal(malformed.payload.ok, false)

  const notPost = await callProbe(undefined, 'GET')
  assert.equal(notPost.status, 405)
  assert.equal(notPost.payload.ok, false)

  // ── disposal ─────────────────────────────────────────────────────────────
  // Both registrars run inside `ctx.effect`, which is what makes the real
  // seams release them with the plugin fiber; the harness stops at proving the
  // registrations happened and the disposers were returned.
  await fiber.dispose()
} finally {
  globalThis.fetch = originalFetch
}

console.log('integration: all checks passed')

/**
 * Offline host-half checks: the settings section resolves, the plugin's identity
 * is stable, and the failure classifier agrees with the Settings card.
 *
 * Peer packages (`@deepseek-ai/*`) are resolved through `.tools/node_modules`,
 * which holds junctions into the packages extracted from the installed app.
 *
 * Usage: node .tools/selftest.mjs
 */
import assert from 'node:assert/strict'

const plugin = await import('../lib/index.js')

// ── the settings section ────────────────────────────────────────────────────
const { Config } = plugin
assert.ok(Config, 'Config is exported')

const resolved = Config({})
const field = (name) => resolved[name].get()
assert.equal(field('enabled'), false, 'enabled defaults to false')
assert.equal(field('apiKeyEnv'), 'TAVILY_API_KEY', 'apiKeyEnv defaults to TAVILY_API_KEY')
assert.equal(field('baseURL'), 'https://api.tavily.com', 'baseURL defaults to the public origin')
assert.equal(field('allowCustomBaseURL'), false, 'allowCustomBaseURL defaults to false')
assert.equal(field('maxResults'), 5, 'maxResults defaults to 5')
assert.equal(field('searchDepth'), 'basic', 'searchDepth defaults to basic')
assert.equal(field('searchTimeoutMs'), 30000, 'searchTimeoutMs defaults to 30s')

const overridden = Config({ enabled: true, maxResults: 3, searchDepth: 'advanced' })
assert.equal(overridden.enabled.get(), true, 'enabled is taken from the section')
assert.equal(overridden.maxResults.get(), 3, 'maxResults is taken from the section')
assert.equal(overridden.searchDepth.get(), 'advanced', 'searchDepth is taken from the section')

const volatilePaths = []
const walk = (node, path) => {
  if (node?.meta?.volatile) volatilePaths.push(path.join('.'))
  for (const [key, child] of Object.entries(node?.dict ?? {})) walk(child, [...path, key])
  if (node?.inner) walk(node.inner, [...path, '*'])
}
walk(Config, [])
assert.deepEqual(
  [...volatilePaths].sort(),
  [
    'allowCustomBaseURL',
    'apiKeyEnv',
    'baseURL',
    'enabled',
    'maxResults',
    'searchDepth',
    'searchTimeoutMs',
  ],
  'every field is live-editable (volatile), so the card appears on the Plugins page',
)

// ── the provider ────────────────────────────────────────────────────────────
assert.equal(plugin.name, 'web-search-tavily', 'stable cordis plugin name')
assert.equal(plugin.TAVILY_PROVIDER_ID, 'tavily', 'provider id must stay "tavily"')
assert.equal(plugin.DEEPSEEK_PROVIDER_ID, 'deepseek-official', 'fallback provider id')
assert.equal(plugin.PROBE_PATH, '/api/tavily/probe', 'probe route path')
assert.deepEqual(
  [...plugin.inject].sort(),
  ['credentials', 'settings', 'web', 'webServer'],
  'declared services',
)

const provider = new plugin.TavilySearchProvider(() => ({}))
assert.equal(provider.id, 'tavily', 'the registered provider carries the tavily id')
assert.equal(provider.available(), true, 'Tavily works keyless, so it is always available')

// The switch decides the backend: off delegates to the platform provider, and
// the fallback is resolved only for that path.
let delegated = 0
let fallbackLookups = 0
const onProvider = new plugin.TavilySearchProvider(() => ({
  enabled: true,
  fallbackProvider: () => {
    fallbackLookups += 1
    throw new Error('the fallback must not be resolved while the switch is on')
  },
}))
assert.equal(onProvider.available(), true, 'an enabled Tavily provider is usable')
void onProvider

const offProvider = new plugin.TavilySearchProvider(() => ({
  enabled: false,
  fallbackProvider: () => {
    fallbackLookups += 1
    return {
      async search() {
        delegated += 1
        return { sources: [{ url: 'https://example.test/' }], truncated: false }
      },
    }
  },
}))
const offResult = await offProvider.search({ query: 'x' })
assert.equal(delegated, 1, 'switch off delegates to the platform provider')
assert.equal(fallbackLookups, 1, 'the fallback is resolved once for a fallen-back search')
assert.equal(offResult.sources[0].url, 'https://example.test/')

// ── failure classification (shared with the Settings card) ──────────────────
assert.deepEqual(plugin.classifyProbeError(new Error('Tavily search timed out after 30000ms')), {
  code: 'timeout',
})
assert.deepEqual(plugin.classifyProbeError(new Error('Tavily search aborted')), { code: 'timeout' })
assert.deepEqual(plugin.classifyProbeError(new Error('Tavily API error (HTTP 401)')), {
  code: 'invalid_key',
  status: 401,
})
assert.deepEqual(plugin.classifyProbeError(new Error('Tavily API error (HTTP 429)')), {
  code: 'http',
  status: 429,
})
assert.deepEqual(
  plugin.classifyProbeError(new Error('Tavily request failed: TypeError: fetch failed')),
  { code: 'network' },
)
assert.equal(plugin.classifyProbeError(new Error('something odd')).code, 'other')

// ── one real search against a stub endpoint ─────────────────────────────────
const originalFetch = globalThis.fetch
const calls = []
globalThis.fetch = async (url, init) => {
  calls.push({ url, init })
  return new Response(
    JSON.stringify({
      results: [
        { url: 'https://a.test/', title: 'A', content: 'alpha', published_date: '2026-01-01' },
        { url: '', title: 'dropped' },
        { url: 'https://b.test/', content: 'beta' },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}
try {
  const result = await plugin.searchTavily('hello', {
    apiKey: 'tvly-test',
    baseURL: 'https://api.tavily.com',
    allowCustomBaseURL: false,
    searchDepth: 'basic',
    maxResults: 4,
    searchTimeoutMs: 5000,
  })
  assert.deepEqual(result, {
    sources: [
      { url: 'https://a.test/', title: 'A', snippet: 'alpha', publishedAt: '2026-01-01' },
      { url: 'https://b.test/', snippet: 'beta' },
    ],
    truncated: false,
  })
  const [{ url, init }] = calls
  assert.equal(url, 'https://api.tavily.com/search')
  assert.equal(init.headers.authorization, 'Bearer tvly-test')
  assert.equal(JSON.parse(init.body).max_results, 4)
  assert.equal(JSON.parse(init.body).query, 'hello')
  assert.equal(init.redirect, 'error')

  calls.length = 0
  await plugin.searchTavily('hello', {
    baseURL: 'https://api.tavily.com',
    allowCustomBaseURL: false,
    searchDepth: 'basic',
    maxResults: 1,
    searchTimeoutMs: 5000,
  })
  assert.equal(calls[0].init.headers.authorization, undefined, 'no key means keyless')
  assert.equal(calls[0].init.headers['x-tavily-access-mode'], 'keyless')

  await assert.rejects(
    plugin.searchTavily('hello', {
      baseURL: 'https://evil.test',
      allowCustomBaseURL: false,
      searchDepth: 'basic',
      maxResults: 1,
      searchTimeoutMs: 5000,
    }),
    /baseURL must be/u,
    'an unapproved origin is refused before any request',
  )
} finally {
  globalThis.fetch = originalFetch
}

console.log('host half: all checks passed')

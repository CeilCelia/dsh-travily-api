/**
 * Live check of the enabled switch: read the running profile's saved section,
 * resolve the stored Tavily credential through the real credentials provider,
 * and run one real search through the plugin's provider with a context whose
 * `web` seam selects `tavily` — exactly what `web_search` does when the switch
 * is on.
 *
 * The profile comes from `$DSH_PROFILE` (default `desktop`) under `$DSH_HOME`.
 *
 * Usage: node .tools/live-search.mjs [query] [--profile <name>]
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { resolveConfig } from '@deepseek-ai/cordis'
import { load } from 'js-yaml'
import { dshHome, defaultProfile, options, profileDir } from './env.mjs'
import * as plugin from '../lib/index.js'

const argv = process.argv.slice(2)
const flags = options(argv.filter((token) => token.startsWith('--')))
const query = argv.find((token) => !token.startsWith('--')) ?? 'deepseek harness'
const home = dshHome()
const profile = defaultProfile(flags.profile)
const directory = profileDir(home, profile)

// ── the section the running app saved ───────────────────────────────────────
const patch = load(readFileSync(join(directory, 'cordis.patch.yml'), 'utf8'))
const row = patch.find((entry) => entry.id === 'web-search-tavily')
assert.ok(row, 'the profile carries the plugin row')
const section = resolveConfig(plugin, row.config ?? {})
assert.equal(section.enabled.get(), true, 'the switch is on in the saved section')
for (const name of ['enabled', 'apiKeyEnv', 'baseURL', 'maxResults', 'searchDepth']) {
  console.log(` ${name} =`, String(section[name].get()))
}

// ── the stored credential, through the shipped provider ─────────────────────
const { LocalCredentialProvider } = await import('@deepseek-ai/dsh-credentials-local')
const credentials = new LocalCredentialProvider(new Context(), {
  path: join(home, '.credentials.yaml'),
  dshHome: home,
  watch: false,
})
// The provider loads its document in its service-init generator; this harness
// has no fiber to run it, so the read path is primed directly.
await credentials.loadInitial()
const ref = section.apiKeyEnv.get()
const resolved = await credentials.resolve(ref)
assert.ok(resolved?.value, `no stored credential for ${ref}`)
console.log(`${ref}: stored (${String(resolved.value.length)} chars, source ${String(resolved.source)})`)

// ── one real search through the provider ────────────────────────────────────
const root = new Context()
root.provide('credentials', { resolve: async () => resolved })
root.provide('settings', {})
root.provide('launchEnvironment', { get: () => undefined })
root.provide('webServer', { register: () => () => {} })
root.provide('web', {
  searchProviders: new Map(),
  searchProviderId: 'tavily',
  registerSearchProvider(provider) {
    this.searchProviders.set(provider.id, provider)
    return () => this.searchProviders.delete(provider.id)
  },
})
const fiber = root.plugin(
  { name: plugin.name, inject: plugin.inject, Config: plugin.Config, apply: plugin.apply },
  row.config ?? {},
)
await fiber

const provider = root.web.searchProviders.get('tavily')
assert.ok(provider, 'the tavily provider registered')
const result = await provider.search({ query, maxResults: 3 })
assert.ok(Array.isArray(result.sources) && result.sources.length > 0, 'the search returned sources')
console.log(`search("${query}") -> ${String(result.sources.length)} sources`)
for (const source of result.sources) console.log(' -', source.title ?? '(untitled)', source.url)
await fiber.dispose()

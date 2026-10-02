/**
 * Check the display metadata dsh reads for this plugin's package card: the
 * localized title and description the Plugins panel shows for the installed
 * bundle. Runs under the harness binary because the reader needs Node's
 * internal module resolver, which is how the harness resolves plugin
 * subpaths through a package's `exports` map.
 *
 * Usage (from the repo root):
 *   $env:ELECTRON_RUN_AS_NODE=1
 *   & "<install>\DeepSeek Harness.exe" --expose-internals .tools/meta-check.mjs <install> <profile dir>
 */
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const install = process.argv[2]
const profileDir = process.argv[3]
assert.ok(install !== undefined && profileDir !== undefined, 'pass <install> <profile dir>')

const appBoot = await import(
  pathToFileURL(
    join(
      install,
      'resources',
      'app.asar',
      'dsh',
      'node_modules',
      '@deepseek-ai',
      'dsh-app-boot',
      'lib',
      'index.js',
    ),
  ).href
)

// The Loader resolves a row by its module specifier against the profile tree.
const base = pathToFileURL(join(profileDir, 'package.json')).href
const meta = appBoot.readPluginMeta('dsh-travily-api', base)

console.log(JSON.stringify(meta, null, 2))
assert.ok(meta !== undefined, 'the package exposes readable metadata')
assert.equal(meta.title.en, 'Tavily web search', 'English title')
assert.equal(meta.title.zh, 'Tavily 网页搜索', 'Chinese title')
assert.ok(meta.description.en.length > 0, 'English description')
assert.ok(meta.description.zh.length > 0, 'Chinese description')
console.log('meta-check: the package card has localized display text')

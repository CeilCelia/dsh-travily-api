/**
 * Reproduce what the Host does when it decides whether this plugin's settings
 * namespace is configurable: parse the Config schema, then project the volatile
 * form exactly as `@deepseek-ai/dsh-settings` does. A namespace only reaches the
 * Plugins page's configuration ledger when that projection is non-empty.
 *
 * Usage: node .tools/schema-check.mjs
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const modulesRoot = join(here, '..', 'node_modules')
const require = createRequire(join(modulesRoot, 'noop.js'))

const settingsEntry = require.resolve('@deepseek-ai/dsh-settings/package.json')
const settings = await import(pathToFileURL(join(dirname(settingsEntry), 'lib/index.js')).href)

const plugin = await import('../lib/index.js')
const Config = plugin.Config

// dsh-settings' own projection of the schema into a form.
const form = settings.volatileForm(Config)
assert.ok(form !== undefined, 'Config projects to a volatile form (undefined means no settings page)')

const fields = Object.keys(form.dict ?? {})
console.log('volatile form fields:', fields.join(', '))
assert.deepEqual(
  [...fields].sort(),
  [
    'allowCustomBaseURL',
    'apiKeyEnv',
    'baseURL',
    'enabled',
    'maxResults',
    'searchDepth',
    'searchTimeoutMs',
  ],
  'every declared field stays editable',
)

// `describe()` needs the schema to survive the wire round trip the client
// rehydrates (`plainSchema`), because the client validates the value against it.
const plain = settings.plainSchema(form)
const serialized = JSON.parse(JSON.stringify(plain.toJSON()))
assert.ok(serialized.refs !== undefined, 'schema serializes with refs')

// The resolved value shape a client sees: Enable's own projection of the section.
const resolved = Config({})
const value = settings.plainConfig(resolved)
assert.deepEqual(
  Object.keys(value).sort(),
  [...fields].sort(),
  'the served value carries exactly the form fields',
)
assert.equal(value.enabled, false, 'the switch defaults off')

console.log('schema-check: the settings namespace is configurable')
console.log(JSON.stringify(value, null, 2))

/**
 * End-to-end verification of the installed plugin against a throwaway profile.
 *
 * The desktop profile is managed exclusively by the Electron application, so
 * this script builds its own profile on a spare port and proves the three
 * things only a real boot can prove:
 *
 *   1. the row composes            dsh <profile> --dump-config
 *   2. the host half loads         POST /api/tavily/probe answers
 *   3. the client half is served   the boot graph carries dsh-travily-api/client.js
 *      and the bundle route returns it
 *
 * The harness home comes from `$DSH_HOME`; the application install is discovered
 * from the platform's usual locations or given with `--dir`. The throwaway
 * profile is created and deleted by this script, and only the process it starts
 * itself is stopped — a real profile is never touched.
 *
 * Usage: node .tools/verify-install.mjs [--port 19388] [--dir <harness install>]
 *        node .tools/verify-install.mjs --github   # install from GitHub instead of the checkout
 */
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { dshHome, options, profileDir, resolveInstall } from './env.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pluginDir = resolve(here, '..')

const flags = options(process.argv.slice(2))
const port = Number(flags.port ?? '19388')
const fromGithub = flags.github === true
const repo = typeof flags.repo === 'string' ? flags.repo : 'github:CeilCelia/dsh-travily-api'
const { exe, cli } = resolveInstall(typeof flags.dir === 'string' ? flags.dir : undefined)
const home = dshHome()
const profile = 'travily-verify'
const directory = profileDir(home, profile)

assert.ok(home.length > 0, 'set DSH_HOME (or run inside a dsh session) before this script')

const dshEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: home }
const runDsh = (extra) =>
  spawnSync(exe, ['--expose-internals', cli, ...extra], { encoding: 'utf8', env: dshEnv })

const readText = (file) => readFileSync(file, 'utf8')

const passed = []
const failed = []
const step = (name, ok, detail) => {
  if (ok) passed.push(name)
  else failed.push(`${name} — ${detail}`)
}

// Build the throwaway profile: the shipped web template's bundle list plus this
// plugin. `--github` installs it the way a user does, through the package
// manager, so that path is exercised too.
rmSync(directory, { recursive: true, force: true })
mkdirSync(directory, { recursive: true })
if (fromGithub) {
  const install = runDsh(['plugin', '--profile', profile, 'add', repo])
  step(
    `github install (${repo})`,
    `${install.stdout ?? ''}`.includes('dsh-travily-api'),
    `${(install.stdout ?? '').slice(-400)}${(install.stderr ?? '').slice(-400)}`,
  )
  const manifest = JSON.parse(readText(join(directory, 'package.json')))
  manifest.dsh = { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'], patchReload: 'live' } }
  if (!manifest.dsh.profile.bundles.includes('dsh-travily-api')) {
    manifest.dsh.profile.bundles.push('dsh-travily-api')
  }
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
} else {
  writeFileSync(
    join(directory, 'package.json'),
    `${JSON.stringify(
      {
        name: `dsh-profile-${profile}`,
        private: true,
        dependencies: { 'dsh-travily-api': `link:${pluginDir}` },
        dsh: {
          profile: {
            bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-travily-api'],
            patchReload: 'live',
          },
        },
      },
      null,
      2,
    )}\n`,
  )
  // The profile needs the plugin resolvable as a package name; a file copy keeps
  // the local mode independent of pnpm and of any install step.
  cpSync(pluginDir, join(directory, 'node_modules', 'dsh-travily-api'), {
    recursive: true,
    filter: (source) => !['node_modules', '.tools', '.git'].includes(source.split(/[\\/]/u).pop()),
  })
}
step(
  'profile built',
  existsSync(join(directory, 'node_modules', 'dsh-travily-api', 'package.json')),
  `nothing at ${directory}`,
)

const dump = runDsh(['--profile', profile, '--dump-config'])
step(
  'row composes',
  `${dump.stdout ?? ''}${dump.stderr ?? ''}`.includes('web-search-tavily'),
  `web-search-tavily row missing from --dump-config:\n${(dump.stderr ?? '').slice(-800)}`,
)

const child = spawn(exe, ['--expose-internals', cli, '--profile', profile, '--no-open', '--port', String(port)], {
  env: dshEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

let bootLog = ''
child.stdout.on('data', (chunk) => {
  bootLog += chunk
})
child.stderr.on('data', (chunk) => {
  bootLog += chunk
})

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

try {
  let url
  for (let attempt = 0; attempt < 90 && url === undefined; attempt += 1) {
    await sleep(500)
    const match = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=(\S+)/u.exec(bootLog)
    if (match !== null) url = match[0]
  }
  step('web boot', url !== undefined, `no URL after 45s:\n${bootLog.slice(-2000)}`)

  if (url !== undefined) {
    const probe = await fetch(`http://127.0.0.1:${String(port)}/api/tavily/probe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const body = await probe.json()
    step(
      'host half registers and reaches Tavily',
      probe.status === 200 && body.ok === true,
      JSON.stringify(body),
    )

    // The index URL carries the process token; opening it mints the browser
    // session cookie on a redirect, which every later request needs. The
    // redirect is read manually because a followed redirect loses Set-Cookie.
    const handshake = await fetch(url, { redirect: 'manual' })
    const cookie = (handshake.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(';')[0])
      .join('; ')
    const html = await (await fetch(url, { headers: { cookie } })).text()
    if (process.env.TRAVILY_DEBUG === '1') {
      const at = html.indexOf('__DSH_BOOT__')
      console.error('— boot log —\n' + bootLog)
      console.error(`— index html: ${String(html.length)} bytes, cookie: ${cookie || '(none)'}, __DSH_BOOT__ at ${String(at)} —`)
      console.error(at === -1 ? html.slice(0, 1200) : html.slice(at, at + 2500))
    }
    step('client half in the boot graph', html.includes('dsh-travily-api/client.js'), 'not in __DSH_BOOT__')

    const rev = /"id":"dsh-travily-api","url":"plugins\/\?\?dsh-travily-api\/client\.js&rev=([0-9a-f]+)"/u.exec(html)
    step('client bundle row', rev !== null, 'no revisioned row in the boot graph')
    if (rev !== null) {
      const bundle = await fetch(
        `http://127.0.0.1:${String(port)}/plugins/??dsh-travily-api/client.js&rev=${rev[1]}`,
        { headers: { cookie } },
      )
      const text = await bundle.text()
      step(
        'client bundle loads',
        bundle.status === 200 && text.includes('plugins.item'),
        `status ${String(bundle.status)}`,
      )
    }
  }
} finally {
  child.kill('SIGKILL')
  await sleep(500)
  rmSync(directory, { recursive: true, force: true })
}

for (const name of passed) console.log(`PASS  ${name}`)
for (const detail of failed) console.error(`FAIL  ${detail}`)
if (failed.length > 0) process.exit(1)
console.log('verify-install: all checks passed')

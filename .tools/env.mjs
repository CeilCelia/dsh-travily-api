/**
 * Shared location resolution for the development scripts.
 *
 * Nothing here hard-codes a machine: every path comes from the environment the
 * harness itself sets (`DSH_HOME`, `DSH_PROFILE`) or from an option, so the
 * scripts run on any install.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The harness home: `$DSH_HOME`, else the conventional `~/.dsh`. */
export function dshHome() {
  const declared = process.env.DSH_HOME
  return declared !== undefined && declared.length > 0 ? declared : join(homedir(), '.dsh')
}

/** The profile to inspect: `$DSH_PROFILE`, else the shipped desktop profile. */
export function defaultProfile(configured) {
  if (configured !== undefined && configured.length > 0) return configured
  const declared = process.env.DSH_PROFILE
  return declared !== undefined && declared.length > 0 ? declared : 'desktop'
}

/** A profile's directory under the harness home. */
export function profileDir(home, profile) {
  return join(home, 'profiles', profile)
}

/** Common install locations for the desktop application, newest convention first. */
function installCandidates() {
  const local = process.env.LOCALAPPDATA
  const candidates = []
  if (local !== undefined && local.length > 0) {
    candidates.push(join(local, 'Programs', 'DeepSeek Harness'))
  }
  candidates.push(join(homedir(), 'AppData', 'Local', 'Programs', 'DeepSeek Harness'))
  candidates.push('/Applications/DeepSeek Harness.app/Contents/Resources')
  candidates.push(join(homedir(), '.local', 'share', 'deepseek-harness'))
  return candidates
}

/**
 * Resolve the installed harness the end-to-end script drives.
 *
 * The desktop CLI lives *inside* `app.asar`, which no plain Node process can
 * stat, so an installation is identified by its executable plus the archive (or
 * an unpacked `dsh/` tree beside it).
 *
 * @param configured - explicit `--dir`, which always wins.
 * @returns the install root, the application executable, and the CLI entry.
 * @throws when no candidate looks like a harness installation.
 */
export function resolveInstall(configured) {
  const candidates =
    configured !== undefined && configured.length > 0 ? [configured] : installCandidates()
  for (const root of candidates) {
    const exe = join(root, 'DeepSeek Harness.exe')
    const asar = join(root, 'resources', 'app.asar')
    const unpacked = join(root, 'resources', 'dsh')
    const base = existsSync(asar) ? join(asar, 'dsh') : existsSync(unpacked) ? unpacked : undefined
    if (base === undefined || !existsSync(exe)) continue
    const cli = join(base, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
    return { root, exe, cli }
  }
  throw new Error(
    `no DeepSeek Harness install found (looked in: ${candidates.join(', ')}); pass --dir <install>`,
  )
}

/** Parse `--name value` options out of an argv tail. */
export function options(argv, defaults = {}) {
  const found = { ...defaults }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const name = token.slice(2)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) found[name] = true
    else {
      found[name] = value
      index += 1
    }
  }
  return found
}

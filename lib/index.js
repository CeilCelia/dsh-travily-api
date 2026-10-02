/**
 * dsh-travily-api — Tavily web search provider for DeepSeek Harness.
 *
 * Host half: registers a `tavily` search provider on the `ctx.web` seam, a
 * volatile settings section that owns the on/off switch, and one exact HTTP
 * route the Settings page's "test connection" button calls.
 *
 * The switch (not the key) decides which backend a `web_search` uses:
 *   enabled  → Tavily (with the stored key, or Tavily's keyless endpoint)
 *   disabled → the DeepSeek provider already registered on this deployment
 *
 * That keeps the official search working when the switch is off, so the plugin
 * can be installed without changing which provider the composition selects.
 *
 * @module dsh-travily-api
 */
import z from '@deepseek-ai/schemastery'

/** Registry id of the provider this plugin contributes. */
export const TAVILY_PROVIDER_ID = 'tavily'
/** Provider id of the search implementation every DSH deployment ships. */
export const DEEPSEEK_PROVIDER_ID = 'deepseek-official'
/** The Tavily API origin. Only this host is accepted unless explicitly allowed. */
export const TAVILY_HOST = 'https://api.tavily.com'
/** Credential reference holding the Tavily key when the section names none. */
export const DEFAULT_API_KEY_ENV = 'TAVILY_API_KEY'
/** Upper bound on one Tavily search. */
export const DEFAULT_TIMEOUT_MS = 30_000
/** Route the Settings card's connection test posts to. */
export const PROBE_PATH = '/api/tavily/probe'
/** Largest request body the probe route reads. */
const PROBE_BODY_LIMIT = 4096

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-tavily'
/**
 * Services this plugin waits for. `web` owns the provider registry, `settings`
 * stores the section, `credentials` resolves the key, and `webServer` mounts
 * the probe route (`connection` provides it in the shipped Web composition).
 */
export const inject = ['web', 'settings', 'credentials', 'webServer']

/**
 * The plugin's settings section. Every field is `volatile`, so the card writes
 * the section and the running provider observes the next search without a
 * remount.
 */
export const Config = z.object({
  enabled: z
    .boolean()
    .description('Search the web through Tavily instead of the platform provider.')
    .default(false)
    .volatile(),
  apiKeyEnv: z
    .string()
    .role('credential-ref', { ref: true })
    .description('Credential reference the Tavily API key is read from.')
    .default(DEFAULT_API_KEY_ENV)
    .volatile(),
  baseURL: z
    .string()
    .description('Tavily API origin. Leave empty for the public endpoint.')
    .default(TAVILY_HOST)
    .volatile(),
  allowCustomBaseURL: z
    .boolean()
    .description('Allow a Tavily endpoint other than the public origin.')
    .default(false)
    .volatile(),
  maxResults: z
    .number()
    .step(1)
    .min(1)
    .max(20)
    .description('Results per search when the request states no budget.')
    .default(5)
    .volatile(),
  searchDepth: z
    .union([z.const('basic'), z.const('advanced')])
    .description('Tavily search depth.')
    .default('basic')
    .volatile(),
  searchTimeoutMs: z
    .number()
    .step(1)
    .min(1)
    .description('Tavily request timeout in milliseconds.')
    .default(DEFAULT_TIMEOUT_MS)
    .volatile(),
})

/** Stable cancellation error, independent of the `dsh-web` WebError instance. */
class TavilyWebError extends Error {
  constructor(message, code, options) {
    super(message, options)
    this.name = 'WebError'
    this.code = code
  }
}

/** Throw the stable cancellation error when the caller already aborted. */
function throwIfAborted(signal) {
  if (signal?.aborted === true) {
    throw new TavilyWebError('Tavily search aborted', 'WEB_ABORTED', { cause: signal.reason })
  }
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

/** True when a stored value reads as "on". */
function truthy(value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return value
  const text = String(value).trim().toLowerCase()
  return text === 'true' || text === '1' || text === 'yes' || text === 'on'
}

/** Resolve the Tavily origin for one operation, refusing an unapproved host. */
function searchOrigin(baseURL, allowCustomBaseURL) {
  const host = (baseURL && baseURL.length > 0 ? baseURL : TAVILY_HOST).replace(/\/+$/u, '')
  if (host === TAVILY_HOST) return host
  if (allowCustomBaseURL !== true) {
    throw new TavilyWebError(
      `Tavily baseURL must be ${TAVILY_HOST} unless allowCustomBaseURL is true`,
      'WEB_PROVIDER_ERROR',
    )
  }
  if (!host.startsWith('https://')) {
    throw new TavilyWebError('Tavily custom baseURL must use https', 'WEB_PROVIDER_ERROR')
  }
  return host
}

/** Combine the caller's signal with this plugin's own timeout. */
function deadlineSignal(signal, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return signal
  const timer = AbortSignal.timeout(timeoutMs)
  if (signal === undefined) return timer
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timer])
  return timer
}

/**
 * Resolve one credential reference for the next operation: the managed
 * credential store first (its resolver already ranks the inherited environment
 * above the stored document), then the process environment as a last resort.
 *
 * The credential seam's reference type is a branded string, so a plain string is
 * what `credentials.resolve` accepts.
 *
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param envName - the reference name to resolve.
 * @returns the resolved value, or undefined when nothing holds one.
 */
async function resolveReference(ctx, envName) {
  const name = typeof envName === 'string' && envName.length > 0 ? envName : DEFAULT_API_KEY_ENV
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const resolved = await credentials.resolve(name)
    if (resolved?.value !== undefined && resolved.value.length > 0) return resolved.value
  }
  const ambient = process.env[name]
  return typeof ambient === 'string' && ambient.length > 0 ? ambient : undefined
}

/** Headers for one Tavily request; an absent key selects Tavily's keyless mode. */
function tavilyHeaders(apiKey) {
  const headers = { 'content-type': 'application/json', accept: 'application/json' }
  if (typeof apiKey === 'string' && apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`
  else headers['x-tavily-access-mode'] = 'keyless'
  return headers
}

/** Read the provider's own failure text, falling back to the status line. */
async function tavilyErrorText(response) {
  let message = `Tavily API error (HTTP ${String(response.status)})`
  try {
    const body = await response.json()
    const detail =
      typeof body?.error === 'string'
        ? body.error
        : (body?.error?.message ?? body?.message ?? body?.detail)
    if (typeof detail === 'string' && detail.length > 0) message = detail
  } catch {
    // keep the status-line fallback
  }
  return message
}

/** Map a Tavily response body onto the seam's result vocabulary. */
function toSearchResult(body) {
  const rows = Array.isArray(body?.results) ? body.results : []
  const sources = []
  for (const row of rows) {
    if (typeof row?.url !== 'string' || row.url.length === 0) continue
    const source = { url: row.url }
    if (typeof row.title === 'string' && row.title.length > 0) source.title = row.title
    if (typeof row.content === 'string' && row.content.length > 0) {
      source.snippet = row.content.slice(0, 800)
    }
    if (typeof row.published_date === 'string' && row.published_date.length > 0) {
      source.publishedAt = row.published_date
    }
    sources.push(source)
  }
  return { sources, truncated: false }
}

/**
 * Run one Tavily search.
 * @param query - the user-side query text.
 * @param options - endpoint, credential, budget, and depth for this operation.
 * @param signal - optional cancellation signal forwarded by the seam.
 * @returns the normalized result.
 * @throws {TavilyWebError} with the seam's shared failure codes.
 */
export async function searchTavily(query, options, signal) {
  throwIfAborted(signal)
  const origin = searchOrigin(options.baseURL, options.allowCustomBaseURL)
  const requestSignal = deadlineSignal(signal, options.searchTimeoutMs)
  let response
  try {
    response = await fetch(`${origin}/search`, {
      method: 'POST',
      redirect: 'error',
      headers: tavilyHeaders(options.apiKey),
      body: JSON.stringify({
        query,
        max_results: options.maxResults,
        search_depth: options.searchDepth,
        chunks_per_source: 3,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      ...(requestSignal === undefined ? {} : { signal: requestSignal }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new TavilyWebError(
        `Tavily search timed out after ${String(options.searchTimeoutMs)}ms`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
    if (signal?.aborted === true || isAbortError(error)) {
      throw new TavilyWebError('Tavily search aborted', 'WEB_ABORTED', { cause: error })
    }
    throw new TavilyWebError(`Tavily request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', {
      cause: error,
    })
  }
  if (!response.ok) {
    if (signal?.aborted === true) throwIfAborted(signal)
    throw new TavilyWebError(await tavilyErrorText(response), 'WEB_PROVIDER_ERROR')
  }
  try {
    return toSearchResult(await response.json())
  } catch (error) {
    if (signal?.aborted === true || isAbortError(error)) {
      throw new TavilyWebError('Tavily search aborted', 'WEB_ABORTED', { cause: error })
    }
    throw new TavilyWebError(
      `Tavily returned an unprocessable response: ${String(error)}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  }
}

/**
 * The provider registered on `ctx.web`. It delegates to the platform provider
 * while the switch is off, so both backends answer the same search.
 */
export class TavilySearchProvider {
  id = TAVILY_PROVIDER_ID

  /**
   * @param resolveOptions - snapshot of the section and services for the NEXT
   *   operation, read per call so a settings write is observed without a
   *   provider re-registration.
   */
  constructor(resolveOptions) {
    this.resolveOptions = resolveOptions
  }

  /** Tavily works keyless, so no configuration makes this provider unusable. */
  available() {
    return true
  }

  async search(request, signal) {
    const options = this.resolveOptions()
    throwIfAborted(signal)
    // The fallback is looked up only when the switch is off: with the switch on
    // a deployment that registers no other provider must not fail the search.
    if (options.enabled !== true) return options.fallbackProvider().search(request, signal)
    const apiKey = await resolveReference(options.ctx, options.apiKeyEnv)
    return searchTavily(
      request.query,
      {
        apiKey,
        baseURL: options.baseURL,
        allowCustomBaseURL: options.allowCustomBaseURL,
        searchDepth: options.searchDepth,
        maxResults: request.maxResults ?? options.maxResults,
        searchTimeoutMs: options.searchTimeoutMs,
      },
      signal,
    )
  }
}

/** Reply with one JSON document and no caching. */
function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

/** Read and parse a bounded JSON request body. */
function readJsonBody(req, limit = PROBE_BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (text.length === 0) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(text)
        resolve(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {})
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/** Classify a probe failure into the code the Settings card renders. */
export function classifyProbeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/timed out|TimeoutError/iu.test(message)) return { code: 'timeout' }
  if (/aborted/iu.test(message)) return { code: 'timeout' }
  const http = /HTTP (\d{3})/u.exec(message)
  if (http !== null) {
    const status = Number(http[1])
    if (status === 401 || status === 403) return { code: 'invalid_key', status }
    return { code: 'http', status }
  }
  if (/unauthorized|invalid api key|forbidden|invalid key/iu.test(message)) return { code: 'invalid_key' }
  if (/Tavily request failed|fetch failed|ECONN|ENOTFOUND|network/iu.test(message)) return { code: 'network' }
  const trimmed = message
    .replace(/^Tavily (API error|returned an unprocessable response):?\s*/iu, '')
    .slice(0, 80)
  return { code: 'other', error: trimmed.length > 0 ? trimmed : 'unknown' }
}

/**
 * Mount the plugin: the settings section, the provider, and the probe route.
 * @param ctx - host plugin context.
 * @param config - resolved section values (schema defaults applied).
 */
export function apply(ctx, config) {
  const section = () => ({
    enabled: config.enabled.get() === true,
    apiKeyEnv: config.apiKeyEnv.get() || DEFAULT_API_KEY_ENV,
    baseURL: config.baseURL.get(),
    allowCustomBaseURL: config.allowCustomBaseURL.get() === true,
    searchDepth: config.searchDepth.get(),
    maxResults: config.maxResults.get(),
    searchTimeoutMs: config.searchTimeoutMs.get(),
  })

  /**
   * Resolve the platform provider lazily, at search time, so this plugin's own
   * registration cannot be mistaken for it and no provider is captured before
   * the registry settles. Only a search that actually falls back pays for it.
   */
  const fallbackProvider = () => {
    const providers = ctx.web.searchProviders
    const configured = ctx.web.searchProviderId
    if (configured !== undefined && configured !== TAVILY_PROVIDER_ID) {
      const configuredProvider = providers.get(configured)
      if (configuredProvider !== undefined) return configuredProvider
    }
    const deepseek = providers.get(DEEPSEEK_PROVIDER_ID)
    if (deepseek !== undefined) return deepseek
    for (const [id, provider] of providers) {
      if (id !== TAVILY_PROVIDER_ID) return provider
    }
    throw new TavilyWebError(
      'Tavily search is off and this deployment registers no other web search provider',
      'WEB_PROVIDER_UNAVAILABLE',
    )
  }

  ctx.web.registerSearchProvider(
    new TavilySearchProvider(() => ({
      ...section(),
      ctx,
      fallbackProvider,
    })),
  )

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'exact',
          path: PROBE_PATH,
          handler: async (req, res) => {
            if (req.method !== 'POST') {
              sendJson(res, 405, { ok: false, code: 'other', error: 'method not allowed' })
              return
            }
            try {
              const body = await readJsonBody(req)
              const draft = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
              const clearKey = body.clearKey === true
              const current = section()
              let apiKey
              if (draft.length > 0) apiKey = draft.slice(0, 512)
              else if (!clearKey) apiKey = await resolveReference(ctx, current.apiKeyEnv)
              const mode = apiKey === undefined || apiKey.length === 0 ? 'keyless' : 'key'
              await searchTavily('tavily', {
                apiKey,
                baseURL: current.baseURL,
                allowCustomBaseURL: current.allowCustomBaseURL,
                searchDepth: current.searchDepth,
                maxResults: 1,
                searchTimeoutMs: current.searchTimeoutMs,
              })
              sendJson(res, 200, { ok: true, mode })
            } catch (error) {
              if (
                error instanceof Error &&
                (error.message === 'invalid JSON body' || error.message === 'body too large')
              ) {
                sendJson(res, 400, { ok: false, code: 'other', error: error.message })
                return
              }
              sendJson(res, 200, { ok: false, ...classifyProbeError(error) })
            }
          },
        }),
      'web-search-tavily: probe route',
    )
  })
}

/**
 * Public site-URL resolution and validation (D23-8, doc 22).
 *
 * Every absolute public URL the site emits — i18n canonical + `og:url` + hreflang, the
 * sitemap index and its per-locale children, and `robots.txt`'s `Sitemap:` line — is derived
 * from ONE value: `NUXT_PUBLIC_SITE_URL`. That value is read in `nuxt.config.ts`, which is
 * evaluated at BUILD time, so a missing variable cannot be recovered from at runtime: the
 * wrong origin is already frozen into the bundle.
 *
 * A staging build on 2026-07-26 proved the cost of the previous `|| 'http://localhost:3000'`
 * fallback — it shipped `<link rel="canonical" href="http://localhost:3000">` with no error at
 * any stage. Production-like builds therefore fail fast here instead.
 *
 * This module is deliberately dependency-free and pure so it is unit-testable on its own;
 * `nuxt.config.ts` cannot be imported into a test, but this can.
 */

/** The intentional development/test origin. Never used for a production-like build. */
export const DEV_SITE_URL = 'http://localhost:3000'

/** Env var that carries the public origin. */
export const SITE_URL_ENV = 'NUXT_PUBLIC_SITE_URL'

/**
 * Documented escape hatch: allows a loopback origin in a production-like build. Exists for
 * local production-parity smoke runs only; CI and the deploy workflow both supply a real
 * origin and must never set this.
 */
export const ALLOW_LOOPBACK_ENV = 'NUXT_PUBLIC_SITE_URL_ALLOW_LOOPBACK'

export interface ResolveSiteUrlOptions {
  /** Raw environment value, exactly as read (may be undefined/empty). */
  value: string | undefined
  /**
   * True when the build must serve a real public origin (staging/production). Derived from
   * `NODE_ENV === 'production'` at the call site so dev/test keep the localhost default.
   */
  requirePublicOrigin: boolean
  /** Honour the documented loopback escape hatch. */
  allowLoopback?: boolean
}

/** Hostnames that can never be a public origin. */
function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    h === 'localhost'
    || h.endsWith('.localhost')
    || h === '::1'
    || h === '0.0.0.0'
    || h === '::'
    || /^127(?:\.\d{1,3}){3}$/.test(h)
  )
}

function fail(reason: string, hint: string): never {
  // The site URL is public configuration, never a credential, so echoing it is safe — but keep
  // the message to the one variable so no surrounding env is ever printed.
  throw new Error(
    `[site-url] ${reason}\n`
    + `  ${hint}\n`
    + `  Set ${SITE_URL_ENV} to the absolute public origin, e.g. ${SITE_URL_ENV}=https://eslammuatamed.com\n`
    + '  It is required for canonical/og:url/hreflang, the sitemap, and robots.txt, and it is\n'
    + '  baked at BUILD time — supplying it only at runtime is too late.'
  )
}

/**
 * Validate and normalise the public site URL.
 *
 * @returns an absolute origin with no trailing slash (path preserved when the site is hosted
 *          on a subpath).
 * @throws  when a production-like build has a missing, malformed, relative, non-HTTP or
 *          loopback value.
 */
export function resolveSiteUrl({ value, requirePublicOrigin, allowLoopback = false }: ResolveSiteUrlOptions): string {
  const raw = (value ?? '').trim()

  if (!raw) {
    if (!requirePublicOrigin) return DEV_SITE_URL
    fail(`${SITE_URL_ENV} is not set, but this is a production-like build.`, 'Refusing to fall back to localhost: it would ship wrong canonical and og:url values.')
  }

  let url: URL
  try {
    // Relative values ("/", "example.com", "//host") have no scheme, so this throws — which is
    // exactly the rejection we want; there is deliberately no base URL to resolve against.
    url = new URL(raw)
  } catch {
    fail(`${SITE_URL_ENV} is not a valid absolute URL.`, 'A scheme is required — a relative path or bare hostname cannot produce an absolute canonical.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`${SITE_URL_ENV} must use http or https (received protocol "${url.protocol}").`, 'Only HTTP(S) origins are addressable by crawlers and social scrapers.')
  }

  if (!url.hostname) {
    fail(`${SITE_URL_ENV} has no hostname.`, 'An absolute origin needs a host component.')
  }

  if (url.search || url.hash) {
    fail(`${SITE_URL_ENV} must not contain a query string or fragment.`, 'The site origin is a prefix for generated URLs; a query or fragment would corrupt every one of them.')
  }

  if (requirePublicOrigin && !allowLoopback && isLoopbackHost(url.hostname)) {
    fail(`${SITE_URL_ENV} points at a loopback host ("${url.hostname}") in a production-like build.`, `Use the real public origin. To override intentionally for a local production-parity run, set ${ALLOW_LOOPBACK_ENV}=1.`)
  }

  if (requirePublicOrigin && url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
    fail(`${SITE_URL_ENV} uses insecure http for a public origin ("${url.host}").`, 'The site is served over HTTPS; an http canonical would advertise the wrong URL and break SEO parity.')
  }

  // Normalise: no trailing slash, so callers can concatenate paths without doubling it.
  const normalised = `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  return normalised || url.origin
}

/**
 * Is this invocation producing a deployable artifact?
 *
 * `NODE_ENV` is deliberately NOT the signal. Nuxt runs `nuxt typecheck` with
 * `NODE_ENV=production` too, so keying on it made a plain local `npm run typecheck` fail for any
 * developer whose gitignored `.env` points at localhost — punishing the correct dev setup for a
 * deploy-time concern. The artifact-producing commands are `build` and `generate`; `dev`,
 * `typecheck`, `prepare` and the test runner all keep the permissive localhost default.
 *
 * Only the command tokens are inspected (`argv` after node + the CLI entry) so a path that
 * happens to contain "build" cannot trip it.
 */
export function isArtifactBuild(argv: readonly string[] = process.argv): boolean {
  return argv.slice(2).some(token => token === 'build' || token === 'generate')
}

/** Read + validate straight from an environment bag (defaults to `process.env`). */
export function siteUrlFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv
): string {
  return resolveSiteUrl({
    value: env[SITE_URL_ENV],
    requirePublicOrigin: isArtifactBuild(argv),
    allowLoopback: env[ALLOW_LOOPBACK_ENV] === '1'
  })
}

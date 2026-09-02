import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTION_API_ORIGIN, apiOriginFromEnv } from './api-origin'

/**
 * FE4-U2e1 — structural security-policy gates (unit layer).
 *
 * These assert the DECLARED architecture, not the served bytes: the real enforcing-CSP behaviour is
 * proven against the production build in `e2e/security-csp.spec.ts` (Playwright). This file exists
 * so that the cheapest possible check fails fast when the foundation drifts — a dependency bump that
 * silently changes version policy, an accidentally re-enabled module default, or someone reintroducing
 * the custom Nitro nonce machinery that FE4-U2e0.1 discarded.
 */

const repoRoot = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8')

describe('dependency facts', () => {
  it('nuxt-security is pinned at exactly 2.6.0', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies['nuxt-security']).toBe('2.6.0')
  })

  it('the installed module resolves to 2.6.0', () => {
    const installed = JSON.parse(
      read('node_modules/nuxt-security/package.json')
    ) as { version: string }
    expect(installed.version).toBe('2.6.0')
  })

  it('package-lock.json resolves nuxt-security to 2.6.0', () => {
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { version?: string }>
    }
    expect(lock.packages['node_modules/nuxt-security']?.version).toBe('2.6.0')
  })

  it('@nuxt/scripts is pinned at exactly 1.3.8 (U2e2 owns GTM through it)', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies['@nuxt/scripts']).toBe('1.3.8')
    const installed = JSON.parse(
      read('node_modules/@nuxt/scripts/package.json')
    ) as { version: string }
    expect(installed.version).toBe('1.3.8')
  })
})

describe('module registration', () => {
  const configSource = read('nuxt.config.ts')

  it('registers nuxt-security exactly once', () => {
    const matches = configSource.match(/'nuxt-security'/g) ?? []
    // one in the modules array; the doc comment may not mention the literal at all
    expect(matches.length).toBe(1)
  })

  it('keeps SSR streaming disabled (buffered SSR only)', () => {
    expect(configSource).not.toMatch(/ssrStreaming/)
  })
})

describe('declared CSP policy', () => {
  // Directives are asserted against the WHOLE nuxt.config source: each `'x-src': [` literal is
  // unique (the quote+colon anchor separates script-src from script-src-attr), and importing
  // nuxt.config would execute site-url validation requiring build env. The assertion target IS the
  // declared source, not its evaluation.
  const configSource = read('nuxt.config.ts')
  const sourcesOf = (directive: string): string[] =>
    configSource.match(new RegExp(`'${directive}': \\[([^\\]]*)\\]`))?.[1]
      .split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean) ?? []

  it('declares the policy inside the module security block', () => {
    expect(configSource).toMatch(/contentSecurityPolicy: \{/)
  })

  it('default-src is self-only', () => {
    expect(sourcesOf('default-src')).toEqual(["'self'"])
  })

  it('script-src carries the nonce template and strict-dynamic', () => {
    const script = sourcesOf('script-src')
    expect(script).toContain("'nonce-{{nonce}}'")
    expect(script).toContain("'strict-dynamic'")
  })

  it('script-src has no unsafe-inline, unsafe-eval or wildcard', () => {
    const script = sourcesOf('script-src')
    expect(script).not.toContain("'unsafe-inline'")
    expect(script).not.toContain("'unsafe-eval'")
    expect(script.join(' ')).not.toMatch(/\*/)
  })

  it('style-src is self + unsafe-inline (the documented Vue concession)', () => {
    expect(sourcesOf('style-src')).toEqual(["'self'", "'unsafe-inline'"])
  })

  it('font-src is self-only', () => {
    expect(sourcesOf('font-src')).toEqual(["'self'"])
  })

  it('object-src, base-uri and frame-ancestors are locked down', () => {
    expect(sourcesOf('object-src')).toEqual(["'none'"])
    expect(sourcesOf('base-uri')).toEqual(["'none'"])
    expect(sourcesOf('frame-ancestors')).toEqual(["'none'"])
  })

  it('form-action is self-only', () => {
    expect(sourcesOf('form-action')).toEqual(["'self'"])
  })

  it('script-src-attr is none (no legitimate inline handler dependency)', () => {
    expect(sourcesOf('script-src-attr')).toEqual(["'none'"])
  })

  it('img-src admits only self, data and the media origin constant', () => {
    // MEDIA_ORIGIN is declared beside siteUrl in nuxt.config.ts (D23-15); assert the identifier so
    // the gate tracks the declaration, then pin its value via the constant's own definition.
    expect(sourcesOf('img-src')).toEqual(["'self'", 'data:', 'MEDIA_ORIGIN'])
    expect(configSource).toMatch(/const MEDIA_ORIGIN = 'https:\/\/media\.eslammuatamed\.com'/)
  })

  it('connect-src admits only self and the API origin constant', () => {
    // The declared array holds the `apiOrigin` identifier resolved once from
    // NUXT_PUBLIC_API_BASE (production origin by default — see config/api-origin.ts).
    expect(sourcesOf('connect-src')).toEqual(["'self'", 'apiOrigin'])
  })

  it('upgrade-insecure-requests is explicitly disabled (HTTPS-only site already)', () => {
    expect(configSource).toMatch(/'upgrade-insecure-requests': false/)
  })

  it('the security block contains no analytics/GTM origins', () => {
    const securityBlock = configSource.split('security: {')[1]?.split('\n  },')[0] ?? ''
    expect(securityBlock).not.toMatch(/googletagmanager|google-analytics|facebook/i)
  })
})

describe('module-default disposition', () => {
  const configSource = read('nuxt.config.ts')

  it.each([
    'removeLoggers',
    'hidePoweredBy',
    'requestSizeLimiter',
    'rateLimiter',
    'xssValidator',
    'corsHandler',
    'allowedMethodsRestricter'
  ])('%s is explicitly disabled', key => {
    expect(configSource).toMatch(new RegExp(`${key}: false`))
  })

  it.each([
    'crossOriginResourcePolicy',
    'crossOriginOpenerPolicy',
    'crossOriginEmbedderPolicy',
    'referrerPolicy',
    'strictTransportSecurity',
    'xContentTypeOptions',
    'xDNSPrefetchControl',
    'xDownloadOptions',
    'xFrameOptions',
    'xPermittedCrossDomainPolicies',
    'xXSSProtection',
    'originAgentCluster',
    'permissionsPolicy'
  ])('unrelated %s header is explicitly disabled', key => {
    expect(configSource).toMatch(new RegExp(`${key}: false`))
  })
})

describe('ecosystem ownership boundaries', () => {
  it('server/plugins holds ONLY the documented runtime-origin glue', () => {
    const files = readdirSync(join(repoRoot, 'server/plugins'))
    expect(files).toEqual(['csp-connect-origin.ts'])
  })

  it('the glue plugin performs no nonce work, hashing or raw header writing', () => {
    const source = read('server/plugins/csp-connect-origin.ts')
    expect(source).not.toMatch(/generateRandomNonce|randomBytes|crypto\./)
    expect(source).not.toMatch(/setResponseHeader|setHeader\(|removeResponseHeader/)
    expect(source).not.toMatch(/sha256|createHash|'sha384-/i)
    expect(source).not.toMatch(/nonce-/)
    // it extends the module through its lifecycle hook, nothing else
    expect(source).toMatch(/nuxt-security:routeRules/)
  })

  it('no custom nonce/hash machinery exists anywhere in tracked app/server/config sources', () => {
    for (const dir of ['app', 'server', 'config']) {
      const walk = (d: string): string[] =>
        readdirSync(join(repoRoot, d), { withFileTypes: true }).flatMap(e =>
          e.isDirectory() ? walk(join(d, e.name)) : join(d, e.name)
        )
      for (const file of walk(dir)) {
        // Spec files are guardrails that QUOTE the forbidden tokens as their own negative
        // assertions; they are not implementation. Only executable sources are scanned.
        if (!/\.(ts|vue|mjs)$/.test(file) || file.endsWith('.spec.ts')) continue
        const code = read(file)
        expect(code, file).not.toMatch(/generateRandomNonce|nonce-[A-Za-z0-9]{8,}|createHash\(/)
      }
    }
  })

  it('no MANUAL GTM infrastructure exists in app/server sources (registry composable only)', () => {
    for (const dir of ['app', 'server']) {
      const walk = (d: string): string[] =>
        readdirSync(join(repoRoot, d), { withFileTypes: true }).flatMap(e =>
          e.isDirectory() ? walk(join(d, e.name)) : join(d, e.name)
        )
      for (const file of walk(dir)) {
        // Spec files are guardrails that QUOTE the forbidden tokens as their own negative
        // assertions; they are not implementation. Only executable sources are scanned.
        if (!/\.(ts|vue)$/.test(file) || file.endsWith('.spec.ts')) continue
        const code = read(file)
        // Manual bootstrap URL construction, raw dataLayer infrastructure and noscript frames are
        // forbidden everywhere. The SANCTIONED surface is @nuxt/scripts' registry composable
        // (`useScriptGoogleTagManager`), which owns the URL, the loader element and dedup itself.
        expect(code, file).not.toMatch(/googletagmanager\.com/i)
        expect(code, file).not.toMatch(/\bdataLayer\b/)
        expect(code, file).not.toMatch(/<noscript/i)
      }
    }
  })
})

describe('api-origin resolution', () => {
  it('falls back to the production origin when unset', () => {
    expect(apiOriginFromEnv({})).toBe(PRODUCTION_API_ORIGIN)
  })

  it('derives the origin, dropping path/query', () => {
    expect(apiOriginFromEnv({ NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:3001/api/v1?x=1' }))
      .toBe('http://127.0.0.1:3001')
  })

  it('falls back to the production origin on an unparseable value', () => {
    expect(apiOriginFromEnv({ NUXT_PUBLIC_API_BASE: ':://not a url' })).toBe(PRODUCTION_API_ORIGIN)
  })
})

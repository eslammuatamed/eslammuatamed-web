import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GTM_TEST_CONTAINER_ID } from '../scripts/e2e/fixtures'
import { isEligibleGtmContainerId } from '../app/utils/gtm-container'

/**
 * FE4-U2e2 — structural GTM gates (unit layer).
 *
 * These pin the DECLARED architecture: the exact dependency, the public-only ownership, the absence
 * of every manual-GTM mechanism this unit was chartered to avoid, and the consent/bundle decisions
 * recorded in D19-15. Live loader behaviour is proven against the production build in
 * `e2e/gtm/gtm-enabled.spec.ts` and `e2e/scenarios/gtm-disabled.spec.ts`.
 */

const repoRoot = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8')

const COMPOSABLE = 'app/composables/usePublicGtm.ts'
const BOUNDARY = 'app/components/PublicGtmRuntime.client.vue'
const LAYOUT = 'app/layouts/default.vue'
const HELPER = 'app/utils/gtm-container.ts'

describe('dependency facts', () => {
  it('@nuxt/scripts is pinned at exactly 1.3.8 in package.json', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies['@nuxt/scripts']).toBe('1.3.8')
  })

  it('package-lock.json resolves @nuxt/scripts to 1.3.8', () => {
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { version?: string }>
    }
    expect(lock.packages['node_modules/@nuxt/scripts']?.version).toBe('1.3.8')
  })

  it.each(['@nuxtjs/gtm', '@zadigetvoltaire/nuxt-gtm', '@nuxtjs/google-tag-manager'])(
    'legacy module %s is NOT installed',
    legacy => {
      const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
      expect(pkg.dependencies[legacy]).toBeUndefined()
      expect(() => read(`node_modules/${legacy}/package.json`)).toThrow()
    }
  )

  it('@nuxt/scripts is registered exactly once', () => {
    const config = read('nuxt.config.ts')
    expect(config.match(/'@nuxt\/scripts'/g) ?? []).toHaveLength(1)
  })
})

describe('id semantics — the backend publication contract', () => {
  it('accepts the controlled test id used by the gtm-settings lane', () => {
    expect(isEligibleGtmContainerId(GTM_TEST_CONTAINER_ID)).toBe(true)
  })

  it.each([
    'GTM-ABCD',
    'GTM-ABC123',
    'GTM-AB12CD34EF56' // 4..12 alphanumeric tail boundary
  ])('accepts a well-formed id (%s)', id => {
    expect(isEligibleGtmContainerId(id)).toBe(true)
  })

  it('rejects null / undefined / empty (disabled kill switch)', () => {
    expect(isEligibleGtmContainerId(null)).toBe(false)
    expect(isEligibleGtmContainerId(undefined)).toBe(false)
    expect(isEligibleGtmContainerId('')).toBe(false)
  })

  it.each([
    'GTM-abc123', // lowercase tail
    'gtm-ABCD', // lowercase prefix
    'GTM-', // empty tail
    'GTM-ABC', // tail below 4 chars
    'GTM-AB12CD34EF567', // tail above 12 chars
    'GTM-AB C123', // whitespace inside
    'GTM-AB;C123', // injection attempt
    'GTM-X&param=1', // URL metacharacters
    ' GTM-ABCD', // leading space
    'GA-ABCD1234' // wrong product prefix
  ])('fails closed on a malformed id (%s)', id => {
    expect(isEligibleGtmContainerId(id)).toBe(false)
  })

  it('the guard regex is byte-identical to the backend contract', () => {
    // The backend validates `/^GTM-[A-Z0-9]{4,12}$/` before publishing the id. This assertion pins
    // the frontend copy to that EXACT shape so one contract cannot drift into two truths.
    expect(read(HELPER)).toContain('/^GTM-[A-Z0-9]{4,12}$/')
  })

  it('no production container id is hard-coded anywhere in tracked sources', () => {
    for (const dir of ['app', 'server', 'config']) {
      const walk = (d: string): string[] =>
        readdirSync(join(repoRoot, d), { withFileTypes: true }).flatMap(e =>
          e.isDirectory() ? walk(join(d, e.name)) : join(d, e.name)
        )
      for (const file of walk(dir)) {
        // Generated API types quote contract examples; spec files quote tokens as guardrails.
        if (!/\.(ts|vue)$/.test(file) || file.endsWith('.spec.ts')) continue
        if (file.replaceAll('\\', '/').startsWith('app/types/')) continue
        // Any literal that LOOKS like a real container id is forbidden; ids exist only as runtime
        // Settings data (the fixture id lives under scripts/e2e/, outside these trees).
        expect(read(file), file).not.toMatch(/GTM-[A-Z0-9]{6,}/)
      }
    }
  })
})

describe('ownership & lifecycle wiring', () => {
  it('registration lives ONLY behind the lazy public-client boundary', () => {
    // FE4-U2e2.1: the composable may be invoked from exactly ONE place — the lazy `.client`
    // boundary component — and the public layout may reach it ONLY through the `Lazy` async
    // component convention. Nothing else (and no other shell) touches it.
    for (const dir of ['app']) {
      const walk = (d: string): string[] =>
        readdirSync(join(repoRoot, d), { withFileTypes: true }).flatMap(e =>
          e.isDirectory() ? walk(join(d, e.name)) : join(d, e.name)
        )
      for (const file of walk(dir)) {
        if (!/\.(ts|vue)$/.test(file) || file.endsWith('.spec.ts')) continue
        const normalised = file.replaceAll('\\', '/')
        if (normalised === COMPOSABLE || normalised === BOUNDARY) continue
        expect(read(file), file).not.toMatch(/usePublicGtm\(/)
      }
    }
    expect(read(BOUNDARY)).toMatch(/usePublicGtm\(props\.containerId\)/)

    const layout = read(LAYOUT)
    expect(layout).toMatch(/<LazyPublicGtmRuntime\s+:container-id="settings\?\.gtmContainerId \?\? null"/)
    // The boundary must be the ONLY coupling: the layout statically imports neither the composable
    // nor any @nuxt/scripts runtime symbol.
    expect(layout).not.toMatch(/usePublicGtm|useScriptGoogleTagManager|@nuxt\/scripts/)
  })

  it('the GTM boundary is CLIENT-ONLY and receives nothing but the container id', () => {
    expect(BOUNDARY).toMatch(/PublicGtmRuntime\.client\.vue$/)
    const code = read(BOUNDARY)
    // Client-only by filename convention; no Settings machinery crosses the boundary.
    expect(code).not.toMatch(/useSiteSettings|useAsyncData|\$fetch|useFetch/)
    expect(code).not.toMatch(/analyticsEnabled/)
  })

  it('the dashboard/auth shells never reference GTM registration', () => {
    for (const shell of ['app/layouts/dashboard.vue', 'app/layouts/auth.vue']) {
      const code = read(shell)
      expect(code, shell).not.toMatch(/usePublicGtm|useScriptGoogleTagManager|gtm/i)
    }
  })

  it('the composable defers loading until Nuxt is ready', () => {
    expect(read(COMPOSABLE)).toMatch(/trigger:\s*'onNuxtReady'/)
  })

  it('first-party bundling is disabled at the FINAL instance level', () => {
    const code = read(COMPOSABLE)
    // Inside the useScriptGoogleTagManager call's scriptOptions — the instance that actually loads,
    // not merely a registry default (registry-level bundle:false alone was historically insufficient).
    const call = code.match(/useScriptGoogleTagManager\(\{[\s\S]*?\}\)/)?.[0] ?? ''
    expect(call).toMatch(/scriptOptions:\s*\{\s*trigger:\s*'onNuxtReady',\s*bundle:\s*false/)
  })

  it('registers privacy-conservative Consent Mode v2 defaults with no auto-grant', () => {
    const call = read(COMPOSABLE).match(/defaultConsent:\s*\{[\s\S]*?\}/)?.[0] ?? ''
    expect(call).not.toBe('')
    for (const signal of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      expect(call).toMatch(new RegExp(`${signal}:\\s*'denied'`))
    }
    expect(call).not.toMatch(/'granted'/)
  })

  it('no custom pageview/dataLayer push exists — taxonomy belongs to the GTM container', () => {
    const composable = read(COMPOSABLE)
    expect(composable).not.toMatch(/useScriptEventPage/)
    expect(composable).not.toMatch(/\.push\(\s*\{[^}]*event:/i)
  })
})

describe('manual-infrastructure prohibitions', () => {
  const sources = [COMPOSABLE, BOUNDARY, LAYOUT, HELPER, 'nuxt.config.ts']

  it('no manual Google bootstrap URL or script element', () => {
    for (const file of sources) {
      const code = read(file)
      // The module owns the loader URL; constructing the third-party origin by hand is forbidden.
      expect(code, file).not.toMatch(/https?:\/\/www\.googletagmanager/i)
      expect(code, file).not.toMatch(/document\.createElement\(['"]script/i)
    }
  })

  it('no manual dataLayer initializer or stub', () => {
    for (const file of sources) {
      expect(read(file), file).not.toMatch(/\bdataLayer\b/)
    }
  })

  it('no GTM noscript iframe anywhere', () => {
    for (const file of sources) {
      expect(read(file), file).not.toMatch(/<noscript|ns\.html/i)
    }
  })

  it('no CSP changes for GTM — no frame-src, no google hosts in nuxt.config', () => {
    const config = read('nuxt.config.ts')
    expect(config).not.toMatch(/frame-src/)
    expect(config.split("modules:")[0] + config).not.toMatch(/googletagmanager|google-analytics/i)
  })

  it('no nonce/hash work around GTM', () => {
    const code = read(COMPOSABLE)
    expect(code).not.toMatch(/setAttribute\(['"]nonce|\bnonce\s*[:=]/i)
    expect(code).not.toMatch(/createHash|\bsha\d{3}\b/i)
  })
})

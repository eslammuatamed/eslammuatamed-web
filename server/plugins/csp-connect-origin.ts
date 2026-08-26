import { useRuntimeConfig } from '#imports'
import { defineNitroPlugin } from 'nitropack/runtime'
import type { NuxtSecurityRouteRules } from 'nuxt-security'
import { apiOriginFromEnv } from '../../config/api-origin'

/**
 * Completes the static CSP `connect-src` policy with the LIVE runtime API origin (FE4-U2e1).
 *
 * WHY THIS EXISTS. Hosts are injected per environment at runtime (D23-8): CI builds bake a
 * PLACEHOLDER `NUXT_PUBLIC_API_BASE` (ci.yml:74-77), while ci-preview / the E2E lanes re-inject the
 * fixture origin when the Nitro server starts. The browser follows the SAME value — client-side
 * navigation fetches go straight to `${apiBase}` — so a build-time-only `connect-src` would block
 * every preview/E2E data fetch. Production is unaffected either way: there the runtime origin equals
 * the baked one and the Set below dedupes it.
 *
 * HOW IT HOOKS IN — a nuxt-security lifecycle event ONLY, never its nonce/header pipeline.
 * `nuxt-security:routeRules` is emitted by the module's own 00-routeRules setup with the resolved
 * global rule registry, after that registry has been populated and before any request resolves it;
 * listening there is ordering-proof by construction (the direct-call variant of this plugin was
 * tried first and measurably raced the module's listener registration). The mutation appends the
 * runtime origin to the EXISTING `connect-src` sources and deduplicates, so the declared build-time
 * policy is completed, not replaced or weakened.
 *
 * WHAT THIS IS NOT. No nonce generation, no nonce stamping, no HTML parsing, no framework-script
 * hashing, no header writing outside nuxt-security's own pipeline. Ownership of the CSP stays
 * entirely with the module; this file only feeds it one runtime fact.
 */
export default defineNitroPlugin((nitroApp) => {
  const { apiBase } = useRuntimeConfig().public
  const runtimeOrigin = apiOriginFromEnv({ NUXT_PUBLIC_API_BASE: apiBase })

  nitroApp.hooks.hook('nuxt-security:routeRules', (rules: Record<string, NuxtSecurityRouteRules | undefined>) => {
    const csp = rules['/**']?.headers?.contentSecurityPolicy
    if (!csp || typeof csp === 'string') return

    const existing = csp['connect-src']
    if (existing === false) return
    const sources = Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : []
    csp['connect-src'] = [...new Set([...sources, runtimeOrigin])]
  })
})

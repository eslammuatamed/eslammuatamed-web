import { isEligibleGtmContainerId } from '~/utils/gtm-container'

/**
 * Public-only GTM registration through @nuxt/scripts' official registry integration (FE4-U2e2).
 *
 * OWNERSHIP. Called from exactly ONE place — `PublicGtmRuntime.client.vue`, the lazy client-only
 * boundary rendered by the persistent PUBLIC shell that already owns the awaited Settings read. The
 * dashboard and auth layouts never render that boundary, so those shells can never register a loader
 * regardless of what Settings contains.
 *
 * ID SEMANTICS — SNAPSHOT AT SETUP, DELIBERATELY. The decision reads the Settings value ONCE when
 * the public layout mounts:
 *   - null / malformed → this function returns before any script machinery exists;
 *   - valid            → registered once; @nuxt/scripts keys the registry entry, so SPA and locale
 *                        navigations cannot duplicate it.
 * A mid-session Settings flip (valid → null) therefore does NOT tear down an already-loaded
 * container: third-party JS cannot meaningfully be unloaded, and building a custom removal mechanism
 * would be exactly the dangerous invention this unit forbids. The backend kill switch governs FUTURE
 * document/session initialization; guaranteeing removal from an ALREADY-LOADED session requires a
 * full reload. The reverse transition (null → valid mid-session) likewise does not inject a loader
 * into a running session — no custom reinjection exists.
 *
 * CSP. No per-script nonce is added and none is needed: under nuxt-security's `'strict-dynamic'` policy
 * the loader script inserted by the trusted, nonced Nuxt entry inherits execution trust (proven in
 * U2e0.1's combined spike and re-proven by e2e/gtm). First-party bundling stays OFF for v1
 * (`bundle: false`) — build-time third-party retrieval, extra deploy/cache surface,
 * and no material CSP benefit are all recorded in D19-15.
 *
 * CONSENT. Google Consent Mode v2 defaults fire BEFORE the container loads and deny every storage /
 * personalization signal. Nothing here grants consent; a future CMP calls the module-native
 * `consent.update()` on the context this composable hands back to its caller if one is ever needed.
 *
 * PAGEVIEWS. Deliberately NOT wired: there is no application requirement that the frontend own SPA
 * page-view pushes. Page-view taxonomy belongs to the GTM container configuration (a History Change
 * trigger), which operators control without frontend deploys.
 */
export function usePublicGtm(containerId: string | null | undefined): void {
  if (!isEligibleGtmContainerId(containerId)) return

  useScriptGoogleTagManager({
    id: containerId,
    defaultConsent: {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    },
    scriptOptions: {
      trigger: 'onNuxtReady',
      bundle: false
    }
  })
}

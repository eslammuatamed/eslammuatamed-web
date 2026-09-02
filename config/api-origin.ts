/**
 * The API ORIGIN for the CSP `connect-src` policy, derived from the same environment variable the
 * application already consumes at runtime (`NUXT_PUBLIC_API_BASE`, doc 16 §1 / D23-8).
 *
 * WHY A SHARED MODULE. The origin is needed in exactly two places that must never disagree:
 * `nuxt.config.ts` bakes it into the static policy, and `server/plugins/csp-connect-origin.ts`
 * completes the policy with the RUNTIME value of the same variable (CI builds bake placeholder
 * hosts by design while preview/E2E injects the fixture origin at runtime). One resolver feeds both,
 * so the two cannot drift.
 *
 * FALLBACK IS THE PRODUCTION ORIGIN, deliberately: an unset variable at build time must produce a
 * policy at least as strict as production's, never a weaker local one. An unparseable value falls
 * back the same way — a malformed API base is a deployment bug that should not silently weaken the
 * CSP; `useApi()` will surface the broken base where it is actually consumed.
 */

/** The production API origin (deploy.yml builds export this; see doc 23 §5). */
export const PRODUCTION_API_ORIGIN = 'https://api.eslammuatamed.com'

export function apiOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.NUXT_PUBLIC_API_BASE
  if (!raw) return PRODUCTION_API_ORIGIN
  try {
    return new URL(raw).origin
  } catch {
    return PRODUCTION_API_ORIGIN
  }
}

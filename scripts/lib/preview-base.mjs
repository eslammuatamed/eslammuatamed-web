/**
 * ONE source of truth for "which port is the preview on, and what URL reaches it".
 *
 * This exists because the two facts were derived independently and drifted. `ci-preview.mjs` starts
 * Nitro on `CI_PREVIEW_PORT`, while `check-route-size.mjs` — which STARTS that very process — read
 * its measurement base from a separately-defaulted `http://127.0.0.1:3000`. In the default case they
 * agreed, so nothing showed. In any worktree using a non-default port block (which is how this
 * program runs parallel agents at all) the gate booted a server on one port and measured another,
 * and reported `MEASUREMENT FAILURE … / could not be fetched: fetch failed` — a pipeline fault
 * wearing the costume of a missing route. Measured on the Wave-1 résumé worktree at 6010.
 *
 * The fix is structural rather than a corrected constant: the base is DERIVED from the port, and
 * both callers derive from here, so the two cannot disagree again without this file changing.
 *
 * A NOTE ON PORT VALUES, learned the same afternoon. Chromium refuses to navigate to its restricted
 * ports and fails with `net::ERR_UNSAFE_PORT` before any request is made — 6000 (X11) is on that
 * list, and an entire e2e lane was assigned it (84 failed / 16 passed; the 16 were on another port).
 * That is not this module's job to police — a backend/mock port is never browsed and 6000 is
 * perfectly legal for one — but any port a BROWSER will visit must be checked against that list.
 */

/** The port `ci-preview.mjs` serves the built app on. */
export function resolvePreviewPort(env = process.env) {
  return env.CI_PREVIEW_PORT ?? '3000'
}

/** The port the preview's upstream backend (Prism or a scenario server) listens on. */
export function resolveMockPort(env = process.env) {
  return env.CI_MOCK_PORT ?? '3001'
}

/**
 * The origin to fetch the preview at.
 *
 * `ROUTE_SIZE_BASE` still wins, and deliberately: it is how a caller points the gate at a server
 * this process did not start (a remote preview, or a deliberately dead port in the gate's own
 * failure-path tests). Absent that, the base follows the port.
 */
export function resolvePreviewBase(env = process.env) {
  return env.ROUTE_SIZE_BASE ?? `http://127.0.0.1:${resolvePreviewPort(env)}`
}

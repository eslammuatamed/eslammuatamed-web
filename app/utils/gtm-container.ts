/**
 * The GTM container-id eligibility guard (FE4-U2e2).
 *
 * The pattern is the BACKEND's publication contract (`/^GTM-[A-Z0-9]{4,12}$/`), mirrored verbatim
 * as a narrow defensive rendering guard. The public Settings DTO already encodes the kill switch:
 * the backend only ever publishes a NON-null `gtmContainerId` when analytics is enabled AND the id
 * was valid at write time. This guard exists so a malformed value that somehow reaches the frontend
 * fails CLOSED — zero GTM load, and the value is never interpolated into a URL or script.
 *
 * Deliberately NOT stricter than the backend: inventing a narrower format here would silently
 * disable containers the backend legitimately accepts, splitting one contract into two truths.
 */
const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/

export function isEligibleGtmContainerId(id: unknown): id is string {
  return typeof id === 'string' && GTM_CONTAINER_ID_PATTERN.test(id)
}

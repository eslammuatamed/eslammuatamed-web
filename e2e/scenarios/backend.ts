/**
 * Shared constants for the `ssr-scenarios` Playwright project.
 *
 * The scenario selectors are imported from the backend's own fixtures rather than retyped here, so a
 * renamed slug or technology id cannot leave the tests asserting against a scenario that no longer
 * exists — it fails to compile instead (`npm run typecheck:e2e`).
 */
export { ARTICLE_SLUG, SLUG, TECHNOLOGY } from '../../scripts/e2e/fixtures.ts'

/**
 * The scenario backend's own origin, for asserting UPSTREAM preconditions directly.
 *
 * Some requirements are about what the upstream said before the page reacted — "the initial lookup
 * returns 404 and redirect resolution also misses". Reading that from the rendered page alone would
 * be inference; asking the backend the same question the SSR request asked makes it observed. Must
 * match `CI_SCENARIO_MOCK_PORT` in `playwright.config.ts`.
 */
export const SCENARIO_API = `http://127.0.0.1:${process.env.CI_SCENARIO_MOCK_PORT ?? 3101}/api/v1`

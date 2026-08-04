import { defineVitestConfig } from '@nuxt/test-utils/config'
import { configDefaults } from 'vitest/config'

// Pure unit tests run in the default node environment; component tests opt into the Nuxt
// runtime with a `// @vitest-environment nuxt` header (doc 18 §3).
export default defineVitestConfig({
  test: {
    // `e2e/` belongs to Playwright, not Vitest (doc 18 §3 — two distinct layers). Both runners claim
    // `**/*.spec.ts` by default, so without this exclusion Vitest collects the Playwright specs and
    // fails them with "Playwright Test did not expect test.describe() to be called here" — a runner
    // collision, not a real defect. Spreading `configDefaults.exclude` keeps node_modules/dist/etc.
    // `e2e-race/**` is excluded for the same reason as `e2e/**`: both hold Playwright specs, and
    // Vitest collecting one raises "test() was not expected here" rather than any real defect.
    exclude: [...configDefaults.exclude, 'e2e/**', 'e2e-race/**'],
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom'
      }
    }
  }
})

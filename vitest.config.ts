import { defineVitestConfig } from '@nuxt/test-utils/config'

// Pure unit tests run in the default node environment; component tests opt into the Nuxt
// runtime with a `// @vitest-environment nuxt` header (doc 18 §3).
export default defineVitestConfig({
  test: {
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom'
      }
    }
  }
})

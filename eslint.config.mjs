// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // Two-worlds import boundary (D06-1) + the "no Axios" hard rule (constitution rule 3). This
    // applies to the public/shared surface only — dashboard files are excluded, so dashboard code
    // may freely import its own modules. Auto-imported dashboard *components* cannot be seen by
    // no-restricted-imports; they are caught in the built output by scripts/check-forbidden-modules.mjs
    // (run in CI), so the two guards are complementary.
    name: 'eslammuatamed/boundaries',
    files: ['app/**/*.{ts,vue,mjs}'],
    ignores: ['app/**/dashboard/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'axios', message: 'No Axios — all API traffic goes through useApi() (constitution rule 3).' }
        ],
        patterns: [
          {
            group: ['**/dashboard/**', '#components/dashboard/**'],
            message: 'Public code must not import dashboard-only modules — the dashboard is a segregated client-only world (D06-1).'
          }
        ]
      }]
    }
  },
  {
    // Constitution rule 3 / doc 15 §2: all backend-API traffic goes through useApi(); raw `$fetch`
    // or `useFetch` against the API is a defect. Applies to the whole app (the dashboard calls the
    // API too), with useApi.ts as the one sanctioned caller. Internal Nitro routes (`/api/*`, e.g.
    // ContentProse → `/api/prose`) are exempt via a targeted disable citing this rule.
    name: 'eslammuatamed/no-raw-api-fetch',
    files: ['app/**/*.{ts,vue,mjs}'],
    ignores: ['app/composables/useApi.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.name='$fetch']",
          message: 'No raw $fetch to the backend API — route it through useApi() (constitution rule 3, doc 15 §2). Internal Nitro routes (/api/*) are exempt: disable this line with a doc 15 §2 note.'
        },
        {
          selector: "CallExpression[callee.name='useFetch']",
          message: 'No raw useFetch to the backend API — call useApi() inside useAsyncData (constitution rule 3, doc 15 §2).'
        }
      ]
    }
  }
)

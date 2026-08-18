// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

/**
 * The `no-restricted-syntax` entries that apply to EVERY app file, extracted so they can be spread
 * into more than one config block.
 *
 * ESLint flat config does not merge two blocks' `no-restricted-syntax` arrays — the later block
 * REPLACES the rule for the files it matches. So a second block that adds a dashboard-only selector
 * would silently switch the API-fetch guard OFF for dashboard files, which are exactly the files
 * that talk to the admin API most. Spreading a shared list makes that impossible to do by accident.
 */
const API_FETCH_RESTRICTIONS = [
  {
    selector: "CallExpression[callee.name='$fetch']",
    message: 'No raw $fetch to the backend API — route it through useApi() (constitution rule 3, doc 15 §2). Internal Nitro routes (/api/*) are exempt: disable this line with a doc 15 §2 note.'
  },
  {
    selector: "CallExpression[callee.name='useFetch']",
    message: 'No raw useFetch to the backend API — call useApi() inside useAsyncData (constitution rule 3, doc 15 §2).'
  }
]

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
      'no-restricted-syntax': ['error', ...API_FETCH_RESTRICTIONS]
    }
  },
  {
    /**
     * Dashboard localization boundary (D02-15 / D11-8, owner decision OD-11).
     *
     * The dashboard has its own application locale, persisted as a preference and deliberately NOT
     * in the URL (D04-7). `useI18n()` resolves against the ROUTE-derived locale, which on an
     * unprefixed `/dashboard/**` route is always `en`. So a dashboard surface that calls it renders
     * ENGLISH inside an Arabic dashboard.
     *
     * THAT FAILURE IS SILENT — no error, no warning, nothing for `vue-tsc` to catch, and it looks
     * identical to a translation nobody has written yet. It is the single most likely way this
     * architecture rots as modules are added in FE-3/FE-4, which is why it is a lint error and not a
     * convention. `useDashboardI18n()` is the one sanctioned caller and disables this rule on its own
     * line, with the reason.
     *
     * SCOPED BY SURFACE, not by directory, because two of the files are layouts and would otherwise
     * be missed: `app/layouts/{dashboard,auth}.vue` are dashboard chrome that does not live under a
     * `dashboard/` path.
     */
    name: 'eslammuatamed/dashboard-localization',
    files: [
      'app/pages/dashboard/**/*.vue',
      'app/components/dashboard/**/*.vue',
      'app/layouts/dashboard.vue',
      'app/layouts/auth.vue'
    ],
    ignores: ['app/**/*.spec.ts'],
    rules: {
      // Re-stated, not merged: see API_FETCH_RESTRICTIONS. Dropping the spread here would disable
      // the raw-fetch guard for every dashboard file.
      'no-restricted-syntax': ['error',
        ...API_FETCH_RESTRICTIONS,
        {
          selector: "CallExpression[callee.name='useI18n']",
          message: 'Dashboard surfaces must translate through useDashboardI18n(), not useI18n(). useI18n() resolves the ROUTE locale, which is always `en` on an unprefixed dashboard route (D04-7) — it renders English inside an Arabic dashboard, silently (D02-15, D11-8).'
        }
      ]
    }
  }
)

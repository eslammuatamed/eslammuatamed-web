# Campaign 026 — Tasks

**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](plan.md)
Status vocabulary: **TODO** · **DOING** · **DONE** · **DEFERRED** (evidence + reopen condition) ·
**GATED** (blocked on an owner decision).

---

## Phase 0 — Recovery, SpecKit and baseline

| ID | Task | Status |
|---|---|---|
| T0.1 | Zero-trust recovery of Web SHAs, branches, worktrees, drift → ledger §1 | **DONE** |
| T0.2 | Verify the Production deployment gate live (environment + protection rules) → ledger §1.5 | **DONE** |
| T0.3 | Enumerate all 31 Dependabot alerts with package/GHSA/severity/first-patched → ledger §2 | **DONE** |
| T0.4 | Recover the historical Nuxt 4.5.1 experiment and its exact failure modes → ledger §3 | **DONE** |
| T0.5 | Recover Stage 2B / §14j / §14k CI evidence and correct Phase 1's scope → ledger §4 | **DONE** |
| T0.6 | Confirm `.specify/` present; write `spec.md`, `plan.md`, `tasks.md` | **DONE** |
| T0.7 | Toolchain + latest-stable inventory for the coupled Nuxt set | **DONE** |
| T0.8 | Measured baseline: build, lint, typecheck, unit, budgets, bundle guards | **DONE** — §Baseline |
| T0.9 | Measured baseline: Playwright E2E (incl. a11y, EN/AR/RTL, SSR lanes) | **DONE** — §Baseline |
| T0.10 | Measured baseline: Lighthouse (mobile + desktop, 16 governed URLs) | **DONE** — recovered from hosted run `31725112691` on the exact baseline SHA |
| T0.11 | Measured baseline: `npm audit` | **DONE** — §Baseline |
| T0.12 | Commit ledger + SpecKit; return the Phase-0 checkpoint report | **DONE** |
| T0.13 | Hosted CI pipeline baseline (per-job wall-clock) | **DONE** — 716 s total; Lighthouse mobile is 713 s of it |
| T0.14 | Build-nondeterminism check on the `size` gate | **DONE** — two independent builds both 29.99 kB gz |

**D-B1 — CLOSED.** Initially deferred to a local run; that was the wrong instrument (laptop vs
hosted is not a comparison). The authoritative baseline already existed: hosted run
**`31725112691`** on exactly `ced84902`, all jobs green, artifacts unexpired. Recorded in ledger
§7.1/§7.2. No Phase-0 item remains open.

---

## Phase 1 — CI cleanup & efficiency

| ID | Task | Status |
|---|---|---|
| T1.1 | Read backend ledger §14 / §14j / §14k in full **before** proposing anything | TODO |
| T1.2 | Measure the current Web pipeline on real hosted runs (per-job wall-clock, runner work, artifact bytes) | TODO |
| T1.3 | For each §14k candidate, write the *"what unique guarantee does this provide?"* answer | TODO |
| T1.4 | Remove the duplicate `npm run build` in `deploy.yml` (`:201` verify / `:256` deploy) without weakening the exact-SHA or provenance guarantees | TODO |
| T1.5 | Lighthouse artifact duplication ≈12 MB/run — fix the `provenance.json` walk binding root duplicates | TODO |
| T1.6 | `e2e` 70 s duplication | **DEFERRED — measured.** Lighthouse mobile is the critical path at 713 of 716 s; `e2e` has 246 s of slack, so removing all 70 s changes wall-clock by **0 s**. **Reopen condition:** `e2e` becomes the critical path |
| T1.7 | Negative-control the surviving guards: prove each still fails on a real injected defect | TODO |
| T1.8 | Before/after measured on hosted runs; confirm 4 required checks still live; ledger checkpoint | TODO |

---

## Phase 2 — Fast dead-code / dead-file / CSS cleanup

| ID | Task | Status |
|---|---|---|
| T2.1 | **Re-measure the byte cost of `nuxt` 4.5.2** (not 4.5.1) and re-derive the headroom floor. Read the **exact** byte count, not size-limit's rounded `29.99 kB`. Also resolve whether `postcss` **8.5.23** (which clears #19) actually pulls `cssnano` 8.0.5 — if not, the 62 B leaves the required headroom | TODO |
| T2.2 | Investigate whether a newer vite/lightningcss chain, or a defensible browser-targets change, stops `:dir()` downleveling. **Browser-targets change = owner decision, surface it** | TODO |
| T2.3 | Framework-aware dead-surface inventory: components, composables, utilities, pages/routes, assets, styles, scripts, config, experiment files | TODO |
| T2.4 | Dependency-level dead inventory: direct deps with no real importer | TODO |
| T2.5 | Tracked build/generated output that should not be tracked | TODO |
| T2.6 | Unused/unreachable CSS + duplicate CSS imports. ⚠ **Tailwind scans comments** — a class named in a comment emits its rule | TODO |
| T2.7 | Remove only what strong evidence proves unused; conservative around dynamic imports, auto-imports, FS routing, plugin/module discovery, class generation, runtime config, locale resources, SEO assets, test-only files | TODO |
| T2.8 | **Verify the byte target: ≥253 B gz freed on `size` (floor re-derived by T2.1), target ≥400 B** | TODO |
| T2.9 | Remeasure CSS, JS/bundles, build output, build time, tests, Lighthouse, dependency surface → new pre-Nuxt baseline | TODO |

---

## Phase 3 — Nuxt core / RB-1

| ID | Task | Status |
|---|---|---|
| T3.1 | Re-derive the target from current official sources: latest stable `nuxt`, `vue`, Nitro, TS, coupled modules, Node, migration requirements, security fixes | TODO |
| T3.2 | Apply the upgrade in the primary worktree; capture typecheck under **both** `nuxt prepare` and full `nuxt build` (the 18/12 spread is method, not flake) | TODO |
| T3.3 | Fix TS family (a): `VueSchemaOrgDefinerInput` / `DeepResolvableProperties<…>` → `Input`. **Root cause, no suppression, no `any`** | TODO |
| T3.4 | Fix TS family (b): auto-imported globals missing from component types (`CONTACT_LIMITS`, `formatFileSize`, `$router`) | TODO |
| T3.5 | Establish CSS byte **provenance**: project / module / generated / duplicate imports / framework output / dead styles / theme config | TODO |
| T3.6 | Bring CSS green at the **unchanged 30,000 B gz cap** | TODO |
| T3.7 | **F-1 — disposition alert #25 (critical, `@nuxt/devtools`, patched ≥3.3.1)**: patch it, or waive it on **built-artifact** reachability evidence (the `__nuxt_island` standard) | TODO |
| T3.8 | Verify the seven `nuxt` advisories cleared, or justify each by **runtime** evidence | TODO |
| T3.9 | Full gate re-run + SSR/hydration/console/EN/AR/RTL/a11y verification | TODO |
| T3.10 | **RB-1 closure checkpoint report** | TODO |

---

## Phase 4 — Full dependency modernization

| ID | Task | Status |
|---|---|---|
| T4.1 | Derive real compatibility batches from repository contents (not a generic taxonomy) | TODO |
| T4.2 | Per-dependency table: current / latest stable / target / evidence / result / gates / exception | TODO |
| T4.3 | Upgrade batch by batch, gates green between batches. **No single `npm update`** | TODO |
| T4.4 | **#19 `postcss`** — takeable only on Phase 2 headroom. ⚠ `cssnano` 8.0.5 rides in with it and **cannot be reverted piecemeal** | TODO |
| T4.5 | **F-2** — explicit disposition for `extract-zip` #34 and `image-size` #32/#33 (no patched version exists): reachability, replacement, or evidence-backed accepted risk | TODO |
| T4.6 | Remove dependencies proven unused | TODO |
| T4.7 | No `--legacy-peer-deps`, no arbitrary `overrides`. ⚠ **`overrides` are unscoped** — a bare entry rewrites every consumer; scope to the parent | TODO |
| T4.8 | Fresh dependency inventory · `npm audit` · GitHub alerts readback · compatibility verification | TODO |

---

## Phase 5 — Deep frontend cleanup & modernization

| ID | Task | Status |
|---|---|---|
| T5.1 | Evidence pass over the now-current codebase; every candidate gets a concrete reason | TODO |
| T5.2 | Duplication: components, composables, state, helpers | TODO |
| T5.3 | Data layer: repeated fetching, loading/error patterns, `useApi` consistency, type boundaries | TODO |
| T5.4 | Stale compatibility wrappers and obsolete Nuxt workarounds superseded by the final stack | TODO |
| T5.5 | Avoidable client-only execution; unnecessary watchers/effects | TODO |
| T5.6 | CSS architecture duplication; physical-direction CSS where logical is required (`check:logical`) | TODO |
| T5.7 | RTL consistency and accessibility issues | TODO |
| T5.8 | Performance hotspots; bundle isolation; **`/dashboard/messages` 305.6 KB gz → below the 300.0 KB gz D20-24 target** (raising the target is not an option) | TODO |
| T5.9 | Public/dashboard coupling | TODO |
| T5.10 | Stale TODOs | TODO |

---

## Phase 6 — Verification, security & performance closure

| ID | Task | Status |
|---|---|---|
| T6.1 | Derive and run the project's **actual** authoritative gates | TODO |
| T6.2 | Report under separated headings: **TEST FAMILIES / CI GUARDS / PERFORMANCE GATES / SECURITY GATES / PRODUCTION SMOKES** | TODO |
| T6.3 | Milestone comparison `BASELINE → AFTER CI → AFTER FAST CLEANUP → AFTER NUXT → AFTER DEPENDENCIES → FINAL` | TODO |
| T6.4 | Record regressions as honestly as improvements | TODO |
| T6.5 | Final security disposition for all 31 alerts (cleared / waived-with-evidence / deferred-with-reopen) | TODO |

---

## Phase 7 — Integration, promotion & Production verification

| ID | Task | Status |
|---|---|---|
| T7.1 | Integrate to `dev` by the correct D17-4 feature/fix merge method | TODO |
| T7.2 | Prove exact SHA, final diff, CI, security, performance, merge shape, Production target | TODO |
| T7.3 | `dev`→`main` promotion via the **governed true merge-commit path** (never squash, never rebase) | TODO |
| T7.4 | **STOP at the `production` environment approval — owner gate** | **GATED** |
| T7.5 | Production verification: public + dashboard routes, EN/AR/RTL, SSR, hydration, console, API journeys, security headers, cache/SWR, assets, perf routes | TODO |
| T7.6 | Required D17-4 `dev` synchronization after promotion | TODO |

---

## Phase 8 — Documentation & Arabic study closure

| ID | Task | Status |
|---|---|---|
| T8.1 | Update materially affected docs: PROJECT_GUIDE, READMEs, architecture, testing, CI/CD, security, performance, dependency strategy, roadmap, handoff, ledger | TODO |
| T8.2 | **A. Web/Nuxt Application Study Map** from the final structure, with FOUNDATION/INTERMEDIATE/ADVANCED and `Follow one real feature` | TODO |
| T8.3 | **B. Testing Study Map** from the **actual** final taxonomy, with `Learning order` and `Follow one real test journey`; separates test types from CI guards from perf/a11y gates from Production smokes | TODO |
| T8.4 | **C. Additional maps only where justified** — no files created to raise the count | TODO |
| T8.5 | Preserve historical lessons (failed Nuxt upgrade, CSS budget investigation, CI evidence) **without teaching them as current architecture** | TODO |
| T8.6 | Verify paths + anchors; **Arabic combining-mark-safe** anchor checking; negative-control the validator | TODO |
| T8.7 | `docs/group` source-driven regeneration: blast radius → pre-check → regenerate → postcheck → negative control → exact restore → deterministic second generation → byte-identical → record hashes. **Never hand-edit bundles** | TODO |
| T8.8 | Close doc 24 §2b RB-1; synchronize roadmap / ledger / handoff | TODO |
| T8.9 | Final report separating **COMPLETED / DEFERRED / OWNER-GATED / OUTSIDE CAMPAIGN / NEXT PROJECT PHASE** | TODO |

---

## Owner decisions

| ID | Decision | Status |
|---|---|---|
| **OD-26-1** | Push tag `probe/nuxt-4.5.1-experiment` (`8fee07c`) to `origin`? Only preserved artifact of the failed upgrade, currently in one local `.git`. Pushing publishes it to a **public** repo | **OPEN** |
| **OD-26-2** | *(anticipated, T2.2)* Change browser targets to stop `lightningcss` downleveling `:dir()`? Would dissolve 191 B at the root but changes supported-browser policy | not yet raised |

---

## Baseline — MEASURED at `ced84902a57006eea886dac221f94a720df603d5`

Primary worktree · Node **v24.19.0** · npm **11.17.0** · `.nvmrc` = 24 ·
`NUXT_PUBLIC_SITE_URL=https://example.com`, `NUXT_PUBLIC_API_BASE=https://example.com/api/v1`.

### Gates

| Gate | Command | Exit | Result |
|---|---|---|---|
| Build | `npm run build` | **0** | **36.51 s** wall; provenance `ced8490` tree `b45163d7aa1e` output `db3e727cde32` (1631 files); Σ 45.1 MB (14.6 MB gz) |
| Lint | `npm run lint` | **0** | clean |
| Typecheck | `npm run typecheck` | **0** | **0 errors** |
| Typecheck (e2e) | `npm run typecheck:e2e` | **0** | clean |
| Unit tests | `npm test` | **0** | **1460 passed / 1460**, 102 files, 72.77 s |
| CSS budget | `npm run size` | **0** | **29.99 kB gz / 30 kB cap** — ~10 B headroom |
| Route budgets | `npm run size:routes` | **0**¹ | budgets satisfied, **1 D20-24 warning**: `/dashboard/messages` **305.6 KB gz** (>300.0 target, ≤320.0 ceiling) |
| Forbidden modules | `npm run check:bundle` | **0** | clean |
| Logical properties | `npm run check:logical` | **0** | clean |
| Browser E2E | `npm run test:e2e` | **0** | **403 passed / 403**, **191.17 s** wall, across the 6 preview lanes (contract/prism, ssr-scenarios, about-readiness, resume-pdf, dashboard, dashboard-media, settings-count) — includes unfiltered WCAG 2.2 AA a11y, EN/AR/RTL and SSR assertions |

¹ First run exited **2 — MEASUREMENT FAILURE** (stale `.bundle-analysis`: 71 built-not-described,
65 described-not-built), **not** a budget breach. Green after the required
`ANALYZE_BUNDLE=1 npm run build`. Recorded because the raw exit code is misleading on its own.

### Security

| Item | Value |
|---|---|
| Dependabot open alerts | **31** — **1 critical** / 21 high / 7 medium / 2 low (full table in ledger §2) |
| `npm audit` | **20 total** — **0 critical** / 9 high / 8 moderate / 3 low |

**F-4 (new, MEASURED) — the two security instruments disagree, and neither alone is sufficient.**
Dependabot reports **31** open alerts including **1 critical**; `npm audit` on the same lockfile
reports **20** and **0 critical**. The critical (#25 `@nuxt/devtools`, `GHSA-279x-mwfv-vcqv`) does
**not** appear in `npm audit` at all.

This matters for closure: a green `npm audit` is **not** evidence that the alerts are cleared, and
"`npm audit` is clean" must never be reported as the campaign's security result. Both instruments
are read at every security checkpoint, and the **delta between them is itself reported**. Explaining
the cause of the divergence (advisory-database scope vs. dependency-tree resolution) is part of
T6.5, not an assumption to make now.

### Method note recorded against this baseline

The first build attempt was piped to `tail`, which reported **exit 0 while the build had actually
failed** on the `site-url` guard (missing `NUXT_PUBLIC_SITE_URL`). Re-run with `set -o pipefail`
and the CI-matching env. This is why the standing rules forbid piping a gate without `pipefail`.

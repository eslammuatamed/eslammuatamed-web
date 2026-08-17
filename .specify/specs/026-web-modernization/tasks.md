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
| T1.1 | Read backend ledger §14 / §14j / §14k in full **before** proposing anything | **DONE** — none of §14j's four rejected candidates re-proposed |
| T1.2 | Measure the current Web pipeline on real hosted runs | **DONE** — run `31725112691`: 716 s total; step-level breakdown in ledger §10.3 |
| T1.3 | For each §14k candidate, write the *"what unique guarantee does this provide?"* answer | **DONE** — ledger §10.2 |
| T1.4 | Remove the duplicate `npm run build` in `deploy.yml` | **REJECTED — evidence.** Not duplication: `verify` bakes `example.com` (unshippable), `deploy` bakes the real origin. And `verify` is the **only** verification of the promoted SHA (`ci.yml` has no `push: main`; promotions are true merge commits). Removing it would ship an unverified SHA |
| T1.5 | Lighthouse artifact duplication ≈12 MB/run | **REJECTED — cost/benefit.** Costs ~3 s and **$0** (Actions storage is free on public repos); the fix requires changing the governed `provenance.json` walk |
| T1.6 | `e2e` 70 s duplication | **DEFERRED — measured.** Lighthouse mobile is the critical path at 713 of 716 s; `e2e` has 246 s of slack, so removing all 70 s changes wall-clock by **0 s**. **Reopen condition:** `e2e` becomes the critical path |
| T1.7 | Negative-control the surviving guards | **N/A** — no guard modified or removed; Stage 2B's §14l negative control still describes the live workflows. The *no-change* claim itself was controlled both ways (ledger §10.6) |
| T1.9 | **F-6 — add `size` + `size:routes` to `deploy.yml`'s `verify`** | **DONE 2026-08-16 (`38edaa2`)** — ledger §14.8. `verify` builds with `ANALYZE_BUNDLE=1` then runs `size` and `size:routes`, mirroring `ci.yml` verbatim. Proven from the literal YAML: **no `continue-on-error`** at job or step level, `deploy` still `needs: verify`, job **name unchanged** so no check-name binding is dropped. No budget moved, no step relaxed. Live negative control: `npm run size` exits 1 on this branch, so the step fails rather than decorating |
| T1.8 | Before/after; 4 required checks live; ledger checkpoint | **DONE** — no "after" exists (zero workflow bytes changed, proven by blob hash + negative control); 4 required checks untouched; ledger §10 |

---

## Phase 2 — Fast dead-code / dead-file / CSS cleanup

| ID | Task | Status |
|---|---|---|
| T2.1 | **Re-measure the byte cost of `nuxt` 4.5.2** and re-derive the headroom floor | **DONE** — ledger §12.3. Exact baseline **29,991 B**, cap **30,000 B**, **headroom = 9 B**. Instrument proven (2 identical clean builds; negative control +1,620 B → gate fails loud; closing restoration control back to 29,991). Seven states measured in one directory. **`postcss@8.5.23` costs +0 B — byte-identical, alert #19 is FREE.** `cssnano` 8.0.5 = **+71 B** (mechanism proven: 0 vs 127 `", "` occurrences, exactly 127 raw B). Nuxt-only = **+185 B**. `lightningcss` stays 1.32.0 so the 191 B `:dir()` cost **does not occur**. Best achievable 4.5.2 = **+266 B** (state F). ⚠ §3.3's attribution was **inverted**: `cssnano` peer-requires `postcss ^8.5.26`, so cssnano drags postcss — and cssnano is a `@nuxt/vite-builder` dep, i.e. **Nuxt-coupled, not Nuxt-independent** |
| **T2.1b** | *(new)* **Nuxt 4.5.2 cannot be installed incrementally** — it adds a required peer `rolldown@~1.2.1`; the tree hoists `rolldown@1.1.5`. Three incremental paths all ERESOLVE; only a full lockfile re-resolve succeeds, which moves **448 packages**. State F proves the drift is constrainable to +266 B by **direct pins**, with no `overrides` and no `--legacy-peer-deps` | **DONE** — ledger §12.3.5. Phase 3 scope fact |
| T2.2 | Investigate browser targets / newer vite-lightningcss chain vs `:dir()` downleveling | **DEFERRED to Phase 3** — the premise changed: `lightningcss` stays **1.32.0** in every 4.5.2 state, so `:dir()` downleveling is **not** a current cost. Would still be **OD-26-2** if pursued for other gains |
| T2.3 | Framework-aware dead-surface inventory | **DONE — 0 dead of 47 components**, positive- **and** negative-controlled (the scanner **failed** its first positive control: `git ls-files` omits untracked files; fixed, then re-controlled). **No dead markup exists.** Ledger §12.4.1 |
| T2.4 | Dependency-level dead inventory | **DONE — nothing removable.** 17 × `@tiptap/*` have zero imports but are **governed declared-ahead-of-use** (`PROJECT_GUIDE.md:47`, D06-5, Feature 002 Not started). `@lhci/cli`, `@size-limit/file`, `@types/markdown-it` are config/CLI/type-only false positives. Ledger §12.4.2 |
| T2.5 | Tracked build/generated output | **DONE — none.** `config/bundle-analysis.ts` is hand-authored config, not emitted output |
| T2.6 | Unused/unreachable CSS + duplicate CSS imports | **DONE — none removable.** The 12 "unused" classes are Vue `<Transition>` **runtime-generated** names, all three live (`DataLoadingOverlay.vue:20`, `BackToTop.vue:29`, `page-transition.ts:36`). `main.css`'s 9 `@import`s are all distinct. Ledger §12.4.2 |
| T2.7 | Remove only what strong evidence proves unused | **DONE — nothing met the standard; zero deletions.** ~30 prod-unreferenced exported symbols across 18 files are inventoried and **deliberately not actioned**: mostly TS types (0 byte gain, erased at build), and removing them is the "refactor merely to save bytes" Phase 2 forbids. **Recorded as Phase 5 input.** Ledger §12.4.3 |
| T2.8 | **Verify the byte target** | **RE-DERIVED, NOT MET — this is the Phase 2 blocker.** Target is **≥ 257 B** (not 253 B): `30,257 − 30,000`. Margin ≥ 300 B; ≥ 400 B to absorb the ~81 B unattributed residual. **Safe dead CSS available = 0 B.** Shortfall **257 B**. Cap NOT raised, no budget moved, no visible/RTL/a11y styling deleted. Ledger §12.6 |
| T2.9 | Remeasure → new pre-Nuxt baseline | **DONE — unchanged, and that is the point.** Zero application bytes changed, so the pre-Nuxt baseline **is** the Phase-0 baseline: CSS **29,991 B**, gates green (§12.7). Font budget untouched **by construction** — no `@fontsource*`, `@font-face`, `unicode-range` or font `@import` touched (1,040 B headroom, hosted-Lighthouse-only, not locally measurable) |


---

## Phase 3 — Nuxt core / RB-1

| ID | Task | Status |
|---|---|---|
| T3.1 | Re-derive the target from current official sources | **DONE** — ledger §14.1. `nuxt` **4.5.2** (latest; all seven RB-1 advisories `first_patched 4.5.1`), `vue` **^3.5.41** and `vue-router` **^5.2.0** (4.5.2's own declared deps), `@nuxt/ui` **^4.10.0** (compatibility-forced, §14.6), node engine floor **>=24.11.0** (4.5.2's `engines`). T2.1b's ERESOLVE reproduced exactly; full re-resolve only, no `--legacy-peer-deps`, no `overrides` |
| T3.2 | Apply the upgrade in the primary worktree; capture typecheck under **both** methods | **DONE** — applied at `58c0cc0`/`86f5610`. Typecheck run both **after a clean install** (`nuxt prepare` via `postinstall`) **and after a full `nuxt build`**: **7 errors both orderings**, so the historical 18-vs-12 spread does not recur. ⚠ `nuxt typecheck` regenerates types itself, so these are two orderings rather than two provably distinct generation paths. Four tree states measured in one directory (§14.2) |
| T3.3 | Fix TS family (a) | **DONE (Web `21ce915`). `nuxt typecheck` exit 0, 0 errors — was 7.** Resolved by **one `computed()` per NODE**, a form §14.7 had not isolated: `UseSchemaOrgInput` is `Arrayable<MaybeRef<…>>`, so the ARRAY may hold refs but is not itself one. Both §14.7 refutations stand, and the `computed()` one is now **MEASURED rather than inferred** — on server-rendered HTML the whole-list ref emits `knowsAbout: []` while `sameAs` stays 3, because one source is awaited and the other deliberately is not. No `any`, no casts, no `@ts-ignore`/`@ts-expect-error`, no SSR-unsafe shortcut. Verified on every affected route in both locales. One test mock updated to resolve refs (what the real pipeline does); its assertions are unchanged and it was negative-controlled. Ledger §16.2–§16.6 |
| T3.4 | Fix TS family (b): auto-imported globals | **DONE — DID NOT REPRODUCE.** `CONTACT_LIMITS`, `formatFileSize` and `$router` produce **zero** errors under 4.5.2. Resolved upstream, not fixed here (§14.7) |
| T3.5 | Establish CSS byte **provenance** | **DONE — measured per cause** (§14.3): Nuxt core **+266 B**, `@nuxt/ui` 4.10.0 **+379 B**, Phase 3 total **+645 B** (30,636 B). Remaining in-range ecosystem **+53 B** left to Phase 4. Both Phase 2 predictions (+266 B state F, ~30,689 B B_fresh) confirmed **to the byte**; §13.6's inferred-by-subtraction 432 B is now measured and split |
| T3.6 | CSS treatment under OD-26-4 | **DONE as revised.** Exact CSS measured after each dependency group and attributed per cause (§14.3): **30,636 B / 30,000 B = +645 B**, recorded as **KNOWN TEMPORARY CAMPAIGN REGRESSION**. No CSS cleanup performed, cap unchanged, CI not weakened. ⚠ `size:routes` also went red — **that is NOT covered by OD-26-4** and is raised as **F-7 / OD-26-5**, not carried |
| T3.7 | **F-1 — disposition alert #25** | **DONE — CLEARED BY PATCH, no waiver needed.** `nuxt@4.5.2` depends on `@nuxt/devtools ^3.4.1`; resolved **3.4.1** ≥ patched **3.3.1**. The built-artifact reachability argument was never required (§14.5) |
| T3.8 | Verify the seven `nuxt` advisories cleared | **DONE — all seven cleared by version** (4.5.2 ≥ 4.5.1), read from resolved lockfile versions because Dependabot scans `main` (F-5) and `npm audit` omits the critical (F-4). `postcss` 8.5.26 clears #19 as well. Six more incidentally cleared, recorded not claimed; Phase 4 owns their disposition (§14.5) |
| T3.9 | Full gate re-run + SSR/hydration/console/EN/AR/RTL/a11y verification | **PARTIAL — 399/403 e2e** (baseline 403/403), 3.2 m vs 191 s baseline. `@nuxt/ui` 4.9.0 first produced **82** failures (§14.6, fixed by 4.10.0); `typecheck:e2e` was red with **28** errors from a split `playwright-core` (fixed at `226225f`). **4 residual failures, all recorded, none fixed** (§15.1). Unit **1460/1460**. `npm ci` and the api-types idempotence step both exercised, both **0**. `/projects` verified hydrating clean in a real browser — **zero** console errors or warnings |
| F-8 | Residual e2e failures | **3 of 4 FIXED (Web `5855123`), all 4 CLASSIFIED.** #1/#2/#3 — plus `experience-states.spec.ts:90`, which §15.1 never listed — are ONE **(c) test-harness** class: interactions driven before hydration, so a `@click` toggle does nothing and a `<form>` submit falls through to the browser's own native POST. Gated on a real completion signal (`__vue_app__`) via a shared `e2e/hydration.ts`; nothing skipped, retried, quarantined or slept. ⚠ **"Four failures" was a load-dependent SAMPLE, not a set** — ungated, `contact-submission.spec.ts` fails **10 of 18**. No assertion and no app source changed. Ledger §16.9 |
| F-10 | `/` renders twice under 4.5.2 | **ROOT-CAUSED, NOT FIXED — blocks Phase 3 closure.** `settings-dedupe.spec.ts:116` reads 2 live `/settings/site` renders where the contract is 1. **(a) real compatibility regression** — the spec passes **8/8** on `nuxt` 4.4.8, so it is attributable to the transition. Mechanism measured: the browser requests `/_payload.json` for the route it is ALREADY on, which triggers a second uncached server render of `/` that re-reads the API. The request-scoped dedupe is **working as designed** — it is keyed by `NuxtApp`, and this is a second render. `'/': { swr: 60 }` does not match `/_payload.json` on either version. Test NOT relaxed: the app really does render twice. Both candidate remedies (a payload route rule that would pin a failed render for 60 s; `payloadExtraction: false`) are **owner decisions**. Ledger §16.10 |
| F-10 | `/` rendered twice under 4.5.2 | **CLOSED by OD-26-6 (Web `a6159f6`).** `experimental.payloadExtraction: 'client'` applied — an owner-approved **intentional governed rendering change**, selected for correctness. Self-referential payload preload links **0 on every route** (was 1 per cache-ruled route); `settings-dedupe` passes. **Budget-neutral, measured:** `size` and every `size:routes` figure byte-identical, app-owned bytes identical. Hosted CI `31965398396` @ `a6159f6`: **E2E 403/403**, **Lighthouse mobile + desktop PASS** (a11y/BP/SEO 100 on all 16 URLs). Ledger §17-§18 |
| F-11 | NuxtLink prefetch amplification | **DISPOSITIONED — B. PHASE-5 OPTIMIZATION.** Real and wasteful, not a correctness/security blocker, **not** a Phase-3 regression: measured identically on `nuxt` **4.4.8**. Driver is the always-present chrome (a "header tax"), not page link density — `/experience` costs the same as `/`. Cold `/` = 5 live renders; `prefetch-on="interaction"` = **1** while keeping the click free (0 extra renders, 86 ms); `no-prefetch` = 1 but costs **+1 render** and 131 ms on the click. Warm cache = **0**. ⚠ Phase 5 must first measure a **real touch interaction** — the 86 ms came from a Playwright click that hovers first, and there is no hover on touch. Self-links (LangToggle active segment, pagination active page) are pure waste under any policy. **Global prefetch NOT to be disabled.** Ledger §19 |
| T3.10 | **RB-1 closure checkpoint report** | **DONE as a checkpoint, NOT as closure.** Phase 3 does **not** claim `NUXT SECURITY/COMPATIBILITY IMPLEMENTATION COMPLETE`: `typecheck` is red (T3.3), `size:routes` is red (**OD-26-5**, open) and 4 e2e tests regress. Ledger §14–§15 |

---

## Phase 4 — Full dependency modernization

| ID | Task | Status |
|---|---|---|
| T4.1 | Derive real compatibility batches from repository contents (not a generic taxonomy) | **DONE** — batches derived from the real graph, not a taxonomy (ledger §21). 58 direct deps (37+21). Grouping is by SHIPPED-BYTE RISK: zero-byte tooling / static assets / CSS generator / i18n / SSR-only / state / interlocked peers |
| T4.2 | Per-dependency table: current / latest stable / target / evidence / result / gates / exception | **DONE** — ledger §23.5 carries the full **58-package OWNERSHIP RECORD** (package / classification / anchor / selected / latest standalone / compatibility authority / disposition), classified NUXT ECOSYSTEM **29** · OTHER ECOSYSTEM **14** · INDEPENDENT **15**. **56 adopted at latest supported · 2 final exceptions · 0 removed.** Only two rows diverge from "latest published", and both are the exceptions |
| T4.3 | Upgrade batch by batch, gates green between batches. **No single `npm update`** | **DONE** — G1 `7bf46c3` · G2 `d5766e1` · G3 `40b7a2f` · **G4 `1fa870b` (i18n 10.6.0)** · **G5 `7e25f21` (range hygiene)** · **G6 `9b031fe` (pinia 4)** · **G7 `894e08d` (shiki 4.4.3)** · **G8 `cf6910c` (tiptap ×17)**. Gates green between every batch. **No single `npm update` at any point**; each batch measured alone in ONE directory. Ledger §23.1 carries the cumulative table |
| T4.4 | **#19 `postcss`** — premise corrected in T2.1: `postcss@8.5.23` clears #19 at **+0 B** (byte-identical), so it was never gated on Phase 2 headroom, and the direction was inverted — **`cssnano` drags `postcss`**, never the reverse | **DONE.** #19 is cleared by the resolved `postcss` 8.5.26 that arrived with the Phase 3 Nuxt bump (§14.5), at zero byte cost. `cssnano` remains **transitive** and is not an upgrade target under §22.2; it moved 8.0.5 → **8.0.6** as pure resolution output of G8's re-resolve, costing **+87 B** by a NEW mechanism (`postcss-merge-rules` selector-list factoring: raw **−1,373 B**, gz **+87 B**), attributed by a same-directory control rebuild and a countable signature. Deliberately **not pinned back** — that would be independent management of a transitive package for bundle reasons. Carried under OD-26-5 and recorded as a quantified Phase 5 candidate. Ledger §23.4 |
| T4.5 | **F-2** — explicit disposition for `extract-zip` #34 and `image-size` #32/#33 (no patched version exists): reachability, replacement, or evidence-backed accepted risk | **DONE for the working state.** `extract-zip` confirmed unfixable (latest 2.0.1 is itself inside the vulnerable range; abandoned at that line) and reaches the tree only through `@lhci/cli`, a devDependency run as a separate process with zero application-source imports. `image-size` is **not** present in the working state's advisory set. All 20 working-state advisories are classified to their direct parent chains with reachability in ledger §23.7/§23.8. ⚠ **Final per-alert disposition of all GitHub alerts remains T6.5 (Phase 6)** and is not claimed here — Dependabot scans `main` (F-5), so it cannot see this branch |
| T4.6 | Remove dependencies proven unused | **DONE — 0 removed, and that is the correct answer.** All 17 `@tiptap/*` are **REQUIRED non-optional peers of `@nuxt/ui@4.10.0`** and cannot be removed as unused (§21.9), notwithstanding `check:bundle` proving they ship no identifiers into the 98 public chunks. Under the ownership model they are **ECOSYSTEM-OWNED / PEER-SUPPORT DIRECT** (§22.7), which is precisely the category that must not be removed for lack of an application import. No other direct dependency was proven removable |
| T4.7 | No `--legacy-peer-deps`, no arbitrary `overrides`. ⚠ **`overrides` are unscoped** — a bare entry rewrites every consumer; scope to the parent | **DONE — HELD THROUGHOUT.** Zero `--legacy-peer-deps`, zero `--force`, zero `overrides`, zero forced deduplication, zero manual lockfile surgery, zero artificial direct dependencies, zero peer coercion. Both `@tiptap/*` ERESOLVEs were resolved by the packages' **own supported mechanism** — a full re-resolve — not bypassed. Lockfile audited after every batch: **0 unexpected direct drift**, including across G8's 168-entry re-resolve (§23.4) |
| T4.8 | Fresh dependency inventory · `npm audit` · GitHub alerts readback · compatibility verification | **DONE.** Fresh inventory = the 58-package ownership record (§23.5). `npm audit` on the final tree: **20** (3 low / 6 mod / **11 high** / 0 critical) — ⚠ **UP from 17**, reported as a rise rather than as unchanged; the 3 new are one `sharp` chain surfaced by G8's re-resolve, lockfile-only and absent from a clean `npm ci` (§23.7 C). GitHub/Dependabot readback taken during the `cf6910c` push: **32 alerts (1 critical / 22 high / 7 mod / 2 low)** — ⚠ this describes **`main`, not this branch** (F-5), and must not be read as this tree's state. **F-4 holds: `npm audit` is never reported as the campaign security result.** Compatibility verified by full gates + hosted CI at the exact final SHA |
| T4.9 | **OD-26-7 — RESOLVED (owner, option A)** — adopt `@nuxtjs/i18n` **10.6.0**. Measured trade: **−112,385 B rendered/parsed JS** (locale messages leave the JS chunks) against **+1.9 KB gz transferred per route**, widening the already-breached D20-24 hard ceiling on `/dashboard/messages` 328.5 → **330.4 KB gz** (ceiling 320.0). The owner classified this as a **PERFORMANCE regression only**, an increase in the MAGNITUDE of the regression already named by OD-26-5 — **not a new tolerated class and not a budget change**. No budget raised or re-baselined. Rationale of record: do not hold a direct dependency at an older version merely to make an intermediate campaign budget look greener; all original budgets remain unchanged and must be recovered in Phase 5. Ledger §22 | **RESOLVED** |
| **T4.10** | *(new)* **Ecosystem-first convergence before transitive conclusions** — resolve each direct compatibility ecosystem to its latest mutually compatible state, then treat the transitive graph as an OUTPUT | **DONE.** Order followed: Nuxt ecosystem → Unhead re-evaluation → other coupled ecosystems → independent packages → final transitive/security review. Terminality PROVEN rather than inferred (§22.3): `npm outdated` reports registry `latest` regardless of declared range, so absence from it means installed == latest published — confirmed against dist-tags for `nuxt` (4.5.2) and `@nuxt/ui` (4.10.0), whose `alpha`/`beta`/`rc` tags point at OLDER `4.0.0-*` pre-releases |
| **T4.11** | *(new)* **Direct dependency OWNERSHIP / PROVENANCE record** — classify every direct dependency by WHY it is direct, and let the owning ecosystem drive version selection | **DONE** — ledger §22.7 + §23.5. Coupling proven from manifests, never from names: `@nuxt/ui@4.10.0` peers `@tiptap/*` at `^3` and depends at `^3.27.3`; `@iconify-json/*` couple to **`@nuxt/icon`**, not to `@nuxt/ui`, and carry **no version contract** (corroborated at build time: *"Nuxt Icon discovered local-installed 2 collections: lucide, simple-icons"*); `zod` is one of **eight alternative** schema integrations and so is NOT ecosystem-owned; `tailwindcss` is app-configured **and** ecosystem-constrained, with both authorities satisfied by 4.3.3. ⚠ The model **changed no target version** — for every ecosystem-owned package here, "latest published" and "latest supported by owning ecosystem" coincide — but it changed the recorded authority and **pre-empted a real error**: had `@nuxt/ui` capped tiptap below 3.30.1, adopting 3.30.1 would have been an upgrade beyond the supported parent range |
| **T4.12** | *(new)* **Classify the residual E2E failures precisely; no unexplained correctness failure at closure** | **DONE.** The `locale-head` failure was classified as the **F-8 pre-hydration class, not an i18n regression**, proven in BOTH directions (nondeterministic here with a shifting failing set; reproduced at baseline `4685911` on the 10.5.0 tree). Mechanism named: `LangToggle` renders a real `<a href>`, so a pre-hydration click becomes a **native document navigation**, replacing `window`. **Fixed** with the established `hydrated()` gate — nothing skipped, retried, quarantined or slept, no assertion and no app source changed. Instrument proven both ways (pre-fix 2/3 and 3/4 red; post-fix 8/8 green). ⚠ Local environment limitation recorded, **not** mutated: inotify **133–154 against a 128 ceiling** throughout, and the host was deliberately left unchanged |
| **T4.13** | *(new)* **Phase 5 input inventory** | **DONE** — ledger §23.9. 13 items, each with its measured size where one exists. CSS overage to retire = **776 B**, of which **+54 B** (Preflight) and **+87 B** (cssnano merge-rules) are concrete quantified candidates. ⚠ Two items are flagged as possibly **unrecoverable by Phase 5**: the ~52 KB Unhead duplication (upstream-owned) and i18n 10.6.0's +1.9 KB/route (not flag-gated) |


---

## Phase 5 — Comprehensive cleanup & performance recovery

⚠ **STATUS: IN PROGRESS — NOT CLOSED.** Done: **T5.A · T5.C (CSS budget GREEN) · T5.P**.
**Not started: T5.B · T5.F · T5.G · T5.H.** Everything **local-only, nothing pushed**.

⚠ **OD-26-8 is RESOLVED — the owner decided, and the resolution is D20-30** (doc 20 v1.22.0,
cross-referenced from doc 11 §3.1 v1.3.1). Campaign-side record: ledger **§24.21**; §24.20 is now
the evidence package behind it. **T5.E stays PAUSED and is NOT "done"** — `/dashboard/messages` is
**accepted as attributed, not recovered**, and no further Messages work is authorized.

⚠ **What D20-30 settled, in one line each:** D20-24's above-ceiling clause is a **precondition, not
an authorization** (doc 20 §5 has no passing exit state above 320 KB gz) · the residual breach is
**owner-reviewed and attributed to shared framework baseline growth** · **no number changed** —
`/dashboard/messages` is **still red and `size:routes` still exits 1 for it**, and it must never be
reported as green · the budget **MODEL** moves to *shared baseline + per-route allowance* with
**numeric calibration DEFERRED until after D11-8's post-campaign Dashboard UI/UX pass**.

⚠ **T5.D is a SEPARATE public-route decision and may NOT cite D20-30** — its non-precedent clause is
explicit. **Do not start T5.B/D/F/G/H.** ⚠ **§24.17's Option A/B probe recommendation stays
WITHDRAWN** — the owner rejected both remedies. Full zero-trust resume state: ledger **§24.21**.

**Phase 5 is the single cleanup/performance-recovery pass over the FINAL upgraded dependency stack**
(Phase 4 CLOSED at Web `cf6910c`; SpecKit checkpoint `8c34c8d`). It is **not** another dependency
modernization phase. Inputs are ledger §23.9 (13 items) as re-measured in §24.1.

**Re-baselined on the final Phase 4 tree (§24.1), `8c34c8d`, clean build, `ANALYZE_BUNDLE=1`, CI env
(`NUXT_PUBLIC_SITE_URL=https://example.com`).** These figures supersede any earlier number in this file.

| Hard budget | Measured | Cap | Delta |
|---|---|---|---|
| CSS (glob, `npm run size`) | **30,776 B gz** | 30,000 B | **−776 B to recover** |
| `/dashboard/messages` | **338,309 B gz (330.4 KB)** | 320.0 KB gz | **−10,629 B to recover** |
| Public routes vs D20-11 | **18 of 18 over** | 250.0 KB gz | −1.5 KB (best) … −14.6 KB (worst) |
| App-owned frozen caps | all PASS | per-route | ✓ no action required |

⚠ **CSS is two files, not one pool** (§24.1): `entry.css` **30,309 B gz** + `resume.css` **463 B gz**.
`entry.css` **alone already breaches** the 30,000 B cap by 309 B, so deleting `resume.css` outright
cannot fix the gate — **≥309 B must come from `entry.css` under every scenario**. §23.9's single
776 B pool framing is therefore refined, not replaced.

### Task groups

| ID | Task | Status |
|---|---|---|
| **T5.A** | **Re-baseline attribution on the final Phase 4 tree** — CSS/route/vendor figures re-measured, not inherited; build success asserted before any reading | **DONE** — ledger §24.1 |
| **T5.B** | ❌ NOT STARTED — Dead-code / unused-export / dependency-delivery cleanup; consume the §12.4.3 inventory (supersedes old T5.13) | TODO |
| **T5.C** | **CSS recovery to the unchanged 30,000 B cap** (supersedes old T5.11) | ✅ **DONE — BUDGET GREEN.** 30,776 B → **29,081 B, 919 B UNDER** the unchanged cap. Three changes, all in the cheapest tiers: `cssnano mergeRules:false` (−154 B, supported config) · six dead `--brand-*` tokens (−66 B, deletion) · `ui.theme.colors` narrowed to the four families in use (−1,551 B, supported config). No cap raised, re-baselined or weakened. ~1,377 B further headroom MEASURED and REJECTED (dashboard-only usage, global option). Ledger §24.9 |
| **T5.D** | **Public-route JS recovery** | ⏸ **EVIDENCE RECORDED, owner decision expected.** 18/18 over D20-11 (+1.1 KB best … +14.1 KB worst). ⚠ The **lightest** route is still over while its app-owned bytes sit at less than half the cap, and a **−1,695 B CSS win moved routes only ~0.4–0.5 KB** — clearing the worst would need ~28× the entire Phase 5 CSS recovery from a sheet already 919 B under its cap. **D20-11 is not reachable through CSS**, and app code was never the constraint. Ledger §24.6, §24.12 |
| **T5.E** | **`/dashboard/messages` recovery** | ⏸ **EVIDENCE COMPLETE → OD-26-8 OPEN. Not implemented.** Gap **+9,741 B** over the 327,680 B ceiling (**+30,221 B** over the 307,200 B target — two thresholds, not one). ⚠ **Lazy boundaries: FIRST-PAINT only is gate-gaming** (`UTable` — `ssr:false` + static-only closure means a `Lazy*` cuts the MEASURED number while the browser still downloads it). ⚠ **Interaction-gated lazy loading IS sanctioned** by the gate (`dashboard-closure.mjs:51-56`) — an earlier overbroad claim of mine, corrected in ledger §24.18. Levers worked to exhaustion (§24.19): `USlideover` dead end (the dashboard layout renders it, so it is already in every closure); `UDropdownMenu` the only survivor at **<12,945 gz**, needing a hand-rolled Lazy wrapper + sized placeholder against a governed CLS gate; no unnecessary eager work; no applicable config. Simple/supported remedies **exhausted**. Both remaining candidates are **policy-gated by D11-8**, so neither was implemented: **A** `UTable`→plain `<table>` (one consumer, only `:data`/`:columns`/`:aria-label` used; UTable stack = **54.5 %** of a 40,191 gz chunk) · **B** zod→`zod/mini` across **all four** consumers (18,776 gz chunk, 93.1 % zod; all-or-nothing). ⚠ Accepting the residual is an equally valid third option. ⚠ **REFRAMED (§24.19): the `/dashboard` shared baseline alone is 260,321 gz = 79.4 % of the ceiling and `/dashboard/projects` sits only 14,163 below it — the baseline and the D20-24 ceiling are COLLIDING, so this is an owner question about the ceiling, not a Messages defect.** ⚠ **SUPERSEDED BY LEDGER §24.20 — the D20-24 owner-decision package.** The owner **REJECTED A, B and the lazy-`UDropdownMenu` variant outright** and reframed OD-26-8 as an escalation of the **Dashboard budget MODEL**. Measured at `8067ec8` across **all eight** governed routes: **four of eight are at or past the 307,200 B target** (`/dashboard/projects` **313,517**, `/projects/{id}` **311,122**, `/projects/new` **311,050**), not two; the true all-8 shared baseline is **259,872 B = 79.3 %** of the ceiling (§24.19's 260,321 was the `/dashboard` route total); `/dashboard` grew **+30,664 B** since its accepted baseline while owning **449 B** of route-specific code, proving the growth is shared/framework, not app bloat; application code is **~4–8 %** of a route and **8/8 app-owned caps PASS**. ⚠ **D20-24's OWN text forbids both sufficient remedies** (bespoke Nuxt UI replacements; `zod/mini`) — the failure mode D20-24 was written to cure has recurred against D20-24. Recommendation: **shared baseline + per-route allowance**, **no numbers proposed**, calibration deferred until after D11-8's post-campaign Dashboard UI/UX pass. Ledger §24.16/§24.18/§24.19 remain the evidence trail; §24.20 is the decision package. ⚠ **RESOLVED 2026-08-17 by D20-30 — live record is ledger §24.21.** The owner accepted the residual as **attributed**, changing **no number**: the route stays **red at 337,421 B (reproduced at HEAD, gate exit 1, +9,741 B over the unchanged 327,680 B ceiling)** and must never be reported as green. D20-24's above-ceiling clause is a **precondition, not an authorization** (doc 20 §5 admits no passing state above the ceiling), so an explicit decision was required and D20-30 is it. **T5.E is PAUSED, not done — accepted, not recovered**; no further Messages work, no budget change, and **no precedent for T5.D**. Model recalibration deferred until after the Dashboard UI/UX pass. ⚠ New finding: **5 of 8 governed routes have no accepted baseline** (3 of them in the warning band); the gate discloses the absence instead of fabricating one, and they must be recorded **as part of** the recalibration, not before it |
| **T5.F** | ❌ NOT STARTED — Runtime / prefetch / client-delivery optimization — F-11 (§19), re-evaluated with **real touch/mobile** behaviour, not synthetic hover. Self-links (LangToggle active locale, pagination active page) are pure waste under any policy and are separable from the global-policy question. **Global prefetch is not to be disabled** | TODO |
| **T5.G** | ❌ NOT STARTED — Deep cleanup & maintainability with measurable value — duplication (components/composables/state/helpers), data layer & `useApi` consistency, stale compatibility wrappers superseded by the final stack, avoidable client-only execution, public/dashboard coupling, stale TODOs, CSS architecture duplication, RTL/a11y consistency (absorbs old T5.2–T5.7, T5.9, T5.10) | TODO |
| **T5.P** | *(owner-authorized 2026-08-17)* **Prose reading-measure correction** — `.content-prose` resolved `68ch` instead of the governed `--measure-prose`, landing outside doc 03 §3's 65–75 band in BOTH locales in opposite directions | ✅ **DONE.** EN 672→512 px, AR 544→448 px (~92/~86 → ~70/~71 chars), measured in-browser. One declaration, governed token, no route-specific workaround, `/blog/{slug}` unaffected. New `e2e/prose-measure.spec.ts` instrument-proven both ways (4 failed pre-fix at exactly 672/544; 9/9 after). Visual + RTL verified at 1280/390 in both locales. **Zero incidental CSS cost.** Classified correctness/design, NOT performance. Ledger §24.14 |
| **T5.H** | **Phase 5 hard exit gate** (supersedes old T5.12) — CSS ≤ 30,000 B · all governed public-route hard budgets · `/dashboard/messages` ≤ 320 KB gz · app-owned frozen caps · font budget · JS/bundle gates · no EN/AR/RTL regression · no a11y regression · all code/test gates green · hosted CI + hosted E2E + BOTH Lighthouse profiles green on the exact final Phase 5 SHA. **If the modernized stack cannot fit through legitimate cleanup, STOP for an owner decision — do not raise, re-baseline or weaken any budget** | TODO |

### Constraints carried into every task group

- **No budget is raised, re-baselined, weakened, or converted from hard ceiling to quality target.**
- **No unsupported dependency coercion**: no `overrides`, no forced dedupe, no lockfile patching, no
  artificial direct dependencies, no coerced peers, no vendor/generated-code patching.
- **Accessibility is not tradeable for bytes** — the Phase 4 WCAG AA alert-description contrast
  correction is preserved.
- **No CommonJS→ESM conversion** (deferred project-wide).
- No removal of SSR, locale support, or RTL semantics; no casual visual-behaviour change.
- Do not delete code merely because static scanning cannot see runtime use; do not remove support
  packages merely because the app does not import them directly.
- **Security must not knowingly worsen.** Phase 6 owns the final disposition; Phase 5 records any
  change in dependency reachability or advisory exposure.

### Learnability & maintainability constraint (owner amendment, 2026-08-17) — BINDING

⚠ **This constraint is now CONSTITUTIONAL, not campaign-local.** The owner extended it on
2026-08-17 into a permanent project policy, recorded as **doc 00 Principle 18 "Dual Purpose:
Production-Grade and Deliberately Learnable" / decision `D00-8`** (`eslammuatamed-docs`
`docs/00-engineering-principles.md`, v1.3.0), and summarized in ledger **§24.4**. Doc 00 is the
constitution every other document depends on, so Phase 5 inherits this from the top of the
precedence order — it is not a phase preference that a later phase may drop.

**⚠ THREE learning axes, not two — Testing is tracked separately** (owner, 2026-08-17; doc 00 P18):
Frontend **Mid → Strong Mid** · Backend **Junior → Mid+** · **Testing Beginner → strong practical
foundation**. Testing proficiency does **not** follow from the frontend level. **Backend is the
designated entry point for learning testing** (Jest/Nest, without DOM/reactivity/hydration noise),
and the Web study map must **not** restart generic unit-testing theory from zero. Progression to
preserve: fundamentals → Backend Jest unit → service/error-path → real-database E2E → advanced
correctness/concurrency → Frontend unit/component → Nuxt-specific → Playwright/a11y/hydration.
Ledger §24.11.

**The per-repo learning targets are normative and must not be averaged:** Backend is **junior →
at least mid-level** with a deliberate progression from simpler modules into real advanced
production concerns; Frontend is **mid-level → strong mid-level** and explicitly **not** a beginner
Vue/Nuxt course. ⚠ **"Learning codebase" does not mean "simplified codebase."**

Doc 00 P18 adds two rules Phase 5 must apply directly, beyond the amendment text below:
- **File size alone is not a refactoring trigger** — six-question test before any split.
- **Source-comment signal-to-noise**: keep non-obvious *why*, invariants, ordering requirements,
  security/correctness constraints, failure modes and warnings against attractive-but-wrong
  alternatives **in source**; move campaign history, incident chronology and `Dxx`/`Fxx`
  archaeology to the ledger or module/study documentation.


This repository is deliberately **both** a Production application **and** the codebase the owner is
using to grow from mid-level toward strong mid-level frontend. **Performance budgets must not be
recovered by introducing disproportionate code complexity.** The goal is not "every number green at
any architectural cost"; it is: remove unnecessary work, recover meaningful headroom, keep the
implementation understandable, preserve natural framework patterns, and improve maintainability
where optimization and structure naturally align.

**Order of preference — simplest supported solution that produces meaningful measurable recovery:**
deletion → narrower imports → supported Nuxt/Nuxt UI configuration → removal of unnecessary
client/runtime work → natural lazy boundaries → *only then* anything custom.

**Prohibited for a marginal win** (permitted only when the measured benefit clearly justifies the
permanent cognitive cost): abstractions created merely to save bytes · splitting a file merely
because it is large · new composables/components/helpers that do not own a coherent responsibility ·
duplicated state · synchronization machinery · manual chunking · custom caching · conditional-import
tricks · similarly non-obvious mechanisms.

⚠ **A source-file split is NOT a performance improvement unless measurement proves a delivery or
runtime change.** It may still be a valid maintainability improvement — but it must be reported as
that, honestly, and never claimed as a performance win.

**Preserve legitimate complexity when the underlying problem is genuinely complex.** Do not flatten
real production behaviour to make it beginner-friendly. Learnability comes from clear boundaries and
progression from simpler to advanced modules, **not** from reducing every advanced module to
junior-level code.

**Five questions to answer explicitly for every substantial optimization that changes structure:**

1. What responsibilities does the current unit own?
2. Are any responsibilities naturally separable?
3. Would the extraction improve comprehension and change isolation **even without a bundle win**?
4. Does the optimization make the runtime model harder to reason about?
5. Is the measured performance benefit large enough to justify the added indirection?

**Tie-break:** if two solutions satisfy correctness and performance, prefer the one with **lower
long-term cognitive load**, even when the other benchmarks slightly better.

**Named case — `app/pages/dashboard/messages.vue`** (26,320 B app-owned, the largest app module on
the route that breaches its hard ceiling): a genuine hotspot worth evaluating, but **do not split it
merely because it is large**. Determine whether page/query orchestration · message-detail interaction
state · focus-restoration & accessibility behaviour · presentation-specific UI · mutation
orchestration have **natural** boundaries that would improve maintainability and possibly create a
genuine lazy boundary. **Counter-case:** do not refactor already well-separated flows such as the
Projects editor merely because individual files are large, when their responsibility boundaries are
already coherent.

**Escalation.** If an unchanged hard budget can be recovered only by introducing materially worse
architecture *after* reasonable simple/supported remedies are exhausted, **STOP at an OWNER
DECISION** rather than contorting the code. Report: exact remaining delta · attribution and ownership ·
simple remedies already exhausted · complex remedies still available · measured benefit of each ·
permanent cognitive/maintenance cost · recommendation. The owner decides the compromise.

⚠ **Scope boundary.** Phase 5 is **not** the final Web learnability campaign. It may perform
structural refactoring only where it naturally overlaps a performance hotspot or carries strong
independent maintainability value. The comprehensive Web learnability / study-map / maintainability
review belongs **after Frontend v1**, when the remaining Dashboard and frontend architecture are done.

**Documentation duty.** Phase 5 docs must *teach the concept*, not list changes: what problem existed ·
why the chosen solution works · why simpler and more complex alternatives were rejected · what should
and should **not** be generalized from it.

### Dashboard engineering priorities (owner, 2026-08-17) — doc 11 §3.1 / D11-8, BINDING

⚠ **Dashboard routes are NOT weighted like public routes.** The Dashboard is an authenticated,
client-only, single-operator administration surface; its bytes do not reach visitors, SEO or
first-load. Normative ordering for Dashboard code: **correctness and security → maintainability and
simplicity → coherent Nuxt/Nuxt UI patterns → learnability and clear responsibility ownership →
reasonable performance → marginal bundle-size savings LAST.**

- **Prefer Nuxt UI** for forms and interaction patterns where it reduces app-owned code, duplicated
  a11y work, validation plumbing or maintenance burden.
- **Keep standard Zod.** ⚠ `zod/mini` is **not** adoptable to recover bytes on one route — two
  validation dialects cost more than the bytes. Measure for evidence; do not adopt piecemeal.
- **Prefer natural lazy boundaries** and removal of genuinely unnecessary eager work.
- ⚠ **Do not create** artificial code-splitting boundaries, duplicated state, synchronization
  machinery, custom validation plumbing, or bespoke replacements for Nuxt UI to hit a byte target.
- **A residual breach justified by legitimate feature complexity escalates to an OWNER DECISION**
  rather than degrading the architecture.

⚠ **No budget is changed.** Doc 20 §1.1/§1.2 stay authoritative; this governs *remediation approach*.
Scope includes future Dashboard features not yet given their final UI/UX pass — the Dashboard UI/UX
architecture is revisited comprehensively after Campaign 026, so premature micro-optimization that
would complicate that work is to be avoided.

### Measurement standard

Before/after evidence against the same final-stack baseline for every meaningful optimization.
Build both sides **in one directory** (cross-worktree comparison is invalid). Assert build success
and `size > 0` before trusting any reading (`size-limit` reports `passed:true, size:0` on a missing
build; `size:routes` exit 2 = stale `.bundle-analysis`, not a breach). Rebuild between any source fix
and a Playwright run. Never report a raw-byte win without its gzip counterpart. For noisy metrics
report medians/distributions across repeated runs, not a single cherry-picked run.

### Upstream vs application ownership

| Class | Disposition | Known members |
|---|---|---|
| Application-owned | remediate | app CSS/JS, route import graph, prefetch policy, dead code |
| Configurable ecosystem | investigate supported configuration | cssnano/postcss options, Nuxt & Nuxt UI config |
| **Upstream-owned, unavoidable** | **measure and document; do not hack around** | **Unhead v2+v3 ~50.5 KB** · `@nuxtjs/i18n` 10.6.0 +1.9 KB/route (not flag-gated) |

⚠ **Unhead re-verified upstream in T5.A (§24.2), not taken from the Phase 4 record:** `@nuxt/ui@4.10.0`
is still the latest release and hard-depends on `@unhead/vue: ^2.1.15` (a `dependencies` entry, not a
peer), while `nuxt@4.5.2` — also still latest — depends on `unhead`/`@unhead/vue` `^3.3.1`. Installed:
`unhead@3.3.2` + `@unhead/vue@3.3.2` (via nuxt) alongside `@unhead/vue@2.1.17` (via `@nuxt/ui`, with
`@nuxtjs/seo`'s three sub-modules deduped onto that same v2 copy). **No supported convergence exists.**
Confirmed upstream-owned; re-check only if a genuinely new compatible release appears.

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
| **OD-26-1** | Preserve `probe/nuxt-4.5.1-experiment` (`8fee07c`) | **RESOLVED 2026-08-15 — option 3.** Private verified git bundle, restoration-tested; tag **not** pushed to the public origin. Hashes + restore steps in ledger §9.5. Public publication needs a separate decision |
| **OD-26-2** | *(anticipated, T2.2)* Change browser targets to stop `lightningcss` downleveling `:dir()`? Would dissolve 191 B at the root but changes supported-browser policy | not yet raised |
| **OD-26-3** | Build once with production origins in `verify` and ship that exact artifact? Recovers **~73 s of compute and nothing else** (the "stronger guarantee" claim was withdrawn in ledger §11.3), but routes the Production artifact through GitHub artifact storage instead of building it in the deploying job. Not required by any exit criterion | **RESOLVED 2026-08-16 — DEFERRED BY DESIGN.** Closed; **not** carried as an open decision. Reopen only on new evidence: a governed reusable build-artifact model arriving anyway, or Production build latency demonstrated as a material bottleneck. Ledger §12.1 |
| **OD-26-4** | *(raised by Phase 2's measurement, ledger §12.9)* Nuxt 4.5.2 needs **257 B** of CSS headroom that **no safe dead-code removal can supply** (0 B available; four candidate pools, all controlled). **A** pull Phase 5 CSS consolidation forward · **B** abandon the pin strategy and pay up to 698 B · **C** re-sequence Phase 5 before Phase 3. Raising the cap is not an option (RB-1 §3.4). | **RESOLVED 2026-08-16 — option D (owner-authored; not A, B or C).** No pre-Nuxt CSS phase; no Phase 5 pull-forward; the campaign **tolerates a clearly identified temporary CSS-budget regression on the isolated campaign branch** through Phases 3–4. Cap unchanged at **30,000 B** and **not raised**. Cleanup happens **once**, in Phase 5, against the modernized stack, under a **hard exit gate** restoring every original budget. No Production promotion until then. Plan §1/§1a, Phase 5 charter, ledger §13 |
| **OD-26-5** | *(raised by Phase 3's measurement, ledger §14.4 / F-7)* **`size:routes` is red, and OD-26-4 does not cover it.** Adopting `nuxt` 4.5.2 breaches the **D20-11** 250.0 KB gz JS budget on **18 public routes** (+1.7 to +12.7 KB) and drives **`/dashboard/messages` through the D20-24 HARD CEILING** — 328.5 KB gz vs 320.0, **+8,663 B over**, which that gate itself calls release-blocking and never auto-raises. **App-owned bytes still PASS every frozen cap**; the growth is framework/vendor. Measured mechanism: `nuxt` 4.5.2 moves to `@unhead/vue` v3 while **`@nuxt/ui` 4.10.0 (latest) still pins ^2.1.15**, so both majors ship — ~52 KB of pre-minification duplication. **No released `@nuxt/ui` fixes it**; the only forcing mechanism is a forbidden `overrides` major-version force. Options: **A** extend the OD-26-4 tolerance to `size:routes` for Phases 3–4 and repay in Phase 5 (note the duplication is upstream's, so Phase 5 may be unable to repay it) · **B** hold RB-1/Nuxt until `@nuxt/ui` ships unhead-v3 support, leaving 8 advisories open meanwhile · **C** probe the forbidden `overrides` force as evidence only and decide on its result · **D** re-baseline D20-24 by decision-log entry in `docs/20-performance.md` (the only sanctioned route, and an owner-only act). Raising a budget autonomously is not an option. | **RESOLVED 2026-08-16 — option A, with the tolerance stated as three named regressions.** The owner extended the OD-26-4 temporary campaign-branch tolerance to cover `size:routes`. **This is NOT a budget change.** All production/release budgets remain unchanged and authoritative. Explicitly tolerated, and ONLY these: (1) CSS over the unchanged **30,000 B** cap · (2) public-route JS over **D20-11** · (3) `/dashboard/messages` over the unchanged **D20-24 hard ceiling**. Permitted only as explicitly tracked temporary regressions on the isolated modernization branch while the dependency stack is still changing. **Forbidden:** raising any CSS/JS/route budget · re-baselining D20-11 or D20-24 · weakening `size` or `size:routes` · adding `continue-on-error` · removing the restored Production-bound `size`/`size:routes` verification (T1.9/F-6) · merging or promoting a budget-red candidate. **The tolerance covers performance budgets ONLY — it does not extend to correctness or compatibility failures**, so Phase 3 must still become functionally green (T3.3, F-8, SSR/hydration, EN/AR/RTL, a11y). Final integration remains prohibited until Phase 5 restores every original budget or a new explicit owner decision is taken. Ledger §16 |

| **OD-26-6** | *(raised by F-10, ledger §16.10/§17)* Under `nuxt` 4.5.2 a `swr`/`cache` route rule makes the route's own SSR'd HTML emit a self-referential `<link rel="preload" as="fetch" href="/_payload.json">`; the HTML parser fetches it **before hydration**, and because the route is not prerendered Nitro answers with a **second full live SSR render**, breaking the governed one-render contract on `/`. Three modes were measured under a controlled probe. | **RESOLVED 2026-08-16 — `experimental.payloadExtraction: 'client'` APPROVED and applied.** An **intentional governed rendering-behaviour change**, selected for **rendering/data-transfer correctness**: it is the only tested mode satisfying the SWR rendering contract without the correctness regression the alternatives show — `true` keeps the pre-hydration duplicate render, and `false` deterministically breaks 4 AR→EN locale-head-parity specs by removing payload support from client-side navigation. ⚠ **Explicitly NOT part of this decision:** the ~2.5 KB initial-document growth is a **performance measurement to disposition separately**, and **no CSS, JS, route or other budget is raised or re-baselined**. Ledger §17, §18 |
| **OD-26-7** | *(raised by Phase 4's measurement, ledger §21.6)* `@nuxtjs/i18n` **10.6.0** moves locale messages OUT of the JS chunks into separately-delivered assets: `en.json` (82,060 B) + `ar.json` (36,996 B) leave, `delivery.js` (422 B) arrives, **net −112,385 B rendered/parsed**, against **+1.9 KB gz transferred on every route** and +2 assets/route. No breaking changes, no security content. Attribution proven in BOTH directions (forward measure + revert control restoring the exact prior figures); the `optimizeMessageBundling` hypothesis was REFUTED by a byte-identical opt-out control. **A** adopt 10.6.0 · **B** hold 10.5.0. | **RESOLVED 2026-08-17 — option A, ADOPT 10.6.0.** Owner rationale of record: 10.6.0 is the latest stable compatible DIRECT dependency identified by the Phase 4 investigation; the route-size increase is an **explicitly measured PERFORMANCE regression only**; Campaign 026 already permits the named temporary performance-budget regressions through Phase 4; and a direct dependency must not be held at an older version merely to make an intermediate campaign budget look greener. ⚠ **Scope stated precisely:** this INCREASES THE MAGNITUDE of the third regression already named by OD-26-5 (`/dashboard/messages` over the unchanged D20-24 hard ceiling, 328.5 → **330.4 KB gz**) — it does **not** create a new tolerated class. **No budget is raised, re-baselined or weakened; no `continue-on-error` added; T1.9/F-6 untouched.** All original budgets remain unchanged and authoritative and must be recovered before final integration (Phase 5, T5.12 hard exit gate). Subject to the normal compatibility/correctness gates — the tolerance covers performance budgets ONLY. Ledger §22 |

**No owner decision is open.** OD-26-7 was **resolved 2026-08-17** (option A, adopt `@nuxtjs/i18n` 10.6.0, above), OD-26-6 was **resolved 2026-08-16** (`'client'`, above), OD-26-5 **resolved 2026-08-16** (option A, above), OD-26-4 **resolved 2026-08-16** (option D, above); OD-26-1 and OD-26-3 are closed. OD-26-2 remains *contingent*, raised only if T2.2 measures the 191 B as
otherwise unavoidable. ⚠ T2.2's premise has
since weakened: `lightningcss` stays **1.32.0** in every measured Nuxt 4.5.2 state, so the `:dir()`
downleveling cost **does not currently occur**.

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

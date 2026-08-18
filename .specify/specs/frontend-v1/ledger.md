# Campaign 027 — Frontend v1 · execution ledger

Durable source of truth between sessions. **Do not rely on conversational memory.**
Governing plan: [`plan.md`](plan.md). This file records state; the plan records intent.

---

## 1. Zero-trust resume block

Verify every line against live state before acting on it. Report drift before doing any work.

| | |
| --- | --- |
| **Repo** | `eslammuatamed-web` |
| **Worktree** | `/home/eslam-muatamed/worktrees/web-026-phase8` ⚠ directory name is historical (it was the 026 Phase 8 worktree); the branch it holds is the Frontend v1 campaign branch |
| **Branch** | `campaign/frontend-v1` |
| **Branched from** | `origin/dev` `54cea28737c558767ccb24a34e2b437b62f7f058`, via `plan/frontend-v1`. ⚠ The branch has **no upstream configured** — `git status` reports no ahead-of-upstream count at all, and `@{upstream}` exits 128. Compare against `origin/dev` **by name**. *(A previous revision of this row claimed the branch tracks `origin/dev`; it never did.)* |
| **Branch tip** | **Do not read a SHA for this from this table — run `git rev-parse HEAD`.** A checkpoint commit that stamps its own SHA here is false the instant it lands, and this ledger has done it once already. |
| **Last source-touching commit** | **Do not read a SHA from this table — run `git log -1 --name-only`.** The repository rule is **ONE COMMIT PER LOGICAL UNIT**, so a phase may land as several coherent commits; the FE-2b commit bundled source + tests + ledger because that phase *was* one unit, not because bundling is required. What this row exists to prevent is narrower: **never stamp a SHA here that a later commit invalidates.** |
| **Remote state** | **NOT PUSHED.** `origin/dev` = `54cea28737c558767ccb24a34e2b437b62f7f058`, `origin/main` = `648aa467cd8bc7157cbcad2fd7c0e8981ee1f16c` — neither moved by this campaign, re-verified after FE-2a |
| **Docs repo** | branch `docs/od-11-dashboard-localization`, HEAD `3b607af9e6b0fe9662abe0058f5e50c88bcd545f`, **local-only** (R10). `origin/main` = `1896d8c7…`, untouched |
| **Production** | Web release `20260817T175534Z-648aa46` — untouched |
| **API** | `origin/main` = `origin/dev` = `9af1aace…`, live and complete for v1 scope |

**Verify with:**
```bash
git -C /home/eslam-muatamed/worktrees/web-026-phase8 rev-parse HEAD --abbrev-ref HEAD
git -C /home/eslam-muatamed/worktrees/web-026-phase8 status --porcelain
git -C /home/eslam-muatamed/worktrees/web-026-phase8 fetch origin && git rev-parse origin/dev origin/main
```

---

## 2. Phase status

| Phase | State |
| --- | --- |
| **FE-1 — Contract & Integration Foundation** | **COMPLETE** — commit `19e3a05`. Contract adopted + gtm reconciliation; reply flow deliberately moved to FE-2 (see §4). Gates re-verified on the committed tree: typecheck 0, 1501/1501. |
| **FE-2 — Articles Tracer Bullet + Dashboard Architecture** | **IN PROGRESS.** OD-11 resolved (§9, option B). Three sub-phases: **FE-2a COMPLETE** · **FE-2b COMPLETE** · **FE-2c IN PROGRESS** — F-1 locale wiring DONE (below); the Articles surface itself and plan §14.9 criteria 1–10 are NOT started. |
| FE-3 — Content Module Replication | NOT STARTED |
| FE-4 — System Modules | NOT STARTED |
| FE-5 — Coherence, D20-32 Review, M4 Closure | NOT STARTED |

---

## 3. Settled owner decisions — do not re-litigate

| ID | Decision |
| --- | --- |
| **OD-1** | Full Dashboard M3 **IS** in Frontend v1. Hold the `M` bar. |
| **OD-2** | Dynamic **RBAC management UI is DEFERRED** from v1. Backend RBAC, enforcement, and role/permission-aware Frontend behaviour are all preserved. Record as POST-V1 product work, **not** an unfinished v1 requirement. |
| **OD-3** | Backend/API is complete and Production-ready for v1 scope unless fresh evidence proves otherwise. |
| **OD-9** | **The Dashboard application locale seeds the initial** translation tab; tab selection is thereafter independent per entity. ⚠ **Restated 2026-08-18 under OD-11.** It previously read "the active *content* locale seeds the tab" — deliberately phrased to avoid presuming a chrome locale, because none was settled. OD-11 settles it: there **is** a Dashboard application locale and it is the seed. The old phrasing is not a second valid reading; do not carry it forward. |
| ~~**OD-10**~~ | ~~Dashboard shell is fully localized EN/AR.~~ **Withdrawn as an inference, then RE-ESTABLISHED as an owner decision.** It was originally inferred from "locale control in the header" before doc 02 §9 / doc 04 §1 were found, and withdrawn for that reason. The owner has since chosen exactly it, deliberately and with the cost visible, as **OD-11 option B**. **Cite OD-11, never this row** — the conclusion is the same but only one of them is authority. |
| **OD-11** | **RESOLVED 2026-08-18 — option B. The Dashboard ships fully localized EN/AR.** The header control is a real **application-language** switcher. Dashboard routes stay **unprefixed**; the application locale is a persisted preference, independent of route structure. It drives chrome language, shell direction, and the default active translation tab. Changing it must **not** discard unsaved translation state. Governing record: docs **D02-15** (scope), **D04-7** (routing), **D11-8** (architecture), doc 18 §3 (coverage) — Docs commit `3b607af`, branch `docs/od-11-dashboard-localization`, **local-only** (R10). |
| **UX** | Multilingual authoring: shared fields once + locale tabs; preserved unsaved state; validation visible across inactive tabs; correct RTL/LTR; 380px. |
| **UX** | Dashboard shell needs a locale control, appearance control, obvious **View/Open Portfolio**, contextual **View-on-site** where a real public destination exists. The locale control switches the **chrome language** (OD-11 option B) — settled, no longer contingent. |
| **UX** | `/dashboard/login` gets a full product-quality redesign — Nuxt UI + standard Zod, obvious way back to the public site. **Bilingual under OD-11**: it carries the same language control and appearance control, localized labels/errors/actions, and correct RTL/LTR composition. |
| **UX** | Long authoring flows: **one coherent page + clear sections + locale tabs + persistent primary actions**. No wizard without workflow evidence. |

---

## 4. Rejected approaches, and why

| Rejected | Why |
| --- | --- |
| Hand-authoring the three SEO route types | Owner instruction and doc 16 §3 — types are generated from the contract, never written by hand. |
| Removing `} as SiteSettings` casts from `Partial`-spread fixtures | The cast is **forced** by TypeScript widening spread properties to `T \| undefined`, not sloppiness. Removing it yields TS-limitation noise, not safety. Recorded as a post-v1 factory-helper improvement instead. |
| Deleting `replyMailto()` | **FR-DSH-060 explicitly preserves it**: "Replying from the owner's own email client remains available and is unaffected." The dashboard reply is an addition, not a replacement. |
| Building the Dashboard reply UI during FE-1 | It is Dashboard **UI**, governed by the FE-2 form/validation/feedback patterns that do not exist yet. Building it first is throwaway work the tracer-bullet sequencing exists to prevent. |
| Trusting an `app/`-scoped grep for the fixture sweep | It missed `scripts/e2e/` fixtures entirely. The contract-fixtures gate caught them. Sweep the **repo**, not a directory. |

---

## 5. Measurements and gate results

### FE-1

| Gate | Result |
| --- | --- |
| Contract paths (Web) | 49 → **52**, matching API `origin/main` |
| API `origin/main` contract vs **live** `/docs-json` | `jq -S` normalized → **STRUCTURALLY IDENTICAL** |
| `npm run api:types` fixed point | second generation **byte-identical** |
| `npm run typecheck` | **exit 0**, 0 errors |
| `npm test` (first run, pre-fixture-fix) | **exit 1** — 2 failures, both real drift in `scripts/e2e/` fixtures |
| `scripts/e2e/contract-fixtures.spec.ts` (isolated, post-fix) | **26/26 passed** |
| `npm test` (full, post-fix) | **exit 0** — 104 files, **1501/1501 passed** |
| `npm run lint` | **exit 0** |

**Instrument note.** The contract-fixtures gate **failed naturally** on real drift before it passed.
That failure is the discriminating evidence that it is live — no synthetic negative control was
needed for this gate.

**Build gates (`check:bundle`, `check:logical`, `size`, `size:routes`) not run for FE-1, by
argument rather than omission:** no runtime source changed. The diff is `openapi/openapi.json`,
the generated `app/types/api.d.ts` (types only — fully erased at compile), `*.spec.ts` fixtures and
`scripts/e2e/` mock-server fixtures. None ships in a client bundle, so no budget can move. CI will
run them anyway at the integration boundary.

**Exit-code note.** Two background wrappers reported harness exit 0 while the underlying command had
failed (a trailing `echo`/`tee` masked it). Always read the explicit `*_EXIT=` line, per the
`set -o pipefail` rule.

---

### FE-2a — bilingual Dashboard architecture

| Gate | Result |
| --- | --- |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** |
| `npm test` | **exit 0** — 107 files, **1534/1534** (1501 before; +33 new) |
| `npm run typecheck:e2e` | **exit 0** |
| `node scripts/check-logical-properties.mjs` | **exit 0** |
| `npm run check:bundle` | **exit 0** — 100 public chunks, no editor/renderer leakage (D06-5) |
| `npm run build` | **exit 0** |
| `npm run size` | **29.09 / 30.00 KB gz** (+9 B — the shell's one new `a11y` string) |
| `npm run size:routes` | **exit 0** — shared dashboard floor **260,888 / 268,288 B gz**; public floor **253,884 / 263,168 B** |
| `playwright --project=dashboard-media` | **exit 0** — **23 passed** (22 before; the 2 route-based RTL tests became 3) |
| `playwright --project=contract dashboard-locale-payload` | **exit 0** |

**Three gates, each positive-controlled before it was trusted.** Every one of them guards a failure
that is SILENT in production — untranslated chrome renders English or a raw key path, and nothing
throws. A gate for a silent failure that has never been seen to fail is indistinguishable from a
gate that does not work.

| Gate | Mutation | Mutated | Reverted (SHA256 verified identical) |
| --- | --- | --- | --- |
| ESLint `eslammuatamed/dashboard-localization` | `media.vue` back to `useI18n()` | **exit 1**, named the file and the rule | **exit 0**, `77241ca4…` unchanged |
| `check-logical-properties` (new `side` literal rule) | drawer pinned to `side="left"` | **exit 1** | **exit 0**, `0a19ea26…` unchanged |
| `useDashboardI18n.spec.ts` | dropped `{ locale }` from the `t` wrapper | **1 failed / 3 passed** | **4 passed**, `049645b1…` unchanged |

**The parity gate needed no synthetic control — it failed naturally first.** `i18n/locale-parity.spec.ts`
was written before the Arabic copy existed and reported all **306** missing keys by name. Same
discriminating evidence as FE-1's contract-fixtures gate.

**`/ar/dashboard/**` is gone, measured rather than assumed.** Localized routes carry a `___<locale>`
name suffix, so the built server chunks were read for them:

```
about___ar  about___en  blog___ar  blog___en  blog-slug___ar  blog-slug___en
contact___ar  contact___en  experience___ar  experience___en  index___ar  index___en
preview-articles-id___ar  …  projects___ar  projects___en  resume___ar  resume___en
```

Every public page appears twice — **that is the positive control, in the same reading**: the
instrument is live. No dashboard route appears with either suffix, while all eight still exist
unprefixed (`dashboard`, `dashboard-login`, `dashboard-media`, `dashboard-messages`,
`dashboard-profile`, `dashboard-projects`, `dashboard-projects-id`, `dashboard-projects-new`).

**A superseded test caught by the suite, not by a sweep.** `useMessages.spec.ts` asserted
*"adds NO dashboard.messages or dashboard.nav keys to ar.json"* — a correct guard for the
English-only decision, protecting it from being "fixed" by someone mistaking it for a parity gap. It
is **inverted, not deleted**, and its header records what it used to enforce and why. Two further
premises retired the same way rather than quietly edited: `skillLabel()` and the projects-list
`rowTitle()` both hard-coded `en` *because the chrome was English-only* — both now follow the
operator's language, with the same fallback shapes.

**One defect this phase introduced and fixed before it shipped.** `login.vue` built its Zod schema
once in `setup`, justified by a comment reading *"a locale switch is a route change that remounts
this page"*. True when written; OD-11 made it false, because the dashboard switch is deliberately
state and not navigation. Left alone, validation messages would have stayed in the load-time
language while everything around them changed. Now a `computed`.

**A 28 KB regression, caught by the gate and attributed by measurement rather than by argument.**
`size:routes` first came back RED: the shared dashboard floor had gone to **288,523 B gz**, breaching
D20-32 by **20,235 B**. D20-32 is INTERIM and plan §7.3 / risk R3 forbid recalibrating it before
FE-5, so the only honest options were to find the cause or to stop and report — never to raise the
number. Three builds, **same directory and same `node_modules`** (a cross-worktree comparison is
invalid — separate installs cascade chunk-hash renames into a false diff):

| Tree | Shared dashboard floor | vs baseline |
| --- | --- | --- |
| baseline `84f53f6` (pre-FE-2a) | **259,900 B gz** | — |
| FE-2a as first written | **288,523 B gz** | **+28,623 B** ✗ |
| FE-2a with the account dropdown replaced | **260,888 B gz** | **+988 B** ✓ |

So the **entire bilingual architecture** — composables, switcher, `dir`/`lang` handling, route
exclusion and 306 Arabic strings — costs **+1,089 B gz** on the floor. The other **28.0 KB was one
`UDropdownMenu`**: wrapping the operator's e-mail and Sign-out in it pulled Reka's whole menu
subsystem and its floating-ui dependency into the dashboard LAYOUT chunk, which every dashboard route
loads. Rebuilt as plain text + a button; both halves of the owner's "operator identity / session
actions" survive, and the presentation is a legitimate FE-5 coherence question with this number
attached to it.

**The public floor went DOWN**, 254,582 → 253,884 B gz (**−698 B**), because the `/ar/dashboard/**`
route records left the public router with the tree that generated them.

### Two defects found in review, after every gate was already green

Both sat in the space the gates could not see. Recorded because each one is a reusable trap, not
because it was hard to fix.

**1. `page.locator('[dir]').first()` resolves to `<html>`, and the failure message lies.** The two
new RTL e2e tests selected the shell that way and **both failed** — reported as *"expected rtl, got
ltr"* on an `html` element, which reads exactly like "the implementation never sets direction". The
obvious fix from that message is to write `<html dir>` from the dashboard, which is finding F-3 and
the one thing D11-8 exists to forbid. `<html>` always carries a `dir` — @nuxtjs/i18n writes it — so
`[dir]` matched the document element first. The shell root now carries `data-shell="dashboard"`
(same name as the existing `data-shell="public"` convention in `layouts/default.vue`), and the
assertions select on that. Lane now **23/23**.

**2. A visitor's dashboard-locale cookie was serialized into every PUBLIC page's payload, and `swr`
caches it.** `app.vue` reads the dashboard locale on every route in order to resolve one Nuxt UI
locale pack for both worlds; public routes DO server-render, so the value reached `__NUXT_DATA__`,
`payloadExtraction: 'client'` inlined it into the HTML, and `swr: 60` would then serve one visitor's
preference to the next. Measured on the built server before the fix: `/about` with
`Cookie: dashboard_locale=ar` serialized `'ar'` at the state slot; with `en`, `'en'`. Fixed by
seeding the constant default on the server — `/dashboard/**` is `ssr: false`, so the server never
legitimately needs the real value, and the client re-seeds after hydration.

Guarded by `e2e/dashboard-locale-payload.spec.ts` and **negative-controlled across a full rebuild**,
because a payload assertion is easy to write vacuously:

| Tree | Result |
| --- | --- |
| fixed | **passed** |
| server seeding restored to the cookie | **failed** — `Expected: "en" / Received: "ar"` |
| reverted (`ef63ce8c…` hash-verified identical) | **passed** |

The test sends the cookie rather than relying on the default (a no-cookie request passes against the
broken build too), reads the RAW server HTML rather than the live page (the client re-seed would mask
it), and dereferences the payload slot rather than grepping for `"ar"` near the key (Nuxt serializes
state as a key→index map, so the key's neighbourhood holds only an integer).

**Also dropped in review:** `d()` and `n()` on `useDashboardI18n` had zero consumers on the day they
were written — every call site already formats through `utils/format.ts` or its own `Intl` fed the
rebound locale. Plan §14.6: no abstraction before a second real consumer.

**Exit-code note, again.** A backgrounded `npm run build` was reported by the harness as **exit 0**
while the underlying build had **failed** on a missing `NUXT_PUBLIC_SITE_URL` — a trailing `tee`
masked it. The explicit `BUILD_EXIT=` line in the log is what showed it. Read the recorded exit
code, never the wrapper's.

---

### FE-2b — bilingual login

**What it shipped.** `/dashboard/login` composed on `UCard`; a password-visibility control built as
`UInput`'s `#trailing` slot; both new labels localized. The OD-11 *contract* was already in place
from FE-2a (`layouts/auth.vue` carries the language control, the appearance control and the branded
route home; the Zod schema is locale-reactive), so FE-2b is the composition FE-2a deliberately left.

**`UAuthForm` was NOT adopted, and the reason is mechanical, not aesthetic.** `@nuxt/ui@4.10` ships a
`UAuthForm` whose `password` field already has this toggle. It was rejected because this page needs
`form.setErrors()` for 422 field errors and a focus-managed `role="alert"` for everything else — both
reachable on `UForm`, neither on `UAuthForm`'s surface. **The toggle markup is copied from
`UAuthForm`'s own implementation** (`type` flip, `aria-pressed`, `aria-controls`, `appConfig.ui.icons`),
so this is the library's idiom rather than a bespoke equivalent — which is what §14.3's constraint asks.
Putting it in the `#trailing` slot also means the *theme* positions it with logical `end-*` utilities;
hand-positioning it is how a physical `right:` enters dashboard chrome.

**Gates — all measured on a clean build at `NUXT_PUBLIC_SITE_URL=https://example.com` (the value CI uses).**

| Gate | Result |
| --- | --- |
| `lint` | 0 problems |
| `typecheck` | exit 0 |
| `typecheck:e2e` | exit 0 |
| `test` (unit) | ⚠ **CORRECTED — see the note below this table.** Reported as 1534/1534; that reading was taken BEFORE the e2e spec was written, and the committed tree was in fact **1533/1534** |
| `check:logical` | exit 0, **negative-controlled** (below) |
| `size` (CSS) | **29.09 KB / 30.00 KB gz** — unchanged from baseline |
| `size:routes` | exit 0 |
| `e2e` login lane | **9/9**, incl. unfiltered axe in EN and AR |

> ⚠ **CORRECTION, found by FE-2c's first full run.** The unit reading above was taken after the
> i18n keys landed but **before** `e2e/dashboard/login.spec.ts` was created, and I did not re-run the
> suite afterwards. The new spec made `e2e/dashboard/` hold two spec files, which breaks
> `scripts/e2e/lane-isolation.spec.mjs` — a mutable-backend lane must hold exactly ONE spec file,
> because `workers` is a top-level Playwright option and a second file is scheduled on a second
> worker that resets the first's fixtures mid-assertion. **So `97a7166` was committed with a red unit
> suite (1533/1534) while this record claimed green.** The gate was right and the record was wrong.
> Fixed in FE-2c/F-1 by giving login its own lane and process pair; the other FE-2b readings
> (lint, typecheck, budgets, the 9 login e2e tests) were unaffected and stand.
>
> **The transferable lesson:** a gate reading is only valid for the tree it was taken on. Adding a
> FILE after the run invalidates any gate that inspects the file tree, and those gates are exactly
> the ones a code-shaped mental model forgets exist.

**Budget deltas, measured as a CONTROLLED comparison** — same directory, same `node_modules`, same
env, the three changed files reverted to `d6180d7` and rebuilt, then restored by file copy and
`sha256sum -c` verified. A cross-worktree or cross-session comparison would not have been valid.

| Metric | Baseline `d6180d7` | FE-2b | Δ |
| --- | --- | --- | --- |
| Shared **public** floor | 253884 B gz | 253904 B gz | **+20 B** |
| Shared **dashboard** floor | 260888 B gz | 260908 B gz | **+20 B** |
| `/dashboard/login` Δ-above-floor (cap 86016 B) | 26912 B | **27913 B** | +1001 B |
| `/dashboard/login` app-rendered (cap 103424 B) | 65553 B | **66511 B** | +958 B |
| CSS all-sheets | 29.09 KB | 29.09 KB | 0 |

**The +20 B is identical on both floors and that is the explanation, not a coincidence.** It is the
two new i18n keys: `auth.showPassword` / `auth.hidePassword` in `en.json` and `ar.json` land in the
**shared** locale bundle that both worlds load. It is attributable, not build noise — worth stating
because `reference-web-build-output-nondeterministic` would make "noise" the lazy reading. Public
floor is 248.0 KB against a 257.0 KB cap, so R2's headroom concern is not touched by it.

The route itself grew ~1.0 KB gz (`UCard` + `UButton` + two eye icons), landing at **32% of its
incremental cap**. No floor regression of the kind `82494d0` had to isolate.

**Required attribution — 4 pre-existing D20-24 quality-target warnings.** `size:routes` passes but
prints them, and the gate states the attribution block is required in any verification report:
`/dashboard/messages` 330.8 KB gz · `/dashboard/projects` 307.4 KB gz · `/dashboard/projects/new`
304.7 KB gz · `/dashboard/projects/{id}` 304.8 KB gz. **None is caused by FE-2b** — all four are
above the 300 KB target on the baseline build too, and they pass on the D20-32 shared-floor model.

**No provenance marker was stamped.** `stamp-build` refuses on a dirty tree, so these numbers carry
no build SHA and `lighthouse:ci` would refuse until the tree is clean. They were taken on the exact
source that this commit contains, but the marker is the thing that would *prove* it — re-run on the
committed tree if a governed reading is ever needed.

**Both instruments were controlled before being trusted.**

| Control | Result |
| --- | --- |
| `check:logical` **negative control** — added `class="absolute right-2"` to the toggle, i.e. the exact defect the slot-based approach avoids | **FAILED**, naming the file and the utility; restored, PASSED; source `sha256` identical before and after |
| Arabic-localization e2e **positive control** — hard-coded the `aria-label` to English, rebuilt, re-ran | **FAILED** as required. This is the defect no other gate sees: `locale-parity` still passes (the keys exist and are translated) and `typecheck` is silent. Restored, `sha256` verified |

**A method finding that cost four invalid gate readings.** The first build of this phase exited **1**
(`NUXT_PUBLIC_SITE_URL` is required at build time and was unset), but the harness reported the
*wrapper's* exit 0 and the failure sat unread in the log. `size`, `size:routes` and a 9-test e2e run
were then taken against a **stale `.output` from the previous session**, and the two e2e failures
that produced were misread as a component defect for three cycles. Playwright serves a prebuilt
`.output`; a failed build leaves the old one in place and every downstream gate reads green-ish
nonsense. **Gate on the inner exit code explicitly, and assert a marker of the change is present in
the built chunks before trusting any reading** — `grep -rl aria-pressed .output/public/_nuxt/` is
what finally exposed it.

---

### FE-2c · F-1 — the loading system speaks the surface's language

**First logical unit of FE-2c**, and deliberately its own commit: it is a prerequisite the Articles
surface depends on, it is independently reviewable and revertable, and its measurements belong to it
rather than to a large Articles diff.

**Root cause, and why nothing caught it.** `eslammuatamed/dashboard-localization` bans `useI18n()`
on dashboard surfaces, and it is scoped **by surface** — `app/pages/dashboard/**`,
`app/components/dashboard/**`, and the two dashboard layouts by name. The 007 loading components
live in `app/components/ui/` and are rendered by **both** worlds, so they sit outside that scope and
each called `useI18n()` directly. They were correct on the surface they were written for and wrong
on the one they had never been used on yet, which is why neither the rule, the type-checker nor a
test saw it.

**The fix is at the ownership boundary, not the call sites.** `useSurfaceI18n()` asks which locale
owns the route being rendered and resolves against it; `UiContentSkeleton`, `UiDataLoadingOverlay`
and `UiStateError` translate through it. Reuses the existing `isDashboardPath` predicate — the same
one `<UApp>` uses to pick the direction of teleported overlays — whose doc comment claimed exactly
one caller and has been corrected rather than left to become false.

| Rejected alternative | Why |
| --- | --- |
| Callers pass translated strings down as props | The components already accept `label` / `updatingLabel` / `message`, so this needed no new code — and that is the problem. It makes correctness opt-in at every future call site, and forgetting produces the identical silent English-in-Arabic |
| `provide`/`inject` from the dashboard shell | More literally "ownership", but a layout that forgets to provide falls back to public copy **silently** — F-1 again, one level up |

**No key was added or duplicated.** `state.loading` / `state.updating` / `state.error` and
`common.retry` already exist in both locales; only the locale they resolve against changed.
**State semantics are untouched** — `useRequestState` and `UiRequestState` were not modified, so
initial→skeleton, refresh→updating, error→retry and loaded-empty→empty stand exactly as they were.

**A guard, scoped by surface rather than by directory.** New ESLint block
`eslammuatamed/shared-surface-localization` bans `useI18n()` in those three files by name. Listed
individually on purpose: the other `ui/` components are public-only today, and banning it across
`app/components/ui/**` would be a rule about where files sit rather than which surfaces they serve.

**One observation for the Articles surface, not acted on here.** `UiStateError`'s default message is
`home.sectionError` ("This section couldn't be loaded.") — public-homepage phrasing that reads oddly
in a Dashboard. It takes a `message` prop, and `state.error` ("Something went wrong") already exists
in both locales, so dashboard callers have a correct option without a new key. Changing the *default*
would change public copy and is out of this unit's scope.

**Gates — clean build, `NUXT_PUBLIC_SITE_URL=https://example.com`.**

| Gate | Result |
| --- | --- |
| `lint` | 0 |
| `typecheck` | exit 0 |
| `typecheck:e2e` | exit 0 |
| `test` (unit) | **1541/1541**, 108 files |
| `test:e2e` `dashboard-login` + `dashboard` | **61 passed**, exit 0 |
| `size` (CSS) | 29.09 KB / 30.00 KB gz — unchanged |
| `size:routes` | exit 0 |

| Metric | FE-2b `97a7166` | F-1 | Δ |
| --- | --- | --- | --- |
| Shared **public** floor | 253904 B gz / 37 assets | 253745 B gz / **36** | **−159 B, one fewer asset** |
| Shared **dashboard** floor | 260908 B gz / 47 assets | 260755 B gz / **46** | **−153 B, one fewer asset** |
| `/dashboard/login` Δ-above-floor | 27913 B | 27915 B | +2 B |

The floors **fell**, and the asset count falling with them makes it structural rather than the
build-to-build noise `reference-web-build-output-nondeterministic` would otherwise explain: three
components that each pulled in the i18n composable independently now share one module that the
dashboard bundle already contained, and a small chunk collapsed. Recorded as measured; not claimed
as the reason this unit exists.

**Both instruments controlled.**

| Control | Result |
| --- | --- |
| ESLint `shared-surface-localization` — reverted `DataLoadingOverlay` to `useI18n()` | **FAILED**, naming file and line (`✖ 1 problem`); restored, `sha256` verified, passes |
| `useSurfaceI18n.spec.ts` — removed the per-call locale override, i.e. the exact pre-fix behaviour | **3 of 5 tests FAILED**; restored, 5/5 pass |

**The e2e proof of F-1 is owed by the Articles surface and is not yet written.** No dashboard surface
renders these components today — `messages.vue` hand-rolls its own (F-2, deliberately left). Until
Articles renders a real skeleton/updating/error state, F-1 is proven at the unit and lint level only.
That is stated rather than glossed: it is the one assertion this unit cannot yet make.

---

## 6. Known risks carried

| # | Risk |
| --- | --- |
| R2 | Public CSS budget ~0.9 KB headroom (29.08 / 30.00 KB gz) |
| R3 | D20-32 is INTERIM; 5 of 8 Dashboard routes lack accepted baselines — **do not recalibrate before FE-5** |
| R7 | Security posture stale — recount from paginated Dependabot API **plus** `npm audit`; carry no remembered count forward |
| R8 | Production rollback pointer unverified |
| R9 | `content:sync` never run — one project 404s in Production (content gap, not a defect) |
| R10 | `D19-11` id collision across Docs branches — blocks any Docs integration |
| R11 | Issue #30 hydration defect — `test:e2e:repeat` red by design, out of scope |
| — | **About portrait** is an owner content dependency for M4 closure; do not fabricate or substitute owner content |

---

## 7. Delegation results

None yet. No subagents or Codex lanes dispatched in this campaign.

---

## 9. Owner decisions — resolved

### OD-11 — Dashboard chrome language · **RESOLVED 2026-08-18 · OPTION B**

**The owner chose option B: the Dashboard chrome ships fully localized EN/AR in v1.** This
explicitly supersedes the previous v1 position that Dashboard chrome is English-only.

The recommendation in this ledger was **option A** (English chrome; the header control switches the
content locale). It was argued on cost, and the owner overrode it on **intent**: the header control
is an *application* language switcher, and a control that changes nothing but a form's default tab
misrepresents itself. Recorded, not quietly deleted — the recommendation was wrong about what the
owner wanted, and the cost it priced is real and is now being paid deliberately.

**What the decision settles:**

| | |
| --- | --- |
| Chrome language | **EN/AR, fully localized** — navigation, headings, buttons, actions, labels, helper text, application-owned validation presentation, empty/loading/error states, dialogs/drawers/menus, authentication chrome, system modules |
| Routing | **UNCHANGED — dashboard routes stay unprefixed.** No `/ar/dashboard/**`, no duplicate localized route tree. The application locale is **persisted preference state**, independent of route structure |
| Direction | Logical layout semantics throughout the Dashboard. Physical `left`/`right` in dashboard chrome becomes a defect class, as it already is in public chrome |
| Translation tabs | The **Dashboard locale** seeds the initial active tab (restated OD-9). Changing the Dashboard locale must **not** discard unsaved translation state |
| Field vs chrome direction | **Independent.** English fields stay LTR inside an Arabic dashboard; Arabic fields stay RTL inside an English one |
| Login | `/dashboard/login` is bilingual too — same language control, appearance control, branded home link back to the portfolio, localized labels/errors/actions |
| Where it is established | **FE-2**, as reusable contracts — not deferred to FE-5, and not re-invented per module. FE-3/FE-4 reuse; FE-5 stays the coherence pass |

**Governing documentation, reconciled 2026-08-18** — Docs commit `3b607af` on branch
`docs/od-11-dashboard-localization`, **local-only** (R10 still blocks Docs integration):

| Doc | Record |
| --- | --- |
| doc 02 | **D02-15** — scope. §9 assumption + §8 non-goal struck through **in place**, with the reason. Not deleted: both were true when written and governed shipped code |
| doc 04 | **D04-7** — routing. Dashboard pages excluded from localized route generation; `/ar/dashboard/**` stops existing |
| doc 11 | **D11-8** — architecture. Dashboard locale is client state; `dir` on the shell root, never on `<html>` (D22-7 owns it) |
| doc 18 | §3 — four discriminating tests, each chosen because its failure is silent |

**One live defect this decision removes, discovered while reconciling:** `/ar/dashboard/**` already
existed as a by-product of the public `prefix_except_default` strategy, and rendered **raw i18n key
paths** (`dashboard.media.title`) because `ar.json` carries only 4 of 310 `dashboard.*` keys and
there is no `fallbackLocale`. It was measured and deliberately left unasserted by the M4-A lane
(`e2e/dashboard-media/media-profile.spec.ts`), which named the three candidate fixes and correctly
called the choice a governed decision outside its scope. OD-11 is that decision, and it picks the
third: exclude the tree.

---

## 8. Exact next action

**FE-1 is closed.** Commits on `campaign/frontend-v1`:

| SHA | What |
| --- | --- |
| `3be8be7` | Frontend v1 plan (audit, product definition, phases) |
| `19e3a05` | **atomic contract adoption** — contract + generated types + fixture adaptation |
| `6fd38d3` | owner UX requirements, resolved decisions, FE-1 record |
| `686785f` | FE-1 closed; OD-11 escalated |
| `84f53f6` | OD-11 resolved — option B recorded, supersession swept across plan + ledger |
| `dfba453` | **FE-2a** — bilingual EN/AR dashboard chrome + the three gates that keep it bilingual |
| `82494d0` | D20-32 floor regression isolated by measurement and removed (`UDropdownMenu`, 28.0 KB gz) |
| `c6a5b21` | two review findings a green pipeline could not see; **FE-2a complete** |
| `d6180d7` | the resume block stops asserting two things that were not true (no upstream; self-invalidating tip stamp) |
| `97a7166` | **FE-2b** — bilingual login: `UCard` composition, password-visibility control, 9 e2e |
| `ca0e2dd` → `b435bec` | a convention this ledger invented, and its correction. `ca0e2dd` promoted "one commit per phase" to binding; the repository rule is **one commit per logical unit**, and `b435bec` restores it. Both are kept: the wrong rule governed nothing, but deleting it would hide that the ledger over-reached |
| `273d4ab` | **FE-2c** — Dashboard sign-in gets its own e2e lane; repairs the lane-isolation breach `97a7166` shipped |
| `d5d493b` | **FE-2c · F-1** — the 007 loading system translates through `useSurfaceI18n()` |

*This table lists commits that exist when it is written; the commit carrying this edit is
deliberately absent rather than stamped as a SHA it cannot know. `git log --oneline c6a5b21..HEAD`
is authoritative.*

**FE-2 sub-phases.** OD-11 enlarged FE-2, so it is split rather than run as one long stretch.
Each boundary is committable and leaves the tree green.

| Sub-phase | Deliverable | Exit |
| --- | --- | --- |
| ~~**FE-2a**~~ **DONE** | **Bilingual Dashboard architecture.** Persisted application locale; one localization mechanism for all dashboard surfaces; `dir`/`lang` on the shell root; dashboard pages excluded from localized route generation (`/ar/dashboard/**` removed); shell header — language switcher, theme, **View site**, session menu; logical drawer side; **the gate that makes untranslated chrome a lint/test failure**; full Arabic chrome for the modules that already exist | Arabic dashboard renders Arabic chrome RTL on a **cold load**; no key paths; gate positive-controlled; CI green |
| ~~**FE-2b**~~ **DONE** | **Login + shell finish.** `/dashboard/login` bilingual with the same language and appearance controls and a branded route back to the portfolio; localized Zod error presentation | Login usable and correct in both languages at 380px; keyboard + error-focus behaviour asserted — **met, see §5 FE-2b** |
| **FE-2c** | **Articles tracer bullet.** The real flow first — list, editor, Tiptap, slug, scheduling, preview wiring — then extract `TranslationTabs` / `useTranslatableForm` / `EntityFormLayout` **only once it demonstrates the boundary**. **Also establishes the Dashboard request-state contract** (owner follow-up 2026-08-18, plan §14.9) — the ten criteria there are exit criteria, not aspirations | An article authored in the Dashboard is live on `/blog` in both locales; Tiptap round-trip green; no public bundle regression; axe clean in **both** dashboard languages; **plan §14.9 criteria 1–10 each demonstrated by a discriminating test** |

**Discriminating tests that must exist before the pattern is trusted** (doc 18 §3, plan §14.7):

1. **Cold load** with the preference already Arabic — not a post-load toggle. A toggle-only test
   passes even when the stored preference is ignored at boot.
2. **No untranslated chrome** under an Arabic dashboard — positive-controlled against a
   deliberately unconverted surface before it is trusted. This failure is otherwise **silent**.
3. **Switching the dashboard language preserves unsaved edits in every locale tab, and performs no
   navigation.** Different code path from the tab-switch test; neither substitutes for the other.
4. **A validation error in an inactive locale tab is surfaced and the tab marked invalid.**
5. **Mixed direction in one form**, asserted in **both** dashboard languages.

**Then** the Dashboard reply flow (`POST /admin/messages/{id}/replies`), reusing FE-2's form,
validation and save-feedback patterns. Contract facts are in `plan.md` §15.4 — note especially that
**2xx does not mean the mail was sent**; the outcome is in `status`.

**Where FE-2b picks up.** `layouts/auth.vue` already carries the language control, the appearance
control and the branded route back to the portfolio, and `login.vue` is localized with a
locale-reactive Zod schema — so the *contract* OD-11 asked for is established. What FE-2b owes is the
page's product-quality composition: card/layout, password-visibility control, error-focus behaviour,
380px, and the axe pass in both dashboard languages.

**Push discipline:** nothing is pushed. `origin/dev` and `origin/main` are untouched. No merge to
`main`, no deploy, no Docs publication.

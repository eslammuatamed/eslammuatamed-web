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

**Re-baselined 2026-08-18 (zero-trust resume, session start).** Every row above was verified live
and **matched — zero drift**: worktree present, branch `campaign/frontend-v1`, working tree clean, no
upstream (`@{upstream}` exit 128), `merge-base HEAD origin/dev` = `54cea287…` (the recorded base),
campaign branch absent from every `origin` ref (**still unpushed**), `origin/dev` = `54cea287…`,
`origin/main` = `648aa467…`, Docs `docs/od-11-dashboard-localization` = `3b607af9…` and absent from
`origin`, API `origin/main` = `origin/dev` = `9af1aace…`. Deliberately **no tip SHA stamped** — the
table's own rule. Two live facts the table does not cover, recorded so a later session does not read
them as drift: (a) the **Docs** working tree is dirty with three owner-content files
(`content/cv/*-2026-07.pdf` deleted, `*-2026-08.pdf` and `content/og_image.png` untracked, all dated
Jul–Aug 6) — pre-existing owner content churn, no campaign commit touches them; (b) Web has three
unrelated open PRs — **#69**/**#68** Dependabot, **#46** the BLOCKED violet-glass branch — none from
this campaign.

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
| **FE-2 — Articles Tracer Bullet + Dashboard Architecture** | **COMPLETE.** OD-11, OD-3, D20-33 and its amendment all resolved. FE-2a/2b/2c done: F-1 **CLOSED** with browser evidence · collection · editor · §14.6 extraction pass · **all ten §14.9 criteria demonstrated** · every gate green including `size:routes`. The reusable architecture is recorded in **§10**. |
| **FE-3 — Content Module Replication** | **OPENS — not yet implementing.** Its first unit is **R14**, the e2e lane strategy: `playwright.config.ts` boots 10 preview-server pairs on 12 cores and the full suite now loses exactly one test per run to transport/timeout, a different one each time. Five more modules cannot each take a process pair. R14 is a design decision against the `lane-isolation.spec.mjs` invariant, not a tuning knob, and no module lands before it is settled. |
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
| **OD-3 (plan §12)** | **RESOLVED 2026-08-18 — the article `body` ships as a plain Markdown textarea.** Tiptap/ProseMirror is NOT introduced in FE-2c. ⚠ **Numbering collision, stated so nobody conflates them:** *this* OD-3 is plan §12's "Confirm Tiptap"; the **OD-3** in this section's row above ("Backend/API is complete") is a different scheme with the same label — the same trap §14.8 records for OD-10. The rich-editor requirement is **NOT dropped from v1**: it is recorded as a separate governed unit in §9.2 with the questions it must answer first. |
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

### FE-2c · U-1 — the Articles e2e backend (`0a1b3b8`)

The instrument, built and calibrated before anything depended on it.
`scripts/e2e/articles-server.ts` is the only backend in the repo that can **hold a response open**
(`delayMs` via `POST /__e2e/state`). Six of §14.9's ten criteria describe a state that exists only
while a request is in flight; against an instant mock every one of them passes without the state
ever rendering. Duplicate-submission prevention is the sharpest: with an instant backend the second
click lands after the first write resolved, so the test passes whether or not the guard exists.

Validation is **enforced, not canned** — per-locale slug uniqueness and the `SCHEDULED`/`publishAt`
rule are computed against the store and the payload as sent, so a 422 carries
`translations[N].slug` with N the index in the array the CLIENT built. That index is load-bearing:
reads are a locale-KEYED map, writes are an ARRAY.

| Control | Result |
| --- | --- |
| removed `await sleep(delayMs)` | **2 failed / 23 passed** — exactly the two hold tests, 13 ms and 7 ms elapsed |
| hard-coded `translations[0].slug` | **1 failed / 24 passed** — the index test only |
| restored (`sha256 98d5fa75…` verified identical) | **25/25, exit 0** |

The index control sends the SAME collision at both array positions, because with Arabic sent first
a hard-coded `[0]` is accidentally correct.

### FE-2c · U-2 — the Articles collection (`5be7740`)

| Gate | Result |
| --- | --- |
| `lint` | exit 0 |
| `typecheck` | exit 0 |
| `typecheck:e2e` | exit 0 |
| `test` (unit) | **1625/1625**, 114 files (1566/109 before) |
| `test:e2e --project=dashboard-articles` | **22/22**, exit 0 |
| `check:bundle` | exit 0 — 104 chunks, no tiptap/prosemirror (OD-3 leaves D06-5 untouched) |
| `check:logical` | exit 0 |
| `size` (CSS) | **29.11 / 30.00 KB gz** (29.09 before) — **+~20 B**, new utilities on this page. R2 headroom now ~0.89 KB |
| `size:routes` | exit 0 |

| Metric | F-1 `d5d493b` | U-2 | Δ |
| --- | --- | --- | --- |
| Shared **public** floor | 253745 B gz / 36 | 253828 B gz / 36 | **+83 B** |
| Shared **dashboard** floor | 260755 B gz / 46 | 260861 B gz / 46 | **+106 B** |

Both deltas are the **shared i18n catalogue**, which both worlds load — the same mechanism and the
same symmetry FE-2b measured for its two keys. Attributable, not build noise.

**Required D20-24 attribution:** the four quality-target warnings are the SAME four as before
(`/dashboard/messages`, `/dashboard/projects`, `/dashboard/projects/new`,
`/dashboard/projects/{id}`). None is caused by FE-2c.

**Measured for the route that is not yet governed** (§9.3): `/dashboard/articles` app-owned
**89,016 B**, Δ-above-floor **51,373 B** against the 86,016 B allowance, route total 304.9 KB gz.
D20-29-derived cap would be `ceil((89016 × 115) / (100 × 1024)) × 1024` = **102,400 B (100 KB)**.

**No provenance marker was stamped** — `stamp-build` refuses on a dirty tree, so these numbers carry
no build SHA. They were taken on the exact source this commit contains; re-run on the committed tree
if a governed reading is ever needed.

#### F-1 — CLOSED, and the first attempt at closing it was vacuous

The four browser assertions written first would have **passed against the pre-F-1 code**. Reverting
all three 007 components to `useI18n()` failed only **one of four**: the page was passing its own
translated `updating-label` to the overlay and hand-rolling the error surface, so it was supplying
exactly what the components were supposed to resolve — which is also the alternative F-1's own
commit rejected, because it makes correctness opt-in at every call site.

The page therefore stopped overriding them: it reuses `UiStateError` with only a `message` and
leaves the retry label to `useSurfaceI18n()`, and lets the overlay use its own `state.updating`. Two
i18n keys became unused and were **removed** rather than left as decoration.

| Control | Result |
| --- | --- |
| all three components reverted to `useI18n()`, rebuilt | **3 failed / 19 passed** — skeleton, shared retry label, updating overlay |
| restored (`e7555ec1…` / `b2fbb49e…` / `f54f9bfe…` verified), rebuilt | **22/22, exit 0** |

The empty-state test is relabelled **`[not F-1]`**: `UiRequestState`'s empty slot is caller-owned by
design, so it never exercised the boundary and passing there proves only that the page is bilingual.

**Two traps worth carrying forward.** `[role=status].first()` matches **Nuxt's own route announcer**,
an empty `<span role="status" aria-live="polite">` — the overlay is identified by `aria-live` AND
`aria-busy` together. And `listSettled()` can return in the instant between a click and the router
starting, so a filter assertion must `waitForURL`, not merely settle: the list was correctly
filtered on screen while `page.url()` still carried no `status`.

### FE-2c · U-3/U-4 — the editor (`46e2f91`)

| Gate | Result |
| --- | --- |
| `lint` | 0 problems |
| `typecheck` / `typecheck:e2e` | exit 0 / exit 0 |
| `test` (unit) | **1667/1667**, 115 files |
| `test:e2e --project=dashboard-articles` | **45/45**, exit 0 |
| `check:bundle` | exit 0 — 112 chunks, no tiptap/prosemirror (OD-3 holds, D06-5 untouched) |
| `check:logical` | exit 0 |
| `size` (CSS) | **29.19 / 30.00 KB gz** — R2 headroom now **~0.81 KB** |
| `size:routes` | **exit 1** — see §9.4 |

| Floor | U-2 | U-4 | Δ |
| --- | --- | --- | --- |
| Shared **public** | 253828 B / 36 | 254922 B / 39 | +1094 B |
| Shared **dashboard** | 260861 B / 46 | 261959 B / 49 | +1098 B |

Both are the shared i18n catalogue again (~45 editor keys × 2 locales); both remain inside cap.

**What the editor establishes.** One component for create and edit (`id: string | null`); the
shared/translated split taken from the contract's own shape; Zod + `UForm` as the single validation
architecture, with the schema as a `computed` so a language switch rebuilds its messages;
conditional per-locale completeness (a locale is unauthored OR complete — never half); emptying a
server-held locale BLOCKED because the PATCH upserts and never deletes; two-step delete;
unsaved-changes guard; scroll-and-focus to the first error across tabs; and the §14.2 public action
gated on a real per-locale destination.

#### Three findings, each measured rather than argued

**1. `UForm.setErrors()` does not survive in a real browser.** It attached correctly under the
component test's DOM and was gone in Chromium: the tab activation that follows re-renders the panel
and the schema-backed store reclaims the field. The symptom was an Arabic slug input reading
`aria-invalid="false"` with no error id in `aria-describedby`, while the tab beside it was correctly
marked invalid — i.e. the error was in the component's state and had been dropped by the form's.
Server errors are now presented through `UFormField`'s own `error` prop. Validation is still Zod;
only the PRESENTATION of a 422 changed.

**2. One of the two 422 tests could not have caught a broken mapping, and the control proved it.**
`articlePayloadLocales` emits canonical order, so in a both-locales payload `translations[1]` is
Arabic under a correct implementation AND under one resolving indices against the canonical list.
Mutating both resolvers to a fixed list: the both-locales browser test **PASSED**, and only the
**ARABIC-ONLY** test failed. The discriminating shape is a single-locale payload, where index 0 is
Arabic. Both tests are kept — one proves the wiring, the other the ordering.

**3. Clicking a `UButton type="submit"` does not submit a `UForm` under happy-dom.** Seven component
tests failed for that reason alone and were misread as product defects for one cycle. The component
spec submits the FORM; the click path is covered in the browser lane, where the browser does it.

### FE-2c · U-5 — the extraction pass (`944443f`), and a suite-scalability finding

**Extractions and declines are recorded in §10.** One measurement drove the third change: when the
editor landed, the COLLECTION route's app-owned bytes rose **88,344 → 97,233 B** for a page that
gained no features, because the list imported four field helpers from the file that also held the
editor's form model and Zod schema. Splitting `admin-article-fields.ts` out recovered **6,211 B**
(97,233 → 91,022) and left the editor routes unchanged (±123 B).

**Final governed matrix at `e256bcc`**, on a CLEAN tree, so it carries a provenance marker —
`.output/.provenance.json → e256bcc6… tree 0bf374df66ce output dc4d9229f3bd (1543 files)`. That
closes the gap FE-2b and U-2 both recorded, where numbers had no build SHA behind them.

| Gate | Result |
| --- | --- |
| `lint` · `typecheck` · `typecheck:e2e` | exit 0 · 0 · 0 |
| `test` (unit) | **1673/1673**, 117 files |
| `test:e2e --project=dashboard-articles` | **48/48**, exit 0 |
| `check:bundle` · `check:logical` | exit 0 · exit 0 |
| `size` (CSS) | **29.19 / 30.00 KB gz** |
| `size:routes` | **exit 0** — all three Articles routes measured and passing |

#### ⚠ R14 — the full suite now fails exactly one test per run, and the cause is this lane's SERVER

**The Articles lane never fails.** 48/48 in every run. But the FULL suite does, and the measurement
is unambiguous:

| Configuration | Result |
| --- | --- |
| Full suite, local default workers (6) | 470 passed, **1 failed** — `nameplate.spec.ts`, 30 s navigation timeout |
| Full suite, repeat | 470 passed, **1 failed** — `dashboard-locale-payload.spec.ts`, 30 s timeout |
| Full suite, `--workers=2` (CI's count) | 470 passed, **1 failed** — `scenarios/bilingual.spec.ts`, `ECONNRESET` |
| The failing spec, in isolation | **6/6 passed in 8.6 s** |
| Suite with the Articles **webServer removed** | **423 passed, exit 0** |
| Same, repeated | **423 passed, exit 0** |

A different test each time, always a TRANSPORT or TIMEOUT symptom, never an assertion about content
— and it disappears when the tenth preview server does. `workers` is not the lever: `--workers=2`
failed too, because the cost is the FIXED one. `playwright.config.ts` now boots **10 preview server
pairs (~20 processes) on 12 cores**, plus workers and browsers.

**Why this is recorded as a risk rather than fixed here.** The fix is a lane-strategy decision, and
FE-3 forces it: five more content modules cannot each take a process pair. The candidate answers —
one shared mutable backend with per-spec reset, serialised server startup, or a longer navigation
timeout for heavy SSR routes — trade against the invariant that makes a mutable lane safe
(`lane-isolation.spec.mjs`: one spec file per mutable backend). That is a design question with a real
constraint behind it, not a tuning knob, and it belongs at the head of FE-3 rather than bolted onto
the end of FE-2c.

**Not a regression in anything Articles ships**, and not a reason to distrust the Articles evidence:
its own lane is green in every configuration measured, including at CI's worker count.

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
| ~~**R12**~~ | ~~`/dashboard/articles` ships UNMEASURED.~~ **CLOSED by D20-33** (`e0128c2`, Docs `3f2626e`). Superseded by the open cap question in §9.4. |
| **R14** | **The e2e suite's FIXED COST now exceeds this machine, and the Articles lane is what tipped it.** Measured, not suspected — see §5 FE-2c/U-5. Every Articles assertion passes; the casualties are transport/timeout failures in OTHER lanes. **FE-3 must not add a preview-server pair per module** or the suite stops being runnable. Decide the lane strategy before the first FE-3 module, and note CI's behaviour is UNVERIFIED (fewer cores, and Actions has been billing-blocked). |
| **R13** | **CSS budget R2 tightened.** 29.19 / 30.00 KB gz — **~0.81 KB headroom**, down from ~0.91 KB. Two more modules of this size would exhaust it. Watch on every FE-3 module. |
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

### 9.2 OD-3 (plan §12) — the rich-text editor · **RESOLVED 2026-08-18**

**The owner chose the plain Markdown textarea for FE-2c. Tiptap/ProseMirror is not introduced here,
and the rich-editor requirement is NOT dropped from v1** — it becomes a separate governed unit,
sequenced after the tracer bullet proves the authoring architecture.

Three governing inputs contradicted each other, which is what made this the owner's call and not an
implementation preference:

1. `FR-DSH-013` is an `M` requirement and it names Tiptap (plan §5.2, risk **high**).
2. `ProjectTranslationFields.vue:28` records the opposite argument for the SAME opaque-Markdown
   contract — a rich editor "would have to round-trip Markdown through a document model and hand
   back something subtly different from what was typed". Article `body` is that same opaque Markdown.
3. **Measured during this session:** `scripts/check-forbidden-modules.mjs` bans the substrings
   `tiptap` and `prosemirror` across **`.output/public/**/*.js`**, and dashboard chunks live there —
   confirmed, `DESB09DI.js` carries `data-shell="dashboard"`; all 104 chunks are scanned. Adopting
   Tiptap therefore turns `check:bundle` RED and requires **re-scoping a governed isolation gate
   (D06-5)**, which is not an implementation detail.

**The owner's reasoning, recorded:** FE-2c's purpose is to establish the reusable authoring
architecture; it should not simultaneously absorb a rich-editor serialization and bundle-governance
project. Markdown stays the canonical persisted representation. D06-5 must not be weakened,
bypassed or silently re-scoped. D20-32 is interim and frozen until FE-5.

**What the later unit must answer BEFORE changing code** (owner-set):
is Markdown still the canonical persisted representation · can the editor round-trip the project's
real Markdown corpus without material mutation · what exact D06-5 change is required and does it
preserve the original isolation intent · what is the measured route/shared-floor cost · can the
editor be loaded at a genuine interaction boundary rather than into every Dashboard route · does
the UX gain justify the added architecture and bundle cost. If it needs a D06-5 or budget change,
it returns as a dedicated owner-decision package at that boundary.

**Option 3 (a custom Markdown toolbar) was explicitly declined as a compromise:** start with the
simplest honest surface, and add affordances only if the real implementation demonstrates the need.

### 9.3 D20-33 — governing the Articles routes · **RESOLVED 2026-08-18**

The owner registered all three Articles routes in the existing interim Dashboard model at a frozen
app-owned cap of **102,400 B (100 KiB)** each, preserving the shared-floor model and the generic
incremental allowance, and explicitly NOT recalibrating D20-32. Recorded as **D20-33** in doc 20
v1.25.0 (Docs `3f2626e`, branch `docs/web-modernization-campaign` — that is the lineage carrying
D20-29/31/32; the branch this campaign uses stops at D20-28) and implemented in Web `e0128c2`.

Two consequences worth carrying:

- The governed inventory (11 routes) and the FROZEN floor-reference set (8 routes) have **diverged**,
  by design. A spec previously asserted the two lists were identical; its own comment admitted that
  was true only "at calibration time", so it recorded a coincidence as a contract. It is **inverted**
  rather than bumped — a new equality would re-arm the same trap for the next module.
- The editor routes' caps are **INHERITED, not derived** — a third provenance class in doc 20's
  table, stated in the Provenance column rather than implied by a fabricated baseline.

*(The decision quotes 89,016 B as the collection's baseline; the shipped tree measures 88,344 B,
taken one revision later after the page dropped its bespoke error block for `UiStateError`. Both
derive the identical 102,400 B cap, so the difference is provenance only.)*

### 9.4 D20-33 amendment — the editor routes' cap · **RESOLVED 2026-08-18**

**The owner set the two editor routes to 122,880 B (120 KiB), derived from their own measured
baselines by D20-29's formula; `/dashboard/articles` keeps 102,400 B.** Recorded as the D20-33
amendment in doc 20 v1.25.1 (Docs `565abef`) and implemented in Web `a0d4dd0`. `size:routes` exits 0.

Explicitly NOT: a waiver · a shared-floor increase · a generic incremental-allowance increase · a
D20-32 recalibration · permission to weaken any other route gate. It corrects a per-route ceiling
that was provisional because it predated the surface it governed.

**No generic `authoring-route` class — withheld by the owner.** Two routes is not stabilised evidence
to generalise from. **FE-5** keeps the final model review, after Articles, the Projects retrofit, the
remaining content modules and the system modules have settled. D20-32 stays INTERIM until then.

The provenance class the original entry introduced ("inherited, no baseline") is **retired with it**:
all three Articles routes now derive from recorded baselines, so the spec that proved the absence of
a baseline was rewritten rather than left describing a state that no longer holds.

*(Superseded — kept because it records what was escalated and on what evidence.)*

### 9.4-original — the escalation as it was raised

`size:routes` **exits 1**. This is the case D20-33 anticipated, and the instruction was to attribute
the cause and escalate rather than raise anything silently.

| Route | app-owned | cap | over by |
| --- | --- | --- | --- |
| `/dashboard/articles/new` | **106,095 B** | 102,400 B | 3,695 B |
| `/dashboard/articles/{id}` | **106,203 B** | 102,400 B | 3,803 B |
| *(collection, for contrast)* | 96,881 B | 102,400 B | ✓ passes |

**The attributed cause.** 102,400 B was derived from the COLLECTION route. An authoring surface
carries the media-picking subsystem that a list does not — `MediaBrowser` 10,406 B + `MediaPicker`
6,940 B + `MediaCard` 3,006 B = **20,352 B**. That is a structural difference between a list and an
editor, not weight this module added.

**Work done to fit it BEFORE escalating.** Moving that subsystem into its own chunk cut app-owned by
**24,769 B** (129,555 → 104,786) and moved incremental delivery from a near-cap warning at 90.3 % of
the allowance to **78.6 %**. It is still ~3.8 KB over a number derived from a different surface.

**Evidence the architecture is not the problem.** This editor is **46,190 B leaner** than the
governed Projects editor baseline (152,393 B → cap 176,128 B) while doing more: translation tabs, a
Zod schema, per-locale SEO panels, preview minting.

**The options, with the formula applied honestly:**

| Option | Cap | Note |
| --- | --- | --- |
| **A — derive from the editors' own baseline** | **122,880 B (120 KiB)** | D20-29's formula verbatim on 106,203 B. Still **53,248 B below** the Projects editor's cap for a comparable surface. Recommended. |
| B — hold 102,400 B | — | Requires finding ~3.8 KB in an authoring component, i.e. optimising for a number derived from a list route. Plan §7.3: "file size alone is not a refactor trigger", and marginal bytes rank last in the Dashboard's priority order. |
| C — a separate authoring-route class | — | Honest but heavier governance: a second incremental tier for editors, which D20-32 deliberately rejected for dashboard routes ("one generic allowance"). |

Nothing else blocks FE-2c. The remaining work — the §14.6 extraction pass — does not depend on it.

**The decision package, measured and ready:**

| Route | app-owned | D20-29 derived cap | Δ-above-floor | allowance |
| --- | --- | --- | --- | --- |
| `/dashboard/articles` | **89,016 B** | **102,400 B (100 KB)** | 51,373 B | 86,016 B |

Derivation is D20-12's methodology verbatim: `ceil((baseline × 115) / (100 × 1024)) × 1024`.
Registering it moves the governed set from eight routes to nine and requires updating the literal
pins in `scripts/lib/route-assets.spec.mjs` and `scripts/lib/dashboard-closure.spec.mjs`.

**The editor adds two more routes** (`/dashboard/articles/new`, `/dashboard/articles/{id}`) with the
same debt, so one decision can govern all three. Nothing blocks FE-2c's implementation meanwhile —
only the budget governance is deferred.

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
| `0a1b3b8` | **FE-2c · U-1** — the Articles e2e backend, and the hold that makes its states observable |
| `5be7740` | **FE-2c · U-2** — the Articles collection on the §14.9 request-state contract; **F-1 closed** with browser evidence |
| `e0128c2` | **D20-33** — govern the Articles routes; the frozen floor set stops tracking the route set |
| `46e2f91` | **FE-2c · U-4** — the Articles editor: bilingual, Zod + `UForm`, 422→locale-tab mapping, mutations, preview |
| `a0d4dd0` | **D20-33 amendment** — the editor routes derive their own 122,880 B cap; `size:routes` green |
| `944443f` | **FE-2c · U-5** — the §14.6 extraction pass: two extractions earned, four declined, one split found by measurement |

*This table lists commits that exist when it is written; the commit carrying this edit is
deliberately absent rather than stamped as a SHA it cannot know. `git log --oneline c6a5b21..HEAD`
is authoritative.*

**FE-2 sub-phases.** OD-11 enlarged FE-2, so it is split rather than run as one long stretch.
Each boundary is committable and leaves the tree green.

| Sub-phase | Deliverable | Exit |
| --- | --- | --- |
| ~~**FE-2a**~~ **DONE** | **Bilingual Dashboard architecture.** Persisted application locale; one localization mechanism for all dashboard surfaces; `dir`/`lang` on the shell root; dashboard pages excluded from localized route generation (`/ar/dashboard/**` removed); shell header — language switcher, theme, **View site**, session menu; logical drawer side; **the gate that makes untranslated chrome a lint/test failure**; full Arabic chrome for the modules that already exist | Arabic dashboard renders Arabic chrome RTL on a **cold load**; no key paths; gate positive-controlled; CI green |
| ~~**FE-2b**~~ **DONE** | **Login + shell finish.** `/dashboard/login` bilingual with the same language and appearance controls and a branded route back to the portfolio; localized Zod error presentation | Login usable and correct in both languages at 380px; keyboard + error-focus behaviour asserted — **met, see §5 FE-2b** |
| **FE-2c** *(in progress)* | **Articles tracer bullet.** The real flow first — list, editor, Tiptap, slug, scheduling, preview wiring — then extract `TranslationTabs` / `useTranslatableForm` / `EntityFormLayout` **only once it demonstrates the boundary**. **Also establishes the Dashboard request-state contract** (owner follow-up 2026-08-18, plan §14.9) — the ten criteria there are exit criteria, not aspirations | An article authored in the Dashboard is live on `/blog` in both locales; Tiptap round-trip green; no public bundle regression; axe clean in **both** dashboard languages; **plan §14.9 criteria 1–10 each demonstrated by a discriminating test** |

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

## 10. The reusable Dashboard authoring architecture — what FE-3 inherits

FE-2c's real deliverable. Every item below is something the Articles implementation EXERCISED; where
it is a rule rather than a file, the rule is stated so FE-3 applies it rather than rediscovering it.

### 10.1 Extracted, and why each earned it

| Artifact | Justification |
| --- | --- |
| `dashboard-translation-errors.ts` — `translationFieldErrorName` / `translationFieldErrorLocale` | A CONTRACT property, not a module's: 16 admin write DTOs carry translations as an array and answer 422 with array-indexed paths. Entity-independent by signature. |
| `useUnsavedChangesGuard` | Second consumer met by OBSERVATION — `ProjectEditor` had already written the same two hooks with the same bypass flag. |
| `admin-article-fields.ts` split from `admin-article-form.ts` | Found by MEASUREMENT: the shared file cost the collection route 8,889 B of editor form model and Zod schema. Split recovered 6,211 B. **FE-3 must keep this split per module.** |

### 10.2 Deliberately NOT extracted

`TranslationTabs` (one consumer — `ProjectEditor` renders zero `UTabs`) · `EntityFormLayout` (one
consumer; publish/schedule is not a Projects concept) · `useTranslatableForm` (article-shaped; needs
a second real field list) · `usePublicEntityLink` (one consumer; its rule is entity-specific).

**The first FE-3 module is the second consumer.** Extract then, against two real shapes, not now
against one and a guess.

### 10.3 The rules FE-3 replicates

1. **Request-state contract.** `useRequestState` + `UiRequestState`. Gate `:error` on `failed && !hasData` — the component tests `error` BEFORE content, so a bare `failed` blanks a list on any background refresh. Handle 403 OUTSIDE it (D11-2).
2. **Keep-or-clear on failure.** Compare the failed request's view identity to what is on screen: a failed REFRESH keeps the rows and reports staleness; a failed request for a DIFFERENT view clears them.
3. **Never override a shared component's own copy.** Passing translated strings into `UiStateError`/`UiDataLoadingOverlay` makes F-1 unprovable AND correctness opt-in per call site.
4. **Shared vs translated split from the CONTRACT's shape** — article-level fields outside the tabs, `translations[locale]` fields inside.
5. **Validation is Zod + `UForm`, schema as a `computed`** so a language switch rebuilds its messages. `ProjectEditor`'s hand-rolled validator is the outlier, not the precedent.
6. **Per-locale rules are CONDITIONAL** — a locale is unauthored OR complete, never half. And emptying a locale the server already holds is BLOCKED, because the PATCH upserts and never deletes.
7. **Send EVERY in-use locale**, not just the edited tab.
8. **Server field errors via `UFormField`'s `error` prop**, not `UForm.setErrors()` — measured not to survive a real browser here.
9. **Ordering needs TWO tests.** A both-locales payload cannot discriminate a canonical-list bug; the SINGLE-locale payload is the discriminating shape.
10. **A public action needs a real per-locale destination** — published alone is not enough.
11. **Keep server-computed fields out of the form model** (`readingTimeMin`, `createdAt`, `updatedAt`) or a fresh save looks dirty.
12. **Every export in `app/composables/` is prefixed** — the directory auto-imports wholesale and Nuxt drops a duplicate name silently.
13. **A new dashboard route needs a governed cap** before it ships, and the cap is an owner decision (D20-33 is the worked example).
14. **A mutable e2e lane is ONE spec file**, and it needs `delayMs` to make any loading state observable.

---

### Where FE-3 picks up — the e2e LANE STRATEGY (R14) comes first

**FE-2 is closed in full.** FE-2a, FE-2b and FE-2c are all landed and verified; the §14.6 extraction
pass is done and its judgement is recorded in **§10**, which is the artifact FE-3 replicates. FE-3's
scope (plan §6) is five content modules — experiences, skills, testimonials, categories/tags — plus
the shared per-entity SEO panel (FR-DSH-050).

**But the first unit is not a module.** R14 says the suite's FIXED cost already exceeds this machine:
10 preview-server pairs (~20 processes) on 12 cores, one test lost per full run to
transport/timeout — a *different* test each run, never a content assertion, and gone entirely when
the tenth server is removed. Five more modules at one process pair each makes the suite unrunnable.
Starting a module first would bury that under new work and make every subsequent red run ambiguous.

**Next three actions:**

1. **Settle R14 as a design decision, with the invariant visible.** The candidates named in §5/U-5 —
   one shared mutable backend with per-spec reset, serialised server startup, or a longer navigation
   timeout for heavy SSR routes — each trade against `lane-isolation.spec.mjs`'s rule that a mutable
   backend belongs to exactly ONE spec file. Whichever wins must say what happens to that invariant:
   upheld, narrowed with a stated reason, or replaced by a different guarantee. A change that
   silently weakens it is the failure mode to avoid, because the invariant is what makes a mutable
   lane trustworthy at all. **CI behaviour is UNVERIFIED** (fewer cores, and Actions has been
   billing-blocked), so any fix must be argued from the fixed-cost measurement, not from "CI is fine".
2. **Positive-control the fix before believing it.** The current symptom is *load-dependent and
   non-deterministic* — a green run proves nothing on its own (`reference-pre-hydration-click-class`
   is the same trap: N failures is a sample, not a set). The instrument has to be proven: reproduce
   the failure on demand at a known configuration, apply the fix, then show repeated full-suite runs
   green at BOTH the local worker count and `--workers=2`. Isolate any failing spec by name first —
   never re-run the full suite to discover what failed.
3. **Only then the first FE-3 module, and it is the SECOND CONSUMER.** §10.2 declined four
   extractions on purpose: `TranslationTabs`, `EntityFormLayout`, `useTranslatableForm`,
   `usePublicEntityLink` all had one consumer. The first FE-3 module is what makes them provable, so
   extract *then*, against two real shapes. Two rules from §10.3 bind before any code: the
   per-module `*-fields.ts` split must be kept (it is worth 6,211 B on a collection route), and a new
   dashboard route needs a **governed cap** before it ships (D20-33 is the worked example). Watch
   **R13** — 29.19 / 30.00 KB gz, ~0.81 KB headroom; two modules of Articles' size exhaust it.

**Open before the modules start, owner's call, not mine:** plan §6 calls FE-3 the strongest Codex
delegation fit in the campaign (five structurally similar modules, fixed contract, disjoint lanes).
Nothing about R14 is delegable — it is judgement against an invariant — so the question can wait
until action 3, but it should be answered before the first module rather than during it.

### Where FE-2c picked up — the §14.6 EXTRACTION PASS

The collection and the editor are both landed and verified, and **all ten §14.9 criteria are
demonstrated**. What remains is the part the plan deliberately sequenced LAST: deciding which of the
editor's internals are genuinely reusable, now that a real module has exercised them.

**Next three actions:**

1. **Extract only what the implementation proved.** §14.6 names `TranslationTabs`,
   `useTranslatableForm` and `EntityFormLayout` as *likely*, and §14.6's own rule is no abstraction
   before a second real consumer. Articles is one consumer. The honest output of this pass may be a
   RECORDED JUDGEMENT that extraction waits for the first FE-3 module rather than a set of new files
   — and if so, say that instead of manufacturing three components.
2. **Record the reusable architecture** in the ledger and doc 11 so FE-3 inherits it rather than
   re-deriving it: the shared/translated split, the request-state gating, the conditional per-locale
   validation, the 422 index→locale rule, and the two-test structure that ordering needs.
3. **Then FE-3**, one module per lane against the fixed pattern.

*(Superseded — kept because the ledger records what it said it would do next: the editor's own
opening actions.)*

### Where FE-2c picked up — the EDITOR

U-1 (backend instrument) and U-2 (collection) are landed and verified. The next unit is the
authoring surface, and it is where §14.9 criteria **3, 4 and 5** live — none of which the collection
could demonstrate.

**Next three actions:**

1. **`admin-article-form.ts` grows the form model** — shared fields (`status`, `publishAt`,
   `categoryId`, `coverImageId`, `tagIds`) outside the tabs; per-locale `title`/`slug`/`excerpt`/
   `body`/SEO inside them. `readingTimeMin`, `createdAt` and `updatedAt` must stay OUT of the form
   model: they are server-computed, and putting them in the dirty-comparison baseline makes a fresh
   save look dirty. Payload sends **every complete locale**, never only the edited one — the PATCH
   upserts per locale and never deletes, proven in `articles-server.spec.ts`.
2. **`app/pages/dashboard/articles/{new,[id]}.vue` + `components/dashboard/ArticleEditor.vue`** —
   one page, `id: string | null`, following `ProjectEditor`'s single-form decision. Zod + `UForm`
   (plan §5.2 names zod + UForm as the Dashboard validation architecture; `ProjectEditor`'s
   hand-rolled validator is the outlier and is NOT the precedent to copy). Criterion 3: never render
   blank editable fields before the entity resolves.
3. **The 422 → locale-tab mapping.** Writes send `translations` as an ARRAY and the API answers
   `translations[N].slug`, so the editor must retain the index→locale mapping of the request it just
   issued. Get it wrong and an Arabic slug collision surfaces on the English tab. The mock produces
   a REAL index (`articles-server.spec.ts` proves it moves with the payload), so assert the correct
   TAB is marked invalid with the error seeded in the INACTIVE locale — a test asserting only that
   "an error appeared" cannot catch it.

**Then:** delete/archive, publish/schedule, preview + `View on site` (gated on
`articleIsPubliclyVisible` — PUBLISHED alone is not enough, since the public route resolves
per-locale and would 404), and only then the §14.6 extraction pass.

**Push discipline:** nothing is pushed. `origin/dev` and `origin/main` are untouched. No merge to
`main`, no deploy, no Docs publication.

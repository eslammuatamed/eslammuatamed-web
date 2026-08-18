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
| **Docs repo** | ⚠ **TWO branches, and they DIVERGE — neither is an ancestor of the other.** (a) `docs/od-11-dashboard-localization` `3b607af9…` holds OD-11 (D02-15, D04-7, D11-8, doc 18). (b) `docs/web-modernization-campaign` `95e9101` (was `565abef8…`) holds doc 20's whole D20-2x/3x sequence and the governed inventory table — **D20-33 is NOT on the od-11 branch**, and **D20-34 landed on (b)** for that reason: writing it against a doc 20 lacking D20-33 would manufacture a conflict in the same table. Both **local-only** (R10); `origin/main` = `1896d8c7…`, untouched |
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

**Re-verified again 2026-08-18 at a later session start (same date, second resume).** Every row
above and every `M1·U1` artifact claim in §5 was checked live and **matched — zero drift**; the two
uncovered facts in the paragraph above still hold unchanged. No tip SHA is stamped here either, for
the same reason the table gives. Also confirmed non-authoritative:
`eslammuatamed-docs/docs/research/api-frontend-v1-completion-ledger.md` self-declares **“Governs —
nothing”** and is a closed-campaign record, not a competing source of live state.

**Re-verified 2026-08-18, THIRD zero-trust resume (same date, third session).** Every row of the
table above was checked live and **matched — zero drift**: worktree present, branch
`campaign/frontend-v1`, working tree clean, no upstream (`@{upstream}` exit 128), `merge-base HEAD
origin/dev` = `54cea287…` (the recorded base), `campaign/frontend-v1` absent from `ls-remote --heads
origin` (**still unpushed**), `origin/dev` = `54cea287…`, `origin/main` = `648aa467…`, Docs
`docs/od-11-dashboard-localization` = `3b607af9…` and `docs/web-modernization-campaign` = `95e9101…`
with **`merge-base --is-ancestor` false in BOTH directions** (the divergence the table asserts, now
measured rather than restated) and neither present in `ls-remote --heads origin` (**both
local-only**), Docs `origin/main` = `1896d8c7…`, API `origin/main` = `origin/dev` = `9af1aace…`. No
tip SHA is stamped here, for the reason the table gives. `M1·U2` remains commit `fd4e9df`, D20-34
remains Docs `95e9101` — those name *units*, not branch tips, which is the distinction the
`8b66393` → `0282860` correction settled.

**One row was verified live for the first time in this campaign: Production.** The previous two
re-baselines carried the release forward from the table without checking it. `readlink -f
/srv/eslammuatamed-web/current` over ssh returns
`/srv/eslammuatamed-web/releases/20260817T175534Z-648aa46` — the release the table names, matching
`origin/main` `648aa467…`, **untouched by this campaign**. Recorded as newly-obtained evidence, not
as a re-confirmation of something previously proven.

**Two further live facts this table does not cover, recorded so a later session does not read them
as drift** — in addition to the two the second-resume paragraph above already lists, both of which
still hold unchanged (Docs owner-content churn; Web PRs #69/#68/#46, re-verified OPEN with #46 still
`CONFLICTING`/`DIRTY`):

- **API PR #86** (`a00913a`, "backend learnability") is OPEN, from the separate Backend workstream
  and unmerged. It does not contradict the table's API row — `origin/main` = `origin/dev` =
  `9af1aace…` still holds — but it did not exist when the earlier re-baselines were written, so it
  is named here rather than discovered later and misread as movement. API local HEAD sits on
  `feature/api-frontend-v1-completion` `ce64b22e…`; no campaign of this ledger touches it.
- **Docs PR #54** is the live handle on **R10**. It is `docs/api-frontend-v1-completion`
  `2345a7a0…`, titled *"govern temporary scoped overrides for unfixed transitive advisories
  (D19-11)"* — the same `D19-11` id whose collision across Docs branches R10 records as blocking
  Docs integration. R10 has therefore had an open PR attached to it that §1 never mentioned. Nothing
  about it blocks `M1·U3` (this campaign pushes nothing), but the pointer belongs with the risk.

**Verify with:**
```bash
git -C /home/eslam-muatamed/worktrees/web-026-phase8 rev-parse HEAD --abbrev-ref HEAD
git -C /home/eslam-muatamed/worktrees/web-026-phase8 status --porcelain
git -C /home/eslam-muatamed/worktrees/web-026-phase8 fetch origin && git rev-parse origin/dev origin/main
git -C /home/eslam-muatamed/worktrees/docs-web-campaign rev-parse HEAD --abbrev-ref HEAD
```

**Checkpoint 2026-08-18 — `M1·U2` LANDED.** The unit is commit **`fd4e9df`** on
`campaign/frontend-v1`; the doc 20 entry is Docs **`95e9101`** on `docs/web-modernization-campaign`
(local-only; its `docs:group:check` gate was verified green BEFORE the edit and again after
regenerating the bundle). Working trees clean on both, still unpushed, still no upstream, and
`origin/dev` / `origin/main` unmoved on both repos.

⚠ **Read the Web branch TIP with `git rev-parse HEAD`, not from this paragraph.** A first draft of
this checkpoint wrote "`campaign/frontend-v1` = `fd4e9df`" and argued the stamp was safe because the
SHA already existed — which missed the point: the commit carrying the checkpoint invalidated it
immediately, and the table above forbids exactly this. Naming *which commit is the unit* stays true;
naming *what the branch points at* does not. The same distinction applies to `95e9101`: it is the
D20-34 commit, not a promise about that branch's tip. 

**Checkpoint 2026-08-18 — `M1·U3` LANDED.** The unit is commit **`7e6d11a`** on
`campaign/frontend-v1` (Web only — there is NO Docs commit, because the doc 20 entry for §9.5 is OWED
and cannot be written until the owner rules on the caps). Working tree clean, still unpushed, still no
upstream, `origin/dev` / `origin/main` unmoved on both repos. Read the branch TIP with
`git rev-parse HEAD`, never from this paragraph — naming *which commit is the unit* stays true,
naming *what the branch points at* does not.

⚠ **`size:routes` is RED (exit 2) at this checkpoint, BY DESIGN.** It is a *measurement failure*,
not a budget breach: the two editor routes are registered and deliberately UNGOVERNED pending
**§9.5**, and every measured route is inside its cap. Do not "fix" it by stamping a cap — the gate may
not invent a budget. **Next: `M1·U4`, the extraction verdicts — SIX candidates, not five.**

---

## 2. Phase status

| Phase | State |
| --- | --- |
| **FE-1 — Contract & Integration Foundation** | **COMPLETE** — commit `19e3a05`. Contract adopted + gtm reconciliation; reply flow deliberately moved to FE-2 (see §4). Gates re-verified on the committed tree: typecheck 0, 1501/1501. |
| **FE-2 — Articles Tracer Bullet + Dashboard Architecture** | **COMPLETE.** OD-11, OD-3, D20-33 and its amendment all resolved. FE-2a/2b/2c done: F-1 **CLOSED** with browser evidence · collection · editor · §14.6 extraction pass · **all ten §14.9 criteria demonstrated** · every gate green including `size:routes`. The reusable architecture is recorded in **§10**. |
| **FE-3 — Content Module Replication** | **OPEN — module 1 (`experiences`) through `M1·U3`: the collection AND the editor SHIP.** Delegation settled as **OD-12** (hybrid: module 1 in-house, modules 2–5 delegable once the pattern holds). `M1·U1` landed the instrument; **`M1·U2` landed the collection at `/dashboard/experiences`, its `lanes.ts` record, and a third public-isolation gate** — every gate green, the lane 10/10 booting 1 pair, and the route measured at 85,551 B against its own D20-34 cap of 99,328 B. The new route cost **zero CSS**. Four unpredicted findings are in §5/M1·U2, including a gate (`typecheck:e2e`) that had been RED since `M1·U1` because that unit's exit row never listed it. **`M1·U3` landed the editor** (`7e6d11a`): bilingual, Zod + `UForm`, 422→locale-tab mapping, the shared skill picker, `isCurrent`⇄`endDate` on a field-owned error path, and the calendar-date read that Articles' instant-shaped converter would have got wrong. Three rules were each proven able to fail; the `technologyIds` omission control failed **only** the clear-case test, which is the empirical reason both tests exist. Four more unpredicted findings are in §5/M1·U3, including a backend crash that reported itself as eight failing tests. Its route caps were **measured and escalated, never inherited** — the batched decision is **§9.5**, and until the owner rules, `size:routes` exits 2 as a MEASUREMENT FAILURE rather than a budget breach. **`M1·U4`, the extraction verdicts, is next** — and §5.2's five candidates are now **six**: `DashboardSkillPicker` was extracted by observation and owes a verdict row.<br>**Lane-strategy unit (R14):** A run now boots only the lanes it selected: measured 1 preview pair for `--project=dashboard-articles`, against 10 before, same command. The full suite still boots all ten by design, so R14 is **NARROWED, NOT CLOSED** — see §6 and §5/FE-3/U-1. ⚠ This row previously said the full suite "loses exactly one test per run"; the pre-change control run **did not reproduce that** (471 passed, exit 0) and the claim is corrected here rather than carried forward. |
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
| **OD-12** | **RESOLVED 2026-08-18 — FE-3 runs HYBRID, and the split is by kind of work, not by volume.** Module 1 (**Experiences**) is built **in-house**: it is not replication, it is the **second consumer** that proves, rejects or refines the four abstractions §10.2 deliberately declined, and that is judgement against an unestablished pattern. Codex delegation is **authorized** for modules 2–5 **only after Articles + Experiences have established the pattern**, and only as bounded, disjoint lanes. Non-delegable and retained here regardless: **architecture, integration, review, the authoritative tests/gates, and rejecting incorrect delegated work.** ⚠ Binding constraint on every delegated lane: **a lane must not invent a competing shared abstraction.** A lane that needs a pattern the shared set does not provide escalates it — plan §6's rule ("extend the shared pattern, not fork it") is the lane contract, not advice. |
| **D20-34** | **RESOLVED 2026-08-18 — `/dashboard/experiences` carries a 99,328 B app-owned cap**, derived by D20-29's formula from its OWN measured baseline (85,551 B), not inherited from the Articles collection. The owner declined rounding it to 100 KiB for visual consistency: *"the route should carry the cap derived from its own measured baseline under the governed formula."* Not a waiver, not a shared-floor change, not an incremental-allowance change, not a D20-32 recalibration. ⚠ Standing instruction attached to it: **do NOT inherit this cap for the Experiences editor routes — measure the real editor surfaces first and return with one batched decision.** Mirrored in `DASHBOARD_APP_OWNED_CAP_BYTES`; the doc 20 decision-log entry is owed in the Docs repo. |
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

#### ⚠ R14 — the suite's FIXED COST, and one test lost per run in three consecutive readings

> **Amended 2026-08-18, FE-3/U-1.** The three readings below stand as taken. What they do NOT support
> is the present tense: a fourth full-suite run on the same tree, taken as the control for the R14 fix,
> passed **471, exit 0** with no casualty. The symptom is load-dependent, so three consecutive hits do
> not make it reproducible on demand and the fourth run's green does not make it fixed. The heading
> used to read "the full suite now fails exactly one test per run"; it says what was measured instead.
> The FIXED COST claim is unaffected — that one is deterministic and was re-measured (§5 FE-3/U-1).

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

### FE-3 · U-1 — the e2e lane strategy (R14), narrowed by construction

**The mechanism, measured first.** `webServer` is a TOP-LEVEL Playwright array with no per-project
scoping — its documented options contain none — so every invocation booted every lane. Measured
before any change: `--project=dashboard-articles`, a run needing exactly ONE lane, booted **10 Nitro
servers** and passed 48/48 while doing it. That is the fixed cost, and it is deterministic.

**What the fixed cost actually is.** Sampled across a full run on 12 cores: peak load average
**17.4**, available memory down to **5.9 GB**, **~1 GB of fresh swap** on top of what was resident,
ten Nitro servers at **140–290 MB RSS** each plus ten backends, workers and browsers.

**The control run did not reproduce the casualty, and that changed the argument.** The pre-change
full suite passed **471, exit 0, 3.8 min** — no lost test, where three earlier readings each lost one.
So the fix is justified by the deterministic quantity (pairs booted per run) and **not** by a failure
it cannot reproduce on demand. §5 FE-2c/U-5 is amended to say so.

**The change.** One record per lane in `scripts/e2e/lanes.ts` — project, spec directory, backend,
port pair, readiness path, whether its specs reset backend state, and why it needs its own process.
`playwright.config.ts` derives `projects` **and** `webServer` from it, and `lanesToBoot()` narrows
`webServer` to the lanes named by `--project`. No `--project` boots everything, because a
`--grep`-only or `--last-failed` run may touch any lane and starving it would turn a filter into a
false failure.

| Reading | Before | After |
| --- | --- | --- |
| `--project=dashboard-articles` — preview pairs | **10** | **1** · 48/48, exit 0 |
| Same command, `E2E_ALL_LANE_SERVERS=1` (negative control) | — | **10** · 48/48, exit 0 |
| Full suite (`npx playwright test`) | 471 passed, exit 0, 3.8 min, 10 pairs | **471 passed**, exit 0, 3.8 min, **10 pairs** — unchanged by design |
| `npm run test:e2e:sharded` | — | **471** (329+85+57), exit 0, **5.0 min**, **peak 4 pairs**, min avail 7.4 GB |
| `lint` · `typecheck` · `typecheck:e2e` | — | exit 0 · 0 · 0 |
| `test` (unit) | 1673 | **1683/1683**, 117 files |
| `check:bundle` · `check:logical` · `size` | — | exit 0 · exit 0 · **29.19 / 30.00 KB gz** (unchanged — no `app/` source was touched) |

**471 is the acceptance criterion, not an observation.** The generated `contract.testIgnore` had to
reproduce the hand-written one exactly; any other total would mean `contract` had adopted or dropped
a lane, which is the precise failure this whole area exists to prevent. It matched on both paths —
the single full run, and the three shards summed.

**The negative control is what makes the 1-pair reading mean anything.** `E2E_ALL_LANE_SERVERS=1`
restores the old behaviour, and the SAME command then boots 10 again. Without it, "1 pair" is a
number with nothing to compare against.

**The guard was rewritten and positive-controlled three times**, each mutation reverted with the file
hash checked back to its pre-mutation value:

| Mutation | Result |
| --- | --- |
| A lane directory with a spec and **no registry record** | **FAILS** — `e2e/unregistered-lane has a lane record` |
| A **second spec file** in the mutable `cache` lane | **FAILS** — `e2e/cache … must hold exactly one spec file` |
| A **duplicated port** across two lanes | **FAILS** — `gives every lane its own port pair` |

**Mutation B closed a real hole rather than demonstrating an existing one.** The old guard checked a
HAND-WRITTEN list — `['dashboard', 'dashboard-media', 'dashboard-articles', 'dedupe']` — and `cache`
was not on it, although its backend mutates a gallery mid-test and its project is serial. The old
guard therefore PASSED on mutation B. Deriving the list from `resetsBackendState` covers every mutable
lane, including ones added later. *(Read out of the pre-change file, not inferred.)*

**Two things the refactor made unrepresentable rather than merely guarded.** `contract` is the only
project that selects by EXCLUSION, and its `testIgnore` is now GENERATED from the registry's lane
directories — the class of bug where a forgotten directory is silently adopted and run against Prism
(19 failures describing the wrong backend) can no longer be written. And a lane's port pair, project
and backend can no longer disagree, because they are one record.

**Costs and consequences, stated plainly.**

- **Wall clock.** Sharded is **5.0 min vs 3.8 min** (+31%): the `contract` lane dominates and no
  longer overlaps the rest. That is the price of the bound, and it is why sharding is opt-in.
- **`test:e2e` is UNCHANGED** — still `playwright test`, still what CI runs. No CI YAML was touched.
  A governed gate is not re-pointed on evidence that could not be reproduced.
- **`test:e2e:repeat` now boots fewer servers.** `repeat-flake-sweep.mjs` passes explicit `--project`
  lists, so its `public` sweep boots 4 pairs and its `dashboard` sweep 1, where both booted 10. Same
  tests, less contention. ⚠ **NOT re-run here**: that sweep is red by design (issue #30), so a run
  would not discriminate a new failure from the expected one. Flagged rather than claimed.
- **`playwright.race.config.ts` is standalone** — its own projects and `webServer`, no import of the
  main config, so it is untouched.
- **Load average barely moved** (23.5 → 21.6 across the two runs) and is NOT offered as evidence:
  workers and browsers dominate it, and the two runs were sampled under different background load.
  The clean numbers are the **pair count** and available memory (5.9 → 7.4 GB).

**One accidental reading, kept because it is the mechanism.** The unit suite was run once *while* a
10-pair Playwright control run was executing and reported **2 failed / 1681 passed**; run alone
immediately after, **1683/1683, exit 0**. Self-inflicted, and not evidence for anything about the
product — but it is the R14 symptom class reproduced by construction: non-assertion failures that
appear only under concurrent load and vanish without it.

**Two rules FE-3 inherits from this unit.** A new module adds **one record** to
`scripts/e2e/lanes.ts` and nothing else — the config, the shard plan and the guard all follow it. And
a new mutable lane still means **one spec file**; that invariant was upheld, never traded.

---

### FE-3 · Module 1 — `experiences` · THE PLAN, AND THE PREDICTIONS IT IS CHECKED AGAINST

Written **before any module code exists**, from the committed contract, so U-4's extraction verdict is
a check against a falsifiable claim rather than a story authored after the fact. Everything in §5.1 is
a contract reading with the schema named; everything in §5.2 is a prediction that can be wrong.

#### 5.1 What the contract says this shape is

| Fact | Source | Consequence |
| --- | --- | --- |
| `GET /admin/experiences` takes **zero query parameters** | contract | No server pagination, sort, filter or search. The collection is a FULL LIST. |
| translations = `role`, `company`, `location`, `impact`, **all four required** | `ExperienceTranslationDto` | §10.3 rule 6's "unauthored OR complete, never half" is **contract-enforced here**, where Articles enforced it in the client. A genuinely different second shape. |
| **no slug, no status, no `publishAt`** | `AdminExperienceEntity` | Publishing and scheduling are not Experiences concepts. |
| **no per-entity public route** — public is `GET /experiences`, rendered on `/experience` | contract + `app/pages/experience.vue` | There is no per-locale per-entity destination to link to. |
| `technologyIds` — *"Skill ids; replaces the full set. Empty array clears."* | `CreateExperienceDto` | A **replace-wholesale relation**, sourced from `GET /admin/skills` (also zero query params). Articles had nothing of this shape. |
| `order: number`, required on create | `CreateExperienceDto` | Manual ordering — a new pattern. |
| `employmentType` enum of 4 | contract | A select, not free text. |
| `isCurrent: boolean` alongside `endDate: string \| null` | contract | A **cross-field rule**; nothing in Articles exercised one. |

#### 5.2 Predicted extraction verdicts — commit now, check at U-4

§10.2 declined four extractions for want of a second consumer. From the contract alone, before the
module exists, the predicted verdicts are:

| Candidate | Prediction | Why the contract already implies it |
| --- | --- | --- |
| `TranslationTabs` | **EXTRACT** | Four required per-locale fields, tabbed the same way. A real second shape. |
| `useTranslatableForm` | **EXTRACT** | Second real field list — and a *shorter, all-required* one, which is the discriminating difference from Articles' longer optional-bearing list. |
| `EntityFormLayout` | **PARTIAL AT BEST** | Its publish/schedule region has **no** second consumer: Experiences has no status and no `publishAt`, exactly as Projects had none. Two entities lacking a region is evidence the region is Articles-specific, not evidence to generalize it. |
| `usePublicEntityLink` | **NO SECOND CONSUMER — do not extract** | No per-entity public destination exists. §10.3 rule 10 ("a public action needs a real per-locale destination") is UNSATISFIABLE here, so this module cannot prove it. |
| `admin-articles-query` (list query composable) | **NO SECOND CONSUMER** | `GET /admin/experiences` has zero query params; there is no server query to build. |

**A prediction that turns out wrong is a result to record, not an embarrassment to hide.** The point of
stamping them now is that U-4 cannot quietly rewrite the target after seeing the code.

#### 5.3 The three DIFFERENT clearing semantics in one form — the hazard this module introduces

Articles never had these three in one save. They are recorded together because the failure is silent:

1. `translations` — **upsert, never deletes.** Emptying a locale the server already holds is BLOCKED (§10.3 rule 6).
2. `technologyIds` — **replaces the full set; `[]` clears it.**
3. `endDate` — **nullable; explicit `null` clears** (D10-23).

⚠ **The defect this creates.** A form model that initializes `technologyIds: []` before the GET
resolves, and then saves, **wipes the relation** — no 422, no error, every gate green. **The
discriminating test is: load an experience holding N skills, save WITHOUT touching the picker, assert
the response still holds N.** A test that sets skills and asserts they were set passes against the
defect and is worthless here.

#### 5.4 The skills picker — ownership decided up front, not stumbled into

`technologyIds` needs skill options from `GET /admin/skills`, and Skills is FE-3 **module 2**. Writing
a general Skills composable now is exactly the "one consumer and a guess" §10.2 declined. **Decision:**
ship a **minimal read-only options source named for the picker role, not for the Skills module**,
marked in its own header as provisional and **absorbed by FE-3 module 2** when the real one lands.
§10.3 rule 12 applies — `app/composables/` auto-imports wholesale and Nuxt drops a duplicate name
**silently**, so the name is prefixed and checked against the existing exports before it is written.

#### 5.5 Unit plan — each ends at a committable, green boundary

⚠ **Labelled `M1·U1…U5`, not `U-1…U-5`.** `FE-3 · U-1` already means the e2e LANE STRATEGY unit
(§5, `806df17`), and this ledger has now been bitten three times by a reused label — OD-3, OD-10, and
this. The distinct prefix is cheaper than the disambiguating paragraph each previous collision needed.
*(The `M1·U1` commit `ed4e69e` was written before this rename and says `U-1` in its subject; the
commit is history and is not being rewritten, so it is named here instead.)*

| Unit | Deliverable | Exit |
| --- | --- | --- |
| **M1·U1** | The e2e backend + **one** record in `scripts/e2e/lanes.ts` (§10.3 rule 14: mutable lane = ONE spec file, and it needs `delayMs` to make loading states observable) | ⚠ **MET IN PART, and the ledger says which part.** MET: `typecheck` exit 0, `eslint` 0 problems, unit suite **1714/1714 exit 0**, calibration **31/31**, and **four injected defects each caught by its own test** with a byte-identical restore. NOT met, and deliberately deferred to `M1·U2`: *"the lane boots 1 pair when selected."* `lane-isolation` IS green — but on a registry this unit never touched, which is **not evidence about this unit**. See the sequencing finding in §5/M1·U1. |
| **M1·U2** | The collection at `/dashboard/experiences` on the §14.9 request-state contract (§10.3 rules 1–3) | ⚠ **MET IN PART, and the mapping below says which part** — M1·U1's precedent. **MET (4):** c1 first-load skeleton with no empty flash · c7 ONE reusable error/empty/retry contract (`UiRequestState` + `UiStateError` reused unchanged, no copy overridden) · c9 locale/RTL in both languages on a COLD load · c10 mobile at 380px, **list surface only**. **MET IN PART (3):** c2 and c6 — the keep-content property is proven in `useAdminExperiences.spec.ts`, but is **browser-unreachable for this module** because a zero-parameter endpoint gives the page no filter, search or pagination control to trigger a second request (F-D); c8 — `aria-busy` and a polite `role="status"` stale notice are asserted, **focus behaviour and no-noisy-repeat are not, and axe has not run** (it is `M1·U5`'s exit). **DEFERRED to `M1·U3` (3):** c3 editor first load · c4 save mutations · c5 destructive mutations — none has a collection surface. **Cap half: DONE and NARROWED** — `/dashboard/experiences` escalated and decided as **D20-34** (99,328 B). The editor caps were NOT batched with it; the owner ratified measuring them first. |
| **M1·U3** | The editor: bilingual, Zod + `UForm` computed schema, 422→locale-tab mapping through `dashboard-translation-errors.ts`, per-module `admin-experience-fields.ts` split (§10.1 — the split is worth 6,211 B and FE-3 must keep it), skill picker, `isCurrent`⇄`endDate`, `order` | §5.3's no-touch save test green; the `.refine()` for `isCurrent` carries an explicit `path: ['endDate']` or its message never reaches the field |
| **M1·U4** | The extraction verdict, checked against §5.2 | Every prediction marked HELD or WRONG, with the evidence |
| **M1·U5** | Gates + ledger | typecheck, unit, `size`, `size:routes`, axe in BOTH dashboard languages, the lane. ⚠ **R13 is the binding constraint at ~0.81 KB gz headroom** — and before reading any size number, assert the build exited 0 and the reported size is > 0, because a failed build leaves a stale `.output` and `size-limit` reports `passed: true, size: 0` against a missing one |

---

### FE-3 · Module 1 · **M1·U1** — the instrument, and the proof it can fail

`scripts/e2e/experiences-server.ts` (680 lines) + `scripts/e2e/experiences-server.spec.ts` (31 tests)
+ the `experiences` entry in `scripts/ci-preview.mjs`.

**The backend is transcribed from the real service, not guessed.** `eslammuatamed-api`'s
`experiences.service.ts` was read directly for four behaviours the OpenAPI document does not state,
and each one changed what got written:

| Read from the API source | What it changed here |
| --- | --- |
| `compareExperiences` — CURRENT FIRST, then `startDate` desc, then `order`, then `id` | The mock's order is **not** `startDate desc`. The service's own comment records the defect that shipped: WaveX (started 2026-03, **ended**) outranked Findropica (started 2025-01, **current**) on the live site. `EXP.endedLater` reproduces exactly that pair, so a Dashboard that re-sorts locally fails **here** instead of in Production. |
| `assertSkillIds` throws a bare `UnprocessableEntityException(message)` | The skills 422 carries **no `errors[]` and no field path** — a different shape from every 422 Articles produces. An editor that renders only `errors[]` shows the operator nothing and the save silently does not happen. |
| `if (dto.technologyIds !== undefined)` guards the relation write | An **omitted** key preserves; `[]` clears. Three clearing semantics now coexist in one save (§5.3). |
| The DTOs carry **no** `isCurrent`⇄`endDate` cross-field rule | The mock **accepts** a current role with an end date, deliberately. Rejecting it would test the Dashboard's guard against a server rule that does not exist — the most flattering possible green. The client is the only guard, and its test must face a server that would take the bad payload. |

**Two contract facts confirmed by reading, not assumed:** `GET /admin/experiences` answers
`{ data: [...] }` with **no `meta`** and takes **zero query parameters**. The mock ignores query
parameters rather than pretending to honour them, so a collection built on Articles' paginated shape
cannot read a field the real API never sends.

#### The instrument was proven before anything was built on it

Per the standing rule, the calibration was not trusted for being green. Four defects were injected
into the backend, the suite was run, then the source was restored **by file copy** — `git checkout --`
would have **deleted** the file, which is untracked at that point, not reverted it — and the restored
file's SHA-256 was checked against the pre-mutation value.

| Injected defect | Expected catch | Result |
| --- | --- | --- |
| `technologyIds` applied even when omitted (`?? []`) | the no-touch save | **FAILED as designed** |
| `endDate` cleared on an omitted key | omitted-preserves | **FAILED as designed** |
| skills 422 given an `errors[]` field path | the pathless-422 test | **FAILED as designed** |
| `isCurrent` lead removed from the sort | current-outranks-ended | **FAILED as designed** |

`Tests 4 failed | 27 passed`, and **each defect was caught by its own test and no other** — a broad
failure would have meant the tests were coupled, not discriminating. After restore:
`sha256 255982611e554ba088c7536b401a3c728fcbb204bf7c3bc71089d6e5d6f1296f`, identical to the pre-mutation
value, and **31/31 passed**.

#### ⚠ A sequencing finding: the lane RECORD cannot land in `M1·U1`

The unit plan said `M1·U1` would add the `scripts/e2e/lanes.ts` record and show the lane booting one
pair. It cannot, and the reason is a guard working correctly rather than an obstacle:
`lane-isolation.spec.mjs` asserts *"the $project lane owns a real directory with specs"*, so a record
whose `e2e/dashboard-experiences/` directory holds no spec **fails the guard** — and a mutable lane
may hold exactly ONE spec file, so the directory cannot be seeded with a placeholder either without
spending the module's only slot on it.

So the registry record lands in **U-2**, together with the collection's spec, as one coherent unit.
This is the ONE-COMMIT-PER-LOGICAL-UNIT rule (`b435bec`) applied, not a slip: a lane record and the
spec that gives it a reason to exist are one unit. **R14's re-check moves with it** — the suite goes
to 11 pairs when the record lands in U-2, not now, and the recorded trigger for making
`test:e2e:sharded` the default is a reproduced full-suite casualty or the lane count passing **12**.

**Gates on the committed tree:** `typecheck` **exit 0**, 0 `error TS`; `eslint` on the three touched
files **exit 0, 0 problems**; full unit suite **118 files / 1714 tests, exit 0** — which includes
`lane-isolation` green with no `dashboard-experiences` record, the state the finding above describes.

⚠ **A process note worth keeping.** The first full-suite run reported `exit 1` and was read, for a
moment, as a regression. It was `npm error Missing script: "test:unit"` — this repository's script is
`npm test`. A non-zero exit from a script that never ran looks exactly like a failing suite in a log
tail, and the only reason it did not become a false regression report is that the failing test was
isolated before anything was re-run. Same class as `reference-startup-failure-is-not-test-failure`:
read what actually executed, not the exit code alone.

---

### FE-3 · Module 1 · **M1·U2** — the collection, the lane, and four findings the plan did not predict

`app/pages/dashboard/experiences/index.vue` + `useAdminExperiences.ts` + `admin-experience-{types,fields}.ts`
+ the `dashboard-experiences` lane + its one spec + a third public-isolation gate.

**Gates on the committed tree.** `typecheck` **exit 0** · `typecheck:e2e` **exit 0** · `lint` **exit 0**
· `size` **29.19 / 30.00 KB gz — UNCHANGED** · `size:routes` **exit 0** · `check-logical-properties`
**exit 0** · `check:bundle` **exit 0** · unit **122 files / 1748 tests, exit 0** (from 118 / 1714)
· `playwright --project=dashboard-experiences` **10/10, exit 0**, booting **1 pair** (4100/4101).

**The route, measured:** app-owned **85,551 B / 99,328 B** cap ✓, incremental **7,032 B / 86,016 B** ✓,
total **262.8 KB gz** — *below* the 300 KB quality target, so unlike every other dashboard content
route it raises **no D20-24 warning**.

**⚠ The new route cost ZERO CSS.** `size` is byte-identical before and after: 29.19 KB gz. R13's
~0.81 KB headroom is untouched, because the page composes existing utilities and introduces no new
class. The R13 warning stands for the EDITOR, which is where Articles' CSS actually went.

**D20-34 — the cap, and the trap it deliberately avoids.** Owner decision 2026-08-18: the cap is
D20-29's formula applied to THIS route's own measured baseline — `ceil(85,551 × 115 / 102,400) × 1024`
= **99,328 B**, 13,777 B of headroom. The owner explicitly **declined** rounding it up to the Articles
100 KiB cap for visual consistency. Recorded as: not a waiver, not a shared-floor change, not a change
to the generic incremental allowance, not a D20-32 recalibration.
⚠ **The editor routes are NOT registered and do NOT inherit this.** They are measured first and
escalated as one batched decision in `M1·U3`. This is the D20-33 amendment's lesson applied *in
advance* rather than repeated: Articles' two editor routes were first registered at the collection's
cap **inherited before the editor existed**, and had to be corrected to 120 KiB once measured. The
ledger's own instruction to batch "BOTH caps" in U2 is therefore **NARROWED, not followed** — batching
a measured number with an unmeasured one is what produced the correction.

#### Four findings, none of them predicted

**F-A · `typecheck:e2e` had been RED since `M1·U1`, because that unit's exit row never listed it.**
Three strict-null errors in `experiences-server.spec.ts` (`translations` is an index signature, so
every lookup is `T | undefined`). The file was committed at `ed4e69e` and is unmodified by this unit —
confirmed by `git status` and by reading the blob at HEAD. M1·U1's exit row names `typecheck`,
`eslint`, the unit suite and the calibration; `typecheck:e2e` is simply absent, so it was never run.
A gate omitted from a unit's list is a gate that silently stays red. Fixed here (bound-then-assert,
31/31 still green), and the omission is the transferable lesson: **an exit row is a claim about which
gates ran, so a gate missing from it is not "unmentioned" — it is unverified.**

**F-B · §5.4 is FALSIFIED, and the accurate reason is narrower than the first reading.** §5.4 decided
to ship "a minimal provisional read-only options source" for the skills picker. `useAdminSkills()`
already exists, already reads `GET /admin/skills`, and already localizes `skillLabel()` under OD-11.
⚠ **A first pass overstated this as "Articles is already a consumer."** It is not: both hits in
`admin-article-fields.ts` and `useAdminArticles.ts` are **comments**, not usage. The true state is
one real consumer — `ProjectTechnologyPicker.vue` via `ProjectEditor` — and **Experiences BECOMES its
second consumer in `M1·U3`**, which is exactly §10.2's bar. ⚠ Stated in the future tense on purpose:
`M1·U2` does not call `useAdminSkills()` at all — the collection renders `technologyIds.length`, not
skill labels. Writing "is the second consumer" would be a forward claim asserted as established fact,
which is the same error this finding corrects one sentence earlier. The **picker COMPONENT** is a separate,
still-open question with one consumer, and it belongs to `M1·U3` where the editor needs it. §5.4 spoke
only to the data source; extending its verdict to the component would be the same conflation.

**F-C · An absence-based readiness probe is VACUOUS, and it produced a false red.** `listSettled()`
was copied from the Articles harness as "wait until nothing is `aria-busy`". Before the request
starts, nothing is busy *either*, so it returns immediately. Every Articles assertion goes through
Playwright's auto-retrying `expect(locator)`, which re-reads until it matches, so the defect was
invisible there. It surfaced the moment a test did a **one-shot read** — `evaluateAll` to capture row
ORDER, which cannot be written as a retrying locator assertion — and returned `[]` on the first
navigation of the run. The barrier is now POSITIVE first: wait until one of the four terminal
surfaces exists, *then* require nothing is busy. **The lesson generalises past this harness: an
absence is not evidence of completion, and a retrying assertion can hide a broken barrier for a
whole lane.**

**F-D · §10.3 rule 2's KEEP branch is NOT reachable in a browser for this module.** "A failed REFRESH
keeps the rows" needs a SECOND request for the same view. Articles can produce one — it has a status
filter and pagination. `GET /admin/experiences` takes zero query parameters, so this page has no
in-page control that re-requests, and the only other path to a second load is a full navigation,
which is a FIRST load with nothing underneath it. The test written to cover it did exactly that and
**re-proved the CLEAR branch under a KEEP branch's name** — a green test asserting the opposite of
its title. Deleted, with the reason recorded in the spec; the property is proven in
`useAdminExperiences.spec.ts` where it is genuinely observable.

**F-E · The public-isolation gate classifies by PATH, so every new dashboard composable defaults to
"public".** `app/composables/` holds dashboard modules but carries no `dashboard/` path segment, so
the three new files were scanned as public surface and flagged — for naming Articles' modules **in
comments**. Registration in `OTHER_DASHBOARD_MODULE_FILES` is the intended mechanism (Projects is
already there), not an exemption. Fail-safe by design, and worth knowing before FE-3's next four
modules each trip it.

#### The §5.2 predictions, checked so far

`M1·U4` renders the verdicts. Two are already settled by this unit and are recorded now rather than
re-derived later:

| Candidate | Prediction | Status after `M1·U2` |
| --- | --- | --- |
| `admin-articles-query` | NO SECOND CONSUMER | **HELD, with a second line of evidence.** No query composable was written, because the endpoint has no parameters. And keep-or-clear's view identity DEGENERATED with it: `useAdminArticles` needs a query key, `useAdminExperiences` needs only "has anything loaded", because a zero-parameter endpoint has exactly one view. A query key here would be a constant dressed as a variable. This is additional evidence for the SAME prediction, not a sixth verdict. |
| `usePublicEntityLink` | NO SECOND CONSUMER — do not extract | **HELD.** No per-entity public destination exists; the collection links only to its own editor. §10.3 rule 10 remains unsatisfiable here. |
| `TranslationTabs` · `useTranslatableForm` · `EntityFormLayout` | EXTRACT / EXTRACT / PARTIAL AT BEST | **UNTESTED — all three are editor-shaped and cannot be judged by a collection.** `M1·U3`. |

#### Both instruments were proven before they were trusted

| Instrument | Injected defect | Result |
| --- | --- | --- |
| `experiences/public-isolation.spec.ts` | a public page naming `useAdminExperiences` | **2 tests FAILED as designed** — the scan and the positive-direction check — and no others. Restored by file copy; sha256 identical. |
| the ORDER assertion, unit **and** browser | `.sort((a, b) => b.startDate.localeCompare(a.startDate))` — the natural CV sort | **4 tests FAILED as designed**, and only those four: 2 unit, 2 e2e. The browser diff reproduced the exact production pair — `…004` (WaveX, ended) above `…001` (Findropica, current), five rows with one swap, NOT an empty array. Restored by file copy; sha256 identical, then rebuilt. |

The order control was run through a **rebuild**, because Playwright serves a prebuilt `.output` — a
source mutation without one tests the previous build and proves nothing.

**⚠ What was NOT run, stated so silence is not read as coverage.** `npm run test:e2e` — the FULL
suite — was **not** run for this unit; only the `dashboard-experiences` lane (10/10) and
`lane-isolation` at unit level. That is a deliberate scope call for one unit, but it matters here
because R14's whole claim is that the suite's fixed cost already exceeds this machine at 10 lanes,
and this unit makes it **11**. The last full-suite control run was **471 passed / exit 0 at 10
lanes**; 11 lanes should report **481**. Nothing has verified that, and `axe` did not run either.

**Deliberately NOT done in this unit:** the `/dashboard/experiences/new` and `/:id` routes do not
exist, so the "New role" button and the empty state's action point at a route that arrives in
`M1·U3`. This matches Articles exactly — `5be7740` shipped its collection with the same dangling
link, and `46e2f91` created the target. It is an intra-module transient on an unpushed branch, not a
shipped defect; it is recorded because it is the kind of thing a reader would otherwise flag.

---

### FE-3 · Module 1 · **M1·U3** — the editor, and a relation that fails without saying so

Commit **`7e6d11a`**. The second consumer of the Articles authoring architecture — which is what
§10.2 exists to test. What was REUSED unchanged: the shared 422 mapping
(`dashboard-translation-errors.ts`, now with its second module), the request-state contract, the
unsaved-changes guard (third consumer), and the skill picker. What DIFFERS is contract-driven and is
recorded at each site rather than left for a reader to infer.

#### The three things this unit had to get right, and how each was proven able to fail

| Rule | The defect it prevents | Negative control |
| --- | --- | --- |
| `technologyIds` is ALWAYS sent | Omission PRESERVES, so a builder that omitted the key survives a no-touch save while making "remove every skill" **inexpressible** — the operator deselects all five, gets a 200, and finds them still there | Injected the omission: **exactly ONE test failed — the CLEAR case — and the no-touch test stayed GREEN.** That is the empirical proof that a no-touch-only test would have shipped it |
| A calendar date is read zone-free | `startDate` reads back as `date-time` and writes as `date`. Reading it through the LOCAL wall-clock — which is CORRECT in `admin-article-form.ts`, because `publishAt` really is an instant — returns the previous day at every negative UTC offset, and each round trip walks it one day further | Injected the local-zone reading: **5 date tests failed.** ⚠ The defect is INVISIBLE on this machine — `Africa/Cairo` is a POSITIVE offset — so the spec pins `TZ=America/New_York` **and asserts the pin took effect** before trusting anything it measures. An unasserted pin is not a pin |
| The `isCurrent` ⇄ `endDate` issue carries `path: ['endDate']` | An object-level `.refine()` yields an issue whose path is `[]`; no `UFormField` renders it, so the save is blocked by a message the operator cannot see beside the control at fault. ⚠ This rule is **CLIENT-ONLY** — the DTOs carry no cross-field constraint and the service accepts the contradiction — so the schema is the only thing enforcing it | Replaced the path with `[]`: **2 tests failed**, including the one asserting the path is exactly `endDate`. The save stayed blocked throughout, which is why "rejects the input" is not the assertion |

Each mutation was reverted **by file copy** and the restore verified by `sha256sum` against the
PRE-mutation value — `git checkout --` would have discarded the uncommitted work these files were.

#### Four findings, none of them predicted

**F-1 — the e2e backend CRASHED the lane, and eight tests reported it as their own failure.**
`http.createServer(async …)` hands Node a promise nobody awaits. A client that disconnects
mid-request rejects it with `Error: aborted` (`ECONNRESET`) — an unhandled rejection, which Node v24
turns into an uncaught exception and exits 1 on. The lane lost its backend and every remaining test
failed with `ECONNREFUSED`, which reads as eight broken tests rather than one dead server. `M1·U3`
exposed it because the editor's successful DELETE navigates away via `router.replace` while the
shell's reads are still in flight; the collection never aborted a request, which is why ten green
runs said nothing about it. The handler is now wrapped. ⚠ **`articles-server.ts` and the other
backends have the SAME SHAPE and are deliberately NOT patched** — changing another lane's instrument
without re-running that lane is an unverified edit. Carried as a finding, not fixed in silence.

**F-2 — `typecheck:e2e` caught `EXP.absent` missing from the harness.** The gate that had been red
since `M1·U1` and was repaired in `M1·U2` earned its keep on its first unit under supervision.

**F-3 — the hidden Arabic input is MOUNTED but not VISIBLE, and that is the proof.** The first
version of the 422 test filled `[data-editor-role="ar"]` directly and timed out against an element
Playwright had *already resolved* — which is exactly what `:unmount-on-hide="false"` promises. The
test now authors from the Arabic tab, returns to English, asserts the Arabic field is hidden, and
then requires the server's 422 to bring the operator back to it. That ordering is what makes the
assertion discriminating: an implementation that did not switch tabs would leave the error invisible.

**F-4 — the unknown-skill 422 cannot be provoked through this UI.** The service rejects duplicate and
unknown skill ids with a problem document carrying a MESSAGE and no `errors[]`, and an editor that
only rendered `errors[]` would swallow it. The BRANCH is covered (via `failNextWrite`), but that
specific trigger is not reachable: the picker offers only ids the vocabulary contains, de-duplicates
its own selection, and no fixture is seeded with an unlinkable id. A coverage gap with a stated
cause, recorded rather than papered over.

#### A sixth extraction candidate, discovered rather than predicted

`ProjectTechnologyPicker` → **`DashboardSkillPicker`**. §5.2 stamps five candidates; this is a
sixth, and it must appear in `M1·U4`'s table or the extraction pass will report five verdicts against
a tree that made six changes. It earned the extraction by OBSERVATION: the same relation, against the
same vocabulary, with the same replace-wholesale semantics, now with a second real consumer — §14.6's
bar, and OD-12's "extend the shared pattern, not fork it". Its copy is passed as explicit label props
rather than an i18n key PREFIX, deliberately: a prefix invents a naming convention every future
consumer must match and fails by rendering a raw key path at runtime, where explicit props fail at
the type-checker. ⚠ **The Projects LANE was not re-run.** `ProjectEditor.spec.ts` is green (92 tests,
including the `data-technology` assertions) and the data attributes are byte-identical, so the risk
is low — but the honest statement is "unit green, lane not re-run", not "Projects verified".

#### R14, re-checked because it was owed at this boundary

**The editor adds NO lane and NO server pair.** A mutable lane owns exactly ONE spec file — asserted
from the registry by `lane-isolation` — so the editor's tests belong in the existing
`experiences.spec.ts` by architecture rather than by preference, and they ride the process pair
`M1·U2` already booted. Measured live: **1 pair** (4100/4101) for the full 26-test lane run. Lane
count stays **11** against a trigger of **12**, and no full-suite casualty has been reproduced, so
**R14 is not tripped**. Recorded explicitly because a silent non-event is indistinguishable from a
forgotten check.

#### Gate results

| Gate | Result |
| --- | --- |
| `typecheck` | exit 0 |
| `typecheck:e2e` | exit 0 (after F-2) |
| `lint` | exit 0 |
| unit | **1800/1800**, exit 0 (1714 at `M1·U1`) |
| `dashboard-experiences` lane | **26/26**, exit 0, **1 pair**, 0 backend crashes |
| `size` | **29.19 KB gz / 30.00** — UNCHANGED. The editor cost **zero public CSS**, so R13's headroom is untouched. Build asserted exit 0 and size > 0 first, because a failed build leaves a stale `.output` and `size-limit` reports `passed: true, size: 0` against a missing one |
| `size:routes` | ⚠ **exit 2 — a MEASUREMENT FAILURE, not a budget verdict.** See the escalation in §9.5 |
| axe | NOT RUN — it is `M1·U5`'s exit |
| full `npm run test:e2e` | NOT RUN for this unit. Stated so silence is not read as coverage |

---

## 6. Known risks carried

| # | Risk |
| --- | --- |
| R2 | Public CSS budget ~0.9 KB headroom (29.08 / 30.00 KB gz) |
| R3 | D20-32 is INTERIM; 5 of 8 Dashboard routes lack accepted baselines — **do not recalibrate before FE-5** |
| R7 | Security posture stale — recount from paginated Dependabot API **plus** `npm audit`; carry no remembered count forward |
| R8 | Production rollback pointer unverified |
| R9 | `content:sync` never run — one project 404s in Production (content gap, not a defect) |
| R10 | `D19-11` id collision across Docs branches — blocks any Docs integration. **Live handle recorded 2026-08-18:** Docs **PR #54** (`docs/api-frontend-v1-completion` `2345a7a0…`, *"govern temporary scoped overrides for unfixed transitive advisories (D19-11)"*) is OPEN against this exact id. The risk is unchanged; it now names where it is being worked. |
| R11 | Issue #30 hydration defect — `test:e2e:repeat` red by design, out of scope |
| ~~**R12**~~ | ~~`/dashboard/articles` ships UNMEASURED.~~ **CLOSED by D20-33** (`e0128c2`, Docs `3f2626e`). Superseded by the open cap question in §9.4. |
| **R14** | **NARROWED 2026-08-18 (FE-3/U-1), not closed.** The e2e suite's FIXED COST exceeds this machine — deterministic and re-measured: a full run peaks at load **17.4** on 12 cores, drives available memory to **5.9 GB** and adds **~1 GB of swap**, for ten Nitro servers at 140–290 MB RSS each plus ten backends. What is FIXED: a run now boots only the lanes it selects (**1 pair** for a one-lane run, against 10, same command — §5 FE-3/U-1), so per-module development runs and the `test:e2e:repeat` sweeps no longer pay for the whole farm. What is NOT: `npm run test:e2e` still selects nothing and therefore still boots all ten, so **FE-3's five modules still take it to 15 pairs on the default path**. `npm run test:e2e:sharded` bounds it to 4 concurrent pairs and is available but is NOT the default, because the intermittent casualty did not reproduce (see the amendment in §5 FE-2c/U-5) and a governed CI gate must not be re-pointed on unreproduced evidence. **Trigger to make it the default:** either a full-suite casualty reproduced on demand, or the lane count passing **12**. ⚠ **RE-CHECKED 2026-08-18 when `M1·U2` landed the eleventh lane: the trigger is NOT tripped.** 11 < 12, and no casualty has been reproduced — the last full-suite control run was 471 passed / exit 0. Recorded explicitly rather than passed over in silence, because the check was owed at this exact point and a silent non-event is indistinguishable from a forgotten one. The **third** FE-3 module reaches 12 and trips it on lane count alone. Also confirmed live: a one-lane run still boots exactly **1 pair** (4100/4101), so U-1's narrowing holds with a lane added. ⚠ **RE-CHECKED AGAIN at `M1·U3`, because the check was owed at that boundary too: still NOT tripped.** The editor added **no lane and no server pair** — a mutable lane owns exactly one spec file, so its tests joined the existing one and rode the pair `M1·U2` had already booted. Measured live at **1 pair** across a 26-test run; lane count **11 < 12**; no casualty reproduced. CI's behaviour stays UNVERIFIED — fewer cores, and nothing is pushed. |
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

### 9.5 D20-35 — the Experiences editor routes' caps · **OPEN — ONE BATCHED OWNER DECISION**

Raised by `M1·U3` (`7e6d11a`). D20-34 attached a standing instruction: **do NOT inherit
`/dashboard/experiences`'s 99,328 B for the editor routes — measure the real editor surfaces first
and return with one batched decision.** The owner ratified measuring first. This is that return.

**Nothing is stamped.** `DASHBOARD_APP_OWNED_CAP_BYTES` says in its own header that a new cap
requires an owner decision plus a doc 20 entry and is never an edit there, so the two routes are
registered in `DASHBOARD_ROUTES` and left UNGOVERNED — which is why `size:routes` exits 2.

⚠ **`size:routes` exit 2 is a MEASUREMENT FAILURE, not a budget breach.** The tool says so itself:
*"dashboard route governance and measurement have diverged."* Every measured route is INSIDE its cap.
The alternative — not registering the routes — ships them UNMEASURED, which is exactly the R12 that
D20-33 closed, and `dashboard-closure.mjs` states the rule directly: routes join *"in the commit that
creates them"*.

#### The decision, in three rows

Derived by D20-29's formula verbatim — `ceil(baseline × 1.15 ÷ 1024) × 1024`, i.e. D20-12's headroom,
rounding and units. **Positively controlled before use:** the same formula reproduces
`85,551 → 99,328` (D20-34) and `106,095 → 122,880` (the D20-33 amendment) exactly, so it is the
documented model rather than a plausible reconstruction of it.

| Route | Measured baseline | Formula cap | Status |
| --- | --- | --- | --- |
| `/dashboard/experiences/new` | **105,051 B** | **120,832 B** | **DECISION NEEDED** — ungoverned |
| `/dashboard/experiences/…/{id}` | **105,159 B** | **121,856 B** | **DECISION NEEDED** — ungoverned |
| `/dashboard/experiences` (collection) | **87,404 B** (was 85,551 B) | 101,376 B | **PASSES** its governed 99,328 B with 11,924 B spare. **No change requested** |

For scale: the Articles editor routes carry 122,880 B and the Projects editor 176,128 B, so these two
sit BELOW both existing authoring caps. The gap over the collection is attributable — an editor
carries a form model, a Zod schema, the tab machinery and the skill picker that a list does not.

**No generic authoring-route class is proposed.** D20-33's amendment held that back for FE-5, and
four routes is still not the repeated evidence it asked for.

#### ⚠ A finding this measurement uncovered: the recorded baselines no longer reproduce

`DASHBOARD_APP_OWNED_BASELINE_BYTES` exists, in its own words, *"so each frozen cap below can be
re-derived from its stated input rather than taken on trust."* It no longer does. Measured on this
tree against what is recorded:

| Route | Recorded | Measured | Δ |
| --- | --- | --- | --- |
| `/dashboard/media` | 96,084 | 94,934 | **−1,150** |
| `/dashboard/profile` | 106,990 | 105,782 | **−1,208** |
| `/dashboard/projects` | 95,029 | 92,282 | **−2,747** |
| `/dashboard/projects/new` | 152,208 | 146,401 | **−5,807** |
| `/dashboard/projects/…/{id}` | 152,393 | 146,579 | **−5,814** |
| `/dashboard/articles` | 88,344 | 91,631 | **+3,287** |
| `/dashboard/articles/new` | 106,095 | 107,383 | **+1,288** |
| `/dashboard/articles/…/{id}` | 106,203 | 107,491 | **+1,288** |
| `/dashboard/experiences` | 85,551 | 87,404 | **+1,853** |

**Every one of them still PASSES its cap.** This is provenance drift, not a breach.

⚠ **The causes are MIXED, and a single explanation would be wrong.** The first working hypothesis —
"the shared i18n catalogue grew, so every dashboard route grew" — is REFUTED by this table: the
deltas run in **both directions**. What the provenance actually says:

- **Media, Profile and the three Projects routes** carry baselines measured at `origin/dev`
  `d53af11…`, so their deltas are CUMULATIVE CAMPAIGN drift across FE-1…FE-3 and are **not**
  attributable to `M1·U3`.
- **The Articles routes** were measured *"on the SHIPPED tree"* (FE-2c, this branch), so their
  `+1,288`/`+3,287` is post-FE-2c drift spanning `M1·U2` and `M1·U3`.
- **The Experiences collection** was measured at `M1·U2` on this branch, so its **+1,853 B IS
  attributable to `M1·U3`** — most plausibly the ~50 new i18n keys × 2 locales, which would also
  explain the Articles editors' `+1,288`. **Plausible, NOT measured to attribution.**

⚠ **Do NOT re-stamp `DASHBOARD_APP_OWNED_BASELINE_BYTES` to make the numbers reproduce.** Those
constants are the DERIVATION INPUT for frozen caps: re-stamping the Experiences collection's 85,551
to 87,404 would re-derive its cap from 99,328 to 101,376 — a budget change performed to fix a report
label. The report is what is wrong, and this table is the correction. Attribution belongs to `M1·U5`.

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
10 preview-server pairs (~20 processes) on 12 cores, deterministic and re-measured. Five more modules
at one process pair each makes the suite unrunnable. Starting a module first would bury that under new
work and make every subsequent red run ambiguous. ⚠ **Corrected 2026-08-18.** This paragraph also used
to assert "one test lost per full run to transport/timeout — a *different* test each run, never a
content assertion, and gone entirely when the tenth server is removed." The control run for the R14 fix
**did not reproduce it** (471 passed, exit 0). §2, §5 and §6 were each amended for that; this sentence
was missed by the sweep and asserted a corrected claim as live fact until now. The FIXED COST claim is
unaffected — only the casualty claim was withdrawn.

**U-1 is LANDED — R14 is narrowed, not closed (§5 FE-3/U-1, §6 R14).** A run boots only the lanes it
selects (1 pair, against 10); the full suite still boots all ten, `test:e2e` and the CI YAML are
untouched, and `npm run test:e2e:sharded` bounds the full suite to 4 pairs as an opt-in.

**`M1·U1` IS ALSO LANDED (`ed4e69e`) — the Experiences instrument exists and has been proven able to
fail.** Backend, 31-test calibration, four injected defects each caught by its own test, restored by
file copy to a byte-identical SHA-256, `ci-preview` registered. **No Dashboard code exists yet**, and
no `lanes.ts` record — see the sequencing finding in §5/M1·U1 for why the record belongs to `M1·U2`.

**Next three actions (rewritten 2026-08-18 — `M1·U2` LANDED; the previous list is kept below it):**

1. **Build `M1·U3` — the Experiences editor.** It carries everything the collection could not
   exercise: bilingual `TranslationTabs`, Zod + `UForm` with a **computed** schema, 422→locale-tab
   mapping through `dashboard-translation-errors.ts`, the per-module `admin-experience-form.ts`
   split (the fields file already exists and the boundary is already drawn, §10.1), the skills
   picker, `isCurrent`⇄`endDate`, and `order`.
   ⚠ **The one test that must exist or the module ships a silent data-loss defect** (§5.3): load an
   experience holding N skills, save WITHOUT touching the picker, assert the response still holds N.
   A test that sets skills and asserts they were set passes against the defect. Three clearing
   semantics coexist in this one save — translations upsert-never-delete, `technologyIds`
   replace-wholesale, `endDate` clears on explicit `null`.
   ⚠ The `.refine()` for `isCurrent` needs an explicit `path: ['endDate']` or its message never
   reaches the field. And the server enforces NO cross-field rule, so the client is the only guard
   and its test must face a backend that would accept the bad payload — which the mock does, by
   design.
2. **Measure the editor routes, THEN escalate their caps as ONE owner decision.** `/dashboard/experiences/new`
   and `/dashboard/experiences/:id` must be added to `DASHBOARD_ROUTES` and to
   `DASHBOARD_APP_OWNED_CAP_BYTES` together (the coverage assertion fails in BOTH directions, so a
   measurement pass needs a provisional value in place first — see how `M1·U2` did it). The owner's
   standing instruction under D20-34 is explicit: **do not inherit the collection's 99,328 B.**
   Articles' editor measured ~106 KB against a collection baseline of ~88 KB, so expect a materially
   larger number and let the formula produce it.
   ⚠ **R13 binds here, not on the collection.** `M1·U2` cost zero CSS; Articles' CSS growth came from
   its editor. Headroom is ~0.81 KB gz.
3. **Then `M1·U4` — the extraction verdict against §5.2**, which is the whole reason module 1 is
   built in-house. Two predictions already HELD (§5/M1·U2); the three editor-shaped candidates
   (`TranslationTabs`, `useTranslatableForm`, `EntityFormLayout`) can only be judged once `M1·U3`
   gives them a real second shape. Mark each HELD or WRONG **with the evidence**, then `M1·U5` runs
   the gates and closes the module — after which OD-12 opens modules 2–5 to delegation.

*(Superseded — the actions `M1·U2` was given, kept because the ledger records what it said it would do.)*

1. **Build `M1·U2` — the Experiences collection at `/dashboard/experiences`, and the `lanes.ts`
   record with it.** The two are ONE logical unit: `lane-isolation.spec.mjs` requires a lane to own a
   directory holding specs, and a mutable lane may hold exactly one spec file, so the record cannot
   land before the spec that justifies it. Read §5/M1·U1's table first — the collection must NOT
   re-sort locally (the API's order is current-first, and `EXP.endedLater` will fail a `startDate`
   sort), and must NOT read a `meta` envelope, because the contract sends none.
   ⚠ **`M1·U2` is also where BOTH route caps get escalated as ONE owner decision** (§10.3 rule 13,
   D20-33 the worked example) — batched deliberately, so the module does not stop twice.
   ⚠ **When `M1·U2` lands, the full suite goes to 11 pairs.** Re-check R14's trigger then.

2. **Carry the two §10.3 rules that bind before any code is written:** keep the per-module
   `*-fields.ts` split (worth 6,211 B on a collection route), and get a **governed cap** for each new
   dashboard route before it ships (D20-33 is the worked example). Watch **R13** — 29.19 / 30.00 KB
   gz, ~0.81 KB headroom; two modules of Articles' size exhaust it.
3. **Re-check R14's trigger after the module lands**: the full suite goes to 11 pairs. The recorded
   trigger for making `test:e2e:sharded` the default is a reproduced full-suite casualty, or the lane
   count passing 12 — which the third FE-3 module would reach.

*(Superseded — the opening actions this unit was given, kept because the ledger records what it said
it would do next.)*

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

**~~Open before the modules start, owner's call, not mine~~ — ANSWERED 2026-08-18 as OD-12 (§3).**
Plan §6 called FE-3 the strongest Codex delegation fit in the campaign (five structurally similar
modules, fixed contract, disjoint lanes). The owner's answer keeps that fit but gates it on the
condition plan §6 itself names — *an established pattern*. Module 1 is built in-house because it is
the second consumer, not a replication; delegation opens for modules 2–5 once Articles + Experiences
have proven the shape. Architecture, integration, review and the authoritative gates stay here, and no
delegated lane may invent a competing shared abstraction. Nothing about R14 was ever delegable — it is
judgement against an invariant.

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

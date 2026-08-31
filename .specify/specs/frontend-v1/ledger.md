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
| **Docs repo** | ⚠ **TWO branches, and they DIVERGE — neither is an ancestor of the other.** (a) `docs/od-11-dashboard-localization` `3b607af9…` holds OD-11 (D02-15, D04-7, D11-8, doc 18). (b) `docs/web-modernization-campaign` **`d6cbb84…`** (D20-42 at `fda38853`; generated-bundle sync at `d6cbb84`, previously `97efd02`, `95e9101`, `565abef8…`) holds doc 20's whole D20-2x/3x sequence and the governed inventory table — **D20-33 is NOT on the od-11 branch**, and **D20-34 landed on (b)** for that reason: writing it against a doc 20 lacking D20-33 would manufacture a conflict in the same table. Both **local-only** (R10); `origin/main` = `1896d8c7…`, untouched |
| **Production** | Web release `20260817T175534Z-648aa46` — untouched |
| **API** | ⚠ **Re-pointed 2026-08-23 (taxonomy contract unit; see the EOF checkpoint for the full measurement): `origin/main` = `d3eb74cc…` (PR #91 merged `dev` → `main`, carrying PR #89's taxonomy list-schema fix AND PR #90 media hardening), `origin/dev` = `b791c9c6…` (adds PR #97 deploy-summary fixes on top). The row below is the record as it then stood and is kept unedited beneath this correction. Load-bearing today: the contract blob this campaign consumes is now `185f067e…`, byte-identical at BOTH `main` and `dev`; Production serving tree was NOT re-measured in that unit.** |
| | *(historical, as of the fifth resume)* `origin/main` = `9af1aace…` — live, deployed, and complete for v1 scope. ⚠ `origin/dev` is **no longer equal to it**: it is `e87f427c…`, the merge of Backend PR #86. That is a **separate workstream**, not Campaign 027 movement — measured, not assumed: `openapi.json` is the **same blob** `7a9e0ba6…` on both `main` and `dev`, so the contract this campaign consumes did not move. Read the API row as `origin/main`; `origin/dev` is informational. |

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
  ⚠ **SUPERSEDED at the fifth resume — #86 MERGED 2026-08-18T21:52:05Z** as `e87f427c…`, so the
  equality this bullet asserts (`origin/main` = `origin/dev`) **no longer holds**; `origin/main` does.
  The bullet is kept unedited above the line because it records what was true when written — and
  because the reason it gives, that #86 belongs to another workstream, is precisely what makes the
  merge **non-drift** for this campaign rather than a contradiction of it.
- **Docs PR #54** is the live handle on **R10**. It is `docs/api-frontend-v1-completion`
  `2345a7a0…`, titled *"govern temporary scoped overrides for unfixed transitive advisories
  (D19-11)"* — the same `D19-11` id whose collision across Docs branches R10 records as blocking
  Docs integration. R10 has therefore had an open PR attached to it that §1 never mentioned. Nothing
  about it blocks `M1·U3` (this campaign pushes nothing), but the pointer belongs with the risk.

**Re-verified 2026-08-19, FOURTH zero-trust resume (new session, `/resume-ledger frontend v1`).**
Every row of the table above was checked live. **No live state has moved: zero drift on everything
this campaign depends on.** Verified: worktree present, branch `campaign/frontend-v1`, working tree
**clean**, no upstream (`@{upstream}` exit 128), `merge-base HEAD origin/dev` = `54cea287…` (the
recorded base), `campaign/frontend-v1` absent from `ls-remote --heads origin` (**still unpushed**),
Web `origin/dev` = `54cea287…`, `origin/main` = `648aa467…`; Docs `docs/od-11-dashboard-localization`
= `3b607af9…` and `docs/web-modernization-campaign` = `97efd02…`, **`merge-base --is-ancestor` false
in BOTH directions** (the divergence still holds) and neither in `ls-remote --heads origin` (**both
local-only**), Docs `origin/main` = `1896d8c7…`; API `origin/main` = `origin/dev` = `9af1aace…`. All
seven Module 1 unit commits resolve on this branch (`fd4e9df`, `7e6d11a`, `cbd72f9`, `6b59261`,
`fd11c7b`, `328bf9c`, `cf7c515`). **Production re-verified live over ssh** — `readlink -f
/srv/eslammuatamed-web/current` = `/srv/…/releases/20260817T175534Z-648aa46` and
`/srv/eslammuatamed-api/current` = `/srv/…/releases/20260817T183604Z-9af1aac`, both untouched by this
campaign. No tip SHA is stamped here, for the reason the table gives.

**Four stale values in this ledger were corrected by that pass. Each is stale TEXT, not moved state**
— the distinction matters, because the two demand opposite responses:

1. **Docs campaign-branch SHA** — the table said `95e9101`; live is `97efd02` (the D20-35 entry).
   The `M1·U5` checkpoint already named `97efd02`; only the table row lagged. **Corrected above.**
2. **API PR #86** — recorded as `a00913a`; live head is `ad5a5a7` (`campaign/backend-learnability`,
   `UNSTABLE`, OPEN). That row is an informational pointer to a **separate** workstream; the
   campaign's actual API dependency (`origin/main` = `origin/dev` = `9af1aace…`) verified **exact**.
3. **API PR #83** — `chore(deps): bump @aws-sdk/client-s3 3.1109.0 → 3.1110.0`, OPEN, `CLEAN`,
   Dependabot. It did not exist at the third resume. Named here so a later session does not discover
   it and read it as movement. Web PRs **#69**/**#68** (Dependabot, `UNSTABLE`) and **#46**
   (violet-glass, `DIRTY`) re-verified OPEN and unchanged; Docs **PR #54** `2345a7a0…` OPEN, `CLEAN`.
4. **§9.5 was still headed `OPEN`** after the owner resolved it. Verified against code, not prose:
   `scripts/lib/route-assets.mjs` carries `118 * KB` = 120,832 B and `119 * KB` = 121,856 B for the
   two editor routes, matching D20-35 exactly. **Header corrected in §9.5**; its standing
   do-not-re-stamp warning is deliberately preserved there.

**Re-verified 2026-08-19, FIFTH zero-trust resume (new session, `/resume-ledger frontend v1`).**
Twenty-three claims were checked live. **Twenty-one matched exactly; the two that did not are both
API pointer rows, and the owner has ruled them stale TEXT rather than campaign drift** (see below).
Verified exact: worktree present, branch `campaign/frontend-v1`, working tree **clean**, no upstream
(`@{upstream}` exit 128), `merge-base HEAD origin/dev` = `54cea287…` (the recorded base),
`campaign/frontend-v1` absent from `ls-remote --heads origin` (**still unpushed**), Web `origin/dev`
= `54cea287…` and `origin/main` = `648aa467…` (both read from `ls-remote`, not from local
remote-tracking refs); all seven Module 1 unit commits plus `b0bb8de`, `a65aa36` resolve as ancestors
of HEAD; Docs `docs/od-11-dashboard-localization` = `3b607af9…` and `docs/web-modernization-campaign`
= `97efd02…`, `merge-base --is-ancestor` **false in both directions**, neither in `ls-remote`, Docs
`origin/main` = `1896d8c7…`, Docs tree dirty with the same three owner-content files; Web PRs **#69**
/**#68** (`UNSTABLE`) and **#46** (`DIRTY`) OPEN; Docs **PR #54** `2345a7a0…` OPEN `CLEAN`; API **PR
#83** OPEN `CLEAN`; **Production re-verified live over ssh** — `/srv/eslammuatamed-web/current` =
`releases/20260817T175534Z-648aa46` and `/srv/eslammuatamed-api/current` =
`releases/20260817T183604Z-9af1aac`. No tip SHA is stamped here, for the reason the table gives.

**The two mismatches, and the owner ruling on them (2026-08-19).**

1. **API `origin/dev`** — the table said `= origin/main` = `9af1aace…`; live is `e87f427c…`.
2. **API PR #86** — recorded OPEN at head `ad5a5a7`; live is **MERGED** (`mergedAt`
   `2026-08-18T21:52:05Z`, `mergeCommit` `e87f427c…` — i.e. mismatch 1 *is* mismatch 2).

One cause: **a separate Backend-workstream merge.** The owner confirmed live state as authoritative,
directed that these informational pointers be re-baselined and the cause recorded accurately, and
ruled explicitly that **this is not Campaign 027 drift** — because the load-bearing Frontend-v1 API
state is unchanged on all four counts, each measured rather than argued:

| What had to hold | Measurement |
| --- | --- |
| API `origin/main` unchanged | `9af1aace2728…` from `ls-remote` — exact |
| Production API unchanged | `readlink -f /srv/eslammuatamed-api/current` = `releases/20260817T183604Z-9af1aac` |
| The OpenAPI contract unchanged | `openapi.json` blob = `7a9e0ba6ffd9…` on **both** API `main` and API `dev` |
| The Web campaign's vendored contract still matches API `main` | `sha256` = `2679bf3580…` on **both** `HEAD:openapi/openapi.json` (this branch) and `origin/main:openapi.json` (API) |

⚠ **The fourth row had never been measured in this campaign before today.** Every prior resume
carried the contract linkage forward from `19e3a05`'s "atomic contract adoption" as an assertion. It
is now a byte-identity, and it is the one that actually matters for module 2: the eight contract
claims the `M2` investigation was accepted on, and the premises `scripts/e2e/skills-server.ts`
encodes, rest on that file. Recorded as newly-obtained evidence, not as a re-confirmation.

**Two further live facts, recorded so a later session does not read them as movement:**

- **API PR #87** (`3afa00f0…`, `fix/contributing-rollback-gate` → **`dev`**, "correct the deploy
  acceptance gate and rollback semantics (R10-1)") is OPEN and `CLEAN`. It did not exist when this
  session's own verification sweep ran twenty minutes earlier — it appeared mid-session. Its four
  files are `…/deploy.yml`, `CONTRIBUTING.md`, `PROJECT_GUIDE.md`, `scripts/deploy/README.md`: no
  contract surface, and it targets `dev`, which this campaign does not consume.
- **The only Skills-module change in API `main..dev` is a comment.** `skill.dto.ts` gains a note that
  the slug rule is *also* a database `CHECK` (`skills_slug_format_check`), and `skills.service.ts`
  changes one line. Checked deliberately, because Skills is the active module and "no contract
  change" would be a weaker claim if the module's source had moved underneath it.

**Status of the NEXT THREE ACTIONS, re-derived at this resume.** `M2·U1` landed after that block was
written, so two of the three were already discharged, and **the third was discharged during this
session** — all three are now closed:

1. **R14 lane-count trigger — ✅ DISCHARGED.** Re-derived in §8 and re-counted live here: `lanes.ts`
   declares **11**, Skills lands the twelfth, so the trigger arrives at the **second** FE-3 module,
   not the third. `test:e2e:sharded` deliberately **not** promoted to the default gate.
2. **Baseline-provenance attribution — ✅ DISCHARGED this session**, commit `c3b632b`, as its own
   clean unit per OD-15. **The finding's premise did not survive measurement**: the baselines DO
   reproduce, exactly, at the tree each was measured on. Full record in §9.5. No byte value changed.
3. **Module 2 routing — ✅ DISCHARGED** (OD-13, bounded Codex lane), and `M2·U1` has landed green.

### OD-16 — CAMPAIGN ACCELERATION: up to three parallel Codex lanes · **OWNER 2026-08-19**

The owner authorized **bounded parallel Codex execution** for the remainder of FE-3, superseding the
one-lane-at-a-time shape OD-13 established. Claude remains architect, owner of shared abstractions,
integrator, reviewer, and the authority for route budgets, R14/R15 and every final gate.

**The parallelism rule, in one line: parallelize IMPLEMENTATION, serialize INTEGRATION and EVIDENCE.**

| Lanes MAY own | Lanes MUST NOT edit — report the need instead |
| --- | --- |
| module-local pages, components, composables/utilities | the shared FE-3 abstractions |
| module-local unit tests | `scripts/e2e/lanes.ts` |
| module-local e2e specs/backends where isolated | global Dashboard nav/registry files |
| | route-budget governance; global CI/test config |
| | generated OpenAPI; the Backend/API repo; the private Docs repo |

⚠ **The resource rule is not advisory, and R14/R15 are the reason it exists.** Codex may run focused
local tests inside its own lane, but **Claude serializes every heavy authoritative measurement** —
production builds, `size`, `size:routes`, full/sharded e2e, bundle analysis, CSS measurement, final
a11y. R15 already recorded two full-suite runs failing differently each time and each passing in
isolation; concurrency **manufactures** failures, so a parallel gate run would produce evidence that
means nothing. **Parallel code production, serialized evidence.**

**Standing owner boundary attached to OD-16:** do **not** stop merely because lanes are running or a
lane completed. Return only for genuine product semantics, a meaningful architecture tradeoff, a
governed route-cap decision, a hard unresolved blocker, a security waiver, or push/merge/deploy
authorization. **Context and session boundaries are explicitly NOT owner-decision boundaries.**

#### Lanes dispatched at this session (both READ-ONLY investigations)

Dispatched while the provenance unit's serialized builds ran — read-only lanes cannot collide with a
build, which is why these two went first rather than a write lane.

| Lane | Module | Mode | Brief |
| --- | --- | --- | --- |
| INV-1 | **Testimonials** (FE-3 module 3) | read-only | `briefs/testimonials.txt` |
| INV-2 | **Categories & Tags** (FE-3 module 4) | read-only | `briefs/categories-tags.txt` |

Both briefs embed the same standing constraints: derive every contract claim from
`openapi/openapi.json` (re-verified byte-identical to API `origin/main` this session), never fork a
shared abstraction, report requested CENTRAL changes rather than planning to make them, and run no
builds. Both return the owner's thirteen-section contract, including discriminating negative controls
and an owned-file proposal split into creates / modifies / central-changes-requested.

⚠ **INV-2 carries the one real architectural question in the queue.** `/admin/categories/{id}` and
`/admin/tags/{id}` carry only `patch`/`delete` and have **no detail read**, unlike Skills and
Testimonials which both carry `get`. The brief asks INV-2 to re-verify that against the contract and
then answer whether the collection-plus-editor pattern can replicate onto an entity with no detail
read — and to **escalate with evidence** if it cannot, rather than inventing a competing pattern.
This is the reason categories/tags were deliberately NOT made the first delegated lane.

#### Both investigations RETURNED — **UNREVIEWED**, and the review contract is named here

Both completed with `status: completed`, **`touchedFiles: []`** and **no read-only violation**: the
sandbox held, and neither lane wrote anything. Artifacts copied **off `/tmp`** (which does not survive
a reboot) to `scratchpad/fe3-investigations/`:

| Lane | Thread id (for `--session`) | Artifacts |
| --- | --- | --- |
| INV-1 Testimonials | `01a0170a-c159-7c60-b125-ed7d2b3499e9` | `INV-1-testimonials-{report.md,result.json}` (27,130-char report) |
| INV-2 Categories & Tags | `01a0170a-d133-7f02-a6e2-d9f1468ca064` | `INV-2-categories-tags-{report.md,result.json}` (31,115-char report) |

⚠ **Neither report has been reviewed, and neither may be acted on until it is.** OD-13's rule stands:
re-derive every load-bearing claim from `openapi/openapi.json` rather than believe the report — the
same standard `M2·U1` was held to. Only the three claims below were spot-verified before this
checkpoint; the remaining ~26 report sections are **unverified**.

#### ⚠ INV-2 ESCALATION 1 — **VERIFIED BY ME, AND IT IS A REAL API CONTRACT DEFECT**

Not a frontend question, and not something any lane here can fix. Re-derived from
`openapi/openapi.json` rather than accepted:

| Endpoint | Summary says | `200` schema `data` actually declares |
| --- | --- | --- |
| `GET /api/v1/admin/categories` | *"**List** categories with full translation maps."* | `$ref: AdminCategoryEntity` — **a single entity, no array** |
| `GET /api/v1/admin/tags` | *"**List** tags with full translation maps."* | `$ref: AdminTagEntity` — **a single entity, no array** |
| `GET /api/v1/admin/skills` | *"List skills with full translations."* | `{type: 'array', items: {$ref: AdminSkillEntity}}` ✅ |
| `GET /api/v1/admin/testimonials` | *"List testimonials including hidden entries."* | `{type: 'array', items: {$ref: AdminTestimonialEntity}}` ✅ |

The two taxonomy list endpoints **contradict their own summaries**, and the sibling endpoints prove
the correct shape was expressible. The existing consumer's hand-written array generic
(`useAdminArticles.ts:215`) has been **masking** the discrepancy. **A write lane must not implement the
taxonomy collection until this is resolved**, and resolution is an API/owner act.

#### ⚠ INV-2 ESCALATION 2 — the architectural question, **premise verified**

Re-derived: `/api/v1/admin/categories/{id}` and `/admin/tags/{id}` carry **only `patch`/`delete`**,
while `/admin/skills/{id}` and `/admin/testimonials/{id}` **do** carry `get`. So the established
`index + new + [id]` shape cannot replicate literally — an `[id]` route has no honest single-entity
read, and a reload or deep link cannot be served. INV-2 correctly **escalated rather than inventing a
pattern**, which is the lane contract working. Its recommended minimum honest departure is **inline
create/edit on each collection page** (two routes total, not six), on the evidence that the list entity
already carries every editor field — *which is exactly the claim Escalation 1 puts in doubt, so the two
must be resolved in order.*

### OD-17 — the taxonomy list-schema defect is a BACKEND bug; Taxonomy blocks, FE-3 does not · **OWNER 2026-08-19**

The owner ruled INV-2's Escalation 1 a **real API contract defect** and, critically, **not a product
decision**: runtime semantics already establish the correct shape, so nobody chooses it.

#### ⚠ It is FOUR endpoints, not two — found by sweeping the defect CLASS, not the symptom

| Endpoint | Source | Declares | Handler returns |
| --- | --- | --- | --- |
| `GET /api/v1/admin/categories` | `taxonomy/categories.admin.controller.ts:48` | single `$ref` ❌ | `Promise<AdminCategoryEntity[]>` |
| `GET /api/v1/admin/tags` | `taxonomy/tags.admin.controller.ts:46` | single `$ref` ❌ | `Promise<AdminTagEntity[]>` |
| `GET /api/v1/admin/users` | `access-control/users.admin.controller.ts:41` | single `$ref` ❌ | `Promise<UserEntity[]>` |
| `GET /api/v1/admin/roles` | `access-control/roles.admin.controller.ts:59` | single `$ref` ❌ | `Promise<RoleEntity[]>` |

**`users` and `roles` are outside Taxonomy entirely and will hit the RBAC module the same way.**
Fixing only the two reported endpoints would leave the trap armed for a later FE-3 module.

**Root cause, one missing option four times:** `@ApiOkEnvelope(Entity)` defaults to the singular
envelope; the correct form is `@ApiOkEnvelope(Entity, { isArray: true })`, which skills, testimonials
and the **PUBLIC** categories/tags all use. The handler's return type and the decorator are two
independent declarations of one fact and **only the decorator reaches OpenAPI** — so they disagree
with `tsc` and every build green. The public/admin split within the same entity family is what makes
"oversight" rather than "intent" the only reading.

⚠ **My first sweep over-reported 7 and was corrected by the artifact.** A one-line lookahead missed
`isArray: true` sitting on the third line of a multi-line options object, so `/api/v1/categories`,
`/api/v1/tags` and `/api/v1/locales` were flagged and are in fact **correct**. Every claim above is
verified against the emitted `openapi.json`, not against the source regex. **The artifact is the
authority** — which is fitting, since the artifact is also what generated clients consume.

#### The block, stated narrowly

**Taxonomy's implementation lane is BLOCKED at the point the list response shape becomes
load-bearing** — and nowhere else. **FE-3 is NOT blocked globally.** Skills `M2·U2`/`M2·U3`, the INV-1
review, and other sound-contract modules continue in parallel; read-only taxonomy investigation may
also continue provided it does **not** commit to the broken response shape.

**Frontend will NOT:** add a workaround, hand-patch generated types, add another handwritten
cast/generic to normalise the bad schema, modify the API repo from this campaign, or infer a permanent
taxonomy architecture from the incorrect schema. ⚠ The existing handwritten array generic at
`useAdminArticles.ts:215` **has been masking this** and is left untouched — it is not authority, and
treating it as such is what let the defect survive.

**Handoff written:** [`backend-handoff-list-envelope-schema.md`](backend-handoff-list-envelope-schema.md)
— affected endpoints, exact wrong shape, the established correct shape with three independent lines of
evidence, root cause, the requested fix (add the option; **regenerate the artifact**), and a regression
test **with its required positive control** (strip `isArray` from a currently-correct endpoint and
prove the test fails, since a test asserting a property four endpoints violate passes trivially once
they are fixed).

**After the fix:** reconcile Web's vendored `openapi.json` through the established generation workflow
— preserving the byte-identity with API `origin/main` that is this campaign's contract guarantee — then
unblock taxonomy and **re-run INV-2's architecture question against the corrected contract**, because
its inline-editing recommendation rests on the list carrying every editor field, which the broken
schema makes unverifiable.

#### INV-1 (Testimonials) — **REVIEWED AND ACCEPTED 2026-08-19. Both escalations CLOSED by evidence; neither needed the owner**

Re-derived from `openapi/openapi.json` and, where the contract was silent, from the API **source**
(read-only; the API repo was not modified). Every load-bearing claim held:

| Claim | Verified |
| --- | --- |
| Detail `GET /admin/testimonials/{id}` exists | ✅ — so the collection-plus-editor pattern replicates with a real entity read |
| Admin list is an **array**, `parameters: []`, no `meta` | ✅ unpaginated, unfiltered, no declared ordering |
| `CreateTestimonialDto.required` | ✅ `['order','isVisible','translations']` |
| `UpdateTestimonialDto` required | ✅ **none** — every property optional |
| `TestimonialTranslationDto` | ✅ requires **all four** of `locale, quote, authorName, authorRole` |
| `translations` has **no `minItems`** | ✅ so `[]` is contract-admissible — **the OD-14 situation exactly** |
| `avatarId` is the **only** nullable on both DTOs | ✅ — structurally parallel to Skills' `brandColor` |

**Escalation 1 — translation PATCH upsert vs replace: CLOSED, and it was a RE-RAISE of settled
knowledge.** `testimonials.service.ts:94` runs `prisma.testimonialTranslation.upsert(...)` in a loop
over the supplied translations and **never deletes**. So PATCH **upserts supplied locales and
preserves omitted ones**, and emptying a server-held locale is BLOCKED — which is §10.3 rule 6
verbatim, already established by this campaign. No owner decision was required; the reviewer's job
here was to notice the question was answered, not to answer it.

**Escalation 2 — does `avatarId: null` clear? CLOSED.** `testimonials.service.ts:85` assigns
`avatarId: dto.avatarId` straight into a Prisma update: `undefined` (omitted) is ignored by Prisma and
**PRESERVES**; explicit `null` **CLEARS**. That is the `null`-clears / omission-preserves inverse pair
exactly, and it is the defect class `M2·U1`'s two inverse controls exist for. The existing
`MediaPicker` already emits `null` on clear, so the shipped component is correct as-is.

⚠ **Both escalations were resolvable from evidence the lane could have reached.** The lane was
right to escalate rather than guess — but the standing note for future briefs is that "the contract
is silent" is a reason to read the **implementation**, not automatically a reason to stop.

**Verdict: INV-1 ACCEPTED. Testimonials is contract-sound and is the next write-lane candidate after
Skills.** Its translation DTO carries four required fields against Skills' two, so it is a genuinely
different replication case rather than a copy.

#### INV-1 escalations — the original text, kept as raised

INV-1 raises two contract-silence questions: (1) whether translation PATCH **upserts or replaces**, and
(2) whether `avatarId: null` reliably **clears**. ⚠ **Question 1 looks already-settled by this
campaign** — §10.3 rule 6 records that the PATCH **upserts and never deletes**, which is why emptying a
server-held locale is BLOCKED — so the reviewer's first job is to check whether INV-1 re-raised a
resolved question rather than to answer it fresh. Question 2 is the `null`-clears-vs-omission-preserves
distinction that `M2·U1`'s inverse-pair controls exist for; treat it as a **contract read**, not a
design choice.

⚠ **One owed item closed silently, and is re-opened here.** §9.5 ended *"Attribution belongs to
`M1·U5`"* — meaning the `DASHBOARD_APP_OWNED_BASELINE_BYTES` provenance drift (nine routes, deltas in
**both** directions, the Experiences collection's `+1,853 B` recorded as *plausible, NOT measured to
attribution*). `M1·U5` (`328bf9c`) does **not** discharge it: grepping its whole §5 section for
`baseline` / `provenance` / `85,551` / `87,404` / `re-stamp` returns **0 matches**. Its "Attribution"
heading is about the **flaky-test** attribution — a different question with the same word. The
baseline-provenance attribution is therefore **still owed**, and is listed in §8 as a named next
action rather than left to be rediscovered.

⚠ **A supersession sweep over the WHOLE ledger followed the §9.5 header fix, and found three more
hits** — because retiring a decision turns previously-true text false, and fixing only the edited
section is not the sweep. Corrected: §2's FE-3 row (asserted `size:routes` exits 2 *"until the owner
rules"*, while the SAME row already recorded `size:routes` 0 on fourteen routes); D20-34's row (the
doc 20 entry it called *owed* landed as Docs `95e9101`); R12's row (pointed at §9.4 as an *open* cap
question — resolved `a0d4dd0`). **Deliberately NOT rewritten:** the `M1·U3` checkpoint's red-gate
paragraph, §5/`M1·U4`'s gate table and §9.5's body are the **record of state as it then stood**, each
already superseded in place by a later entry — history, not a live claim.

⚠ **One stale cross-reference found in `plan.md` and left alone, deliberately.** §5.3 routes
*"Null-clearing semantics (D10-23)"* to *"ledger §9.5"* and *"`gtmContainerId` rename"* to *"ledger
§9.2"*; those sections are today D20-35's caps and OD-3's rich-text editor. The plan's numbering
predates the ledger's, so the targets are unrecoverable by inspection, and its `not implemented`
disposition is a factual claim about the edit forms that this resume did **not** measure. Guessing a
target would manufacture a false citation, which is worse than a dangling one. **Owner/next-session
item**, recorded rather than repaired.

⚠ **Gates were NOT re-run this session.** Every gate result in §5/`M1·U5` remains as *claimed green
at `cf7c515`*, not as re-verified. This resume checked SHAs, branches, worktrees, PRs, remote
absence, stamped caps and the Production pointers — it did not rebuild. Do not let "zero drift" be
read as "gates re-verified". (If a later session does rebuild: `size-limit` reports
`passed:true, size:0` against a MISSING `.output`, and a failed Web build leaves the previous
`.output` in place — assert build success and `size > 0` before trusting any number.)

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
not invent a budget. **Checkpoint 2026-08-19 — MODULE 1 COMPLETE.** `M1·U4` (verdicts, `cbd72f9`), **D20-35** (owner
decision applied: Web `6b59261`, Docs `97efd02` on `docs/web-modernization-campaign`, local-only),
`M1·U4b` (extractions, `fd11c7b`) and `M1·U5` (gates + a11y, `328bf9c`) are all LANDED. `size:routes`
is **green again** — the red state at the previous checkpoint was resolved by the owner's cap
decision, exactly as it was supposed to be.

**Two things deliberately NOT claimed as green**, both carried as risks rather than rounded up:
**R15** — the full e2e suite is flaky at 507 tests (one different failure per run, each passing in
isolation; shard 3, holding all three affected lanes, passed 93/93 in BOTH runs, and the change set
is dashboard-only). **R16** — the Projects browser lane the owner asked to be re-run **does not
exist**; Projects is covered at component level with a negative-controlled copy guard, and building
the lane is the retrofit the owner deferred.

**Next: FE-3 module 2 under OD-12's hybrid model** — the pattern now holds across two modules, so
modules 2–5 are delegable as bounded, disjoint lanes. ⚠ A delegated lane must not invent a competing
shared abstraction: the shared set is now `useTranslatableForm`, `DashboardTranslationTabs`,
`DashboardEntityFormActions`, `DashboardEntityEditorSkeleton`, `DashboardSkillPicker` and
`dashboard-translation-errors` — extend it or escalate, never fork it. Read the branch TIP with
`git rev-parse HEAD`, never from this paragraph.

---

## 2. Phase status

| Phase | State |
| --- | --- |
| **FE-1 — Contract & Integration Foundation** | **COMPLETE** — commit `19e3a05`. Contract adopted + gtm reconciliation; reply flow deliberately moved to FE-2 (see §4). Gates re-verified on the committed tree: typecheck 0, 1501/1501. |
| **FE-2 — Articles Tracer Bullet + Dashboard Architecture** | **COMPLETE.** OD-11, OD-3, D20-33 and its amendment all resolved. FE-2a/2b/2c done: F-1 **CLOSED** with browser evidence · collection · editor · §14.6 extraction pass · **all ten §14.9 criteria demonstrated** · every gate green including `size:routes`. The reusable architecture is recorded in **§10**. |
| **FE-3 — Content Module Replication** | **COMPLETE — CLOSED at SEO-U4 (2026-08-23).** All five content modules + the shared per-entity SEO panel implemented, verified and inside governance: Experiences, Skills, Testimonials, Taxonomy, plus `DashboardSeoPanel` serving Articles + Projects (the only entities the contract gives SEO fields), Projects null-clear fixed and browser-proven on the wire, R16 closed by the official `dashboard-projects` lane. Final evidence (§5/SEO-U4): clean provenance-stamped build (`632b160…`), all 21 governed routes inside frozen caps (`size:routes` exit 0, zero unclassified), CSS 28.1 KB gz / 30 PASS, typecheck/typecheck:e2e/lint exit 0, unit 144 files / **2102 tests exit 0**, Articles lane 48/48, Projects lane 21/21 (unfiltered axe EN+AR+loading, 380px both locales), full suite 614/616 with both casualties classified as the R15 load class (did not reproduce sharded), sharded suite **616/616 exit 0**, R14 conclusion (B) recorded as recommendation-only, R15 remains OPEN precisely stated. No FE-3 product scope remains open. **FE-4 is next.**<br>**Historical module record (superseded in verdict by the closure above, preserved for the record):** Delegation settled as **OD-12** (hybrid: module 1 in-house, modules 2–5 delegable once the pattern holds). `M1·U1` landed the instrument; **`M1·U2` landed the collection at `/dashboard/experiences`, its `lanes.ts` record, and a third public-isolation gate** — every gate green, the lane 10/10 booting 1 pair, and the route measured at 85,551 B against its own D20-34 cap of 99,328 B. The new route cost **zero CSS**. Four unpredicted findings are in §5/M1·U2, including a gate (`typecheck:e2e`) that had been RED since `M1·U1` because that unit's exit row never listed it. **`M1·U3` landed the editor** (`7e6d11a`): bilingual, Zod + `UForm`, 422→locale-tab mapping, the shared skill picker, `isCurrent`⇄`endDate` on a field-owned error path, and the calendar-date read that Articles' instant-shaped converter would have got wrong. Three rules were each proven able to fail; the `technologyIds` omission control failed **only** the clear-case test, which is the empirical reason both tests exist. Four more unpredicted findings are in §5/M1·U3, including a backend crash that reported itself as eight failing tests. Its route caps were **measured and escalated, never inherited** — the batched decision is **§9.5**, which the owner then **RESOLVED as D20-35** (caps stamped: Web `6b59261`, Docs `97efd02`), clearing the transient `size:routes` exit 2 that this row previously described as current. ⚠ That exit 2 was a MEASUREMENT FAILURE, never a budget breach — the distinction is kept because it is the reason no cap was invented to silence the gate. **`M1·U4b` performed the three HELD extractions** (`fd11c7b`) and **`M1·U5` closed the gates** (`328bf9c`): every authoritative gate green, axe unfiltered in BOTH dashboard languages across four surfaces, 380px verified, `size:routes` 0 on fourteen governed routes, CSS unchanged at 29.19 KB gz. Two findings kept out of the green claim: the full suite is flaky at 507 tests (**R15**, not attributable — shard 3 passed 93/93 twice) and **there is no Projects browser lane to re-run** (**R16**, measured at 0 matches). Module 1 is otherwise CLOSED; modules 2–5 are delegable under OD-12 now that the pattern holds.<br>**`M1·U4` rendered the verdicts**: **five of five §5.2 predictions HELD**, plus a sixth candidate (`DashboardSkillPicker`) discovered and already extracted — measured on 56 byte-identical code lines, 34% of the Experiences editor. The three HELD extractions are **queued, not performed**: acting on them refactors the shipped `ArticleEditor` and needs both lanes re-run, so it is its own unit — **`M1·U4b`, the extraction pass, is next**, then `M1·U5` (gates + axe).<br>**Lane-strategy unit (R14):** A run now boots only the lanes it selected: measured 1 preview pair for `--project=dashboard-articles`, against 10 before, same command. The full suite still boots all ten by design, so R14 is **NARROWED, NOT CLOSED** — see §6 and §5/FE-3/U-1. ⚠ This row previously said the full suite "loses exactly one test per run"; the pre-change control run **did not reproduce that** (471 passed, exit 0) and the claim is corrected here rather than carried forward. |
| FE-4 — System Modules | **COMPLETE — U1a–U1f and U2e1–U2e3 landed.** U2e3 final closure is recorded below at Web `f64a227`; the governed build, canonical E2E, static gates and Lighthouse all pass. Docs D20-42 and its synchronized bundle are at `d6cbb84`. |
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
| **D20-34** | **RESOLVED 2026-08-18 — `/dashboard/experiences` carries a 99,328 B app-owned cap**, derived by D20-29's formula from its OWN measured baseline (85,551 B), not inherited from the Articles collection. The owner declined rounding it to 100 KiB for visual consistency: *"the route should carry the cap derived from its own measured baseline under the governed formula."* Not a waiver, not a shared-floor change, not an incremental-allowance change, not a D20-32 recalibration. ⚠ Standing instruction attached to it: **do NOT inherit this cap for the Experiences editor routes — measure the real editor surfaces first and return with one batched decision.** Mirrored in `DASHBOARD_APP_OWNED_CAP_BYTES`; the doc 20 decision-log entry was owed at the time of writing and has since **LANDED** — Docs `95e9101` on `docs/web-modernization-campaign` (local-only). |
| **OD-14** | **RESOLVED 2026-08-19 — a Skill must carry AT LEAST ONE non-empty translation before it can be saved; it must NOT require every configured locale.** Three states, and the middle one is the point: **zero translations → INVALID, block save · one → VALID but INCOMPLETE · all configured → VALID and COMPLETE.** The completeness indicator stays meaningful and must expose the incomplete state. ⚠ **This is a FRONTEND AUTHORING / PRODUCT invariant.** The API contract declares no `minItems` on `translations` and the database is not known to enforce it — **do not claim either does**, and **do not modify the Backend/API to add it from this campaign**. Owner's rationale: a Skill with no localized label has no meaningful human-facing representation, while requiring all locales up front would block incremental bilingual authoring. **There is no mandatory primary authoring language** — English-first and Arabic-first are both valid. Full record and its test consequences: **§9.6**. |
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

### FE-3 · Module 1 · **M1·U4** — the extraction verdicts, rendered against measurement

§5.2 stamped five predictions before the editor existed, precisely so this unit could not rewrite the
target after seeing the code. All five are rendered below, plus a **sixth** that `M1·U3` discovered.

#### The evidence, measured rather than argued

Non-trivial code lines (≥40 chars, comments and markup-only lines excluded) that are **byte-identical**
between `ArticleEditor.vue` and `ExperienceEditor.vue`:

| | |
| --- | --- |
| `ArticleEditor.vue` | 196 code lines |
| `ExperienceEditor.vue` | 164 code lines |
| **Identical in both** | **56 lines — 34% of the Experiences editor** |

That 34% is not spread evenly. It clusters into exactly three regions, and the clustering is what
decides the verdicts:

1. **The 422 / error-summary / tab-activation machinery** — `serverFieldErrors`, `fieldErrorSummary`,
   `localesWithErrors`, `applyFieldErrors`, `onValidationError`, `focusFirstError`, the summary
   markup, and the `watch` that clears a stale server error. The largest and most exactly duplicated
   block.
2. **The locale-tab rendering** — the fill/invalid badges, the fill→colour mapping, the
   per-panel `dir`, `:unmount-on-hide="false"`.
3. **The surrounding form chrome** — the unreadable alert, the skeleton, the sticky action bar, the
   save-state line, the two-step delete.

#### The verdicts

| Candidate | §5.2 predicted | Verdict | Evidence |
| --- | --- | --- | --- |
| `TranslationTabs` | EXTRACT | **HELD** | Region 2 is duplicated essentially verbatim — the badge logic, the colour mapping and the per-panel direction rule are identical, and only the FIELDS inside each panel differ. That is precisely a component with a per-locale slot. A real second shape, as predicted. |
| `useTranslatableForm` | EXTRACT | **HELD, and it is the STRONGEST of the three** | Region 1 is the biggest identical block in the file and it is pure behaviour, not markup. Both modules independently arrived at the same six pieces of state and the same three functions. ⚠ The prediction's stated reason — "a second, *shorter, all-required* field list" — also HELD and is the discriminating part: `experienceMissingFields` / `experienceFillState` / `experienceTranslationInUse` differ from Articles' only in WHICH list they walk, so the abstraction is over the field list, not over the entity. |
| `EntityFormLayout` | PARTIAL AT BEST | **HELD — and the prediction's REASON held too, which matters more than the label** | Region 3 duplicates, but the publish/schedule region duplicates NOWHERE: Experiences has no `status`, no `publishAt`, no preview and no publish shortcut, exactly as Projects has none. Two entities lacking that region is evidence it is Articles-specific. What IS shared is the generic chrome — unreadable alert, skeleton, sticky actions, save-state, two-step delete — so "partial" is the correct shape: extract the chrome, leave the publication region in Articles. |
| `usePublicEntityLink` | NO SECOND CONSUMER | **HELD** | Settled at `M1·U2` and re-confirmed by construction: `ExperienceEditor` ships NO "View on site" action, because `/experience` is one public page for every role and no per-entity destination exists. §10.3 rule 10 stays unsatisfiable here. |
| `admin-articles-query` | NO SECOND CONSUMER | **HELD** | Settled at `M1·U2`. No query composable was written because the endpoint declares zero parameters. |
| **`DashboardSkillPicker`** *(sixth — discovered, not predicted)* | — | **EXTRACTED at `M1·U3`, by observation** | Same relation, same vocabulary, same replace-wholesale semantics, second real consumer — §14.6's bar met by evidence rather than anticipation. Recorded here so the pass reports six verdicts against a tree that made six changes, not five. |

**Five of five predictions HELD.** That is worth stating plainly rather than glossing: the contract
alone was sufficient to predict every verdict correctly before the code existed, which is evidence
that the §5.2 method works — and it is exactly why a wrong prediction would have been worth as much.

#### ⚠ What this unit does NOT do, and why

**The three HELD extractions are NOT performed here.** Acting on them refactors `ArticleEditor.vue`
— a **shipped, gate-covered surface** — and therefore requires re-running the Articles lane, the
Experiences lane, the full unit suite, a rebuild and a re-measurement of every governed dashboard
route. That is a heavy unit in its own right, and it is exactly how Articles did it: FE-2c's verdicts
and its extraction pass were separate commits, with the extraction landing as `944443f`.

Starting that refactor without the budget to finish it would leave a shipped editor mid-edit, which
is the one state a checkpoint exists to prevent. **The verdicts are the deliverable §5.5 asked of
`M1·U4`** ("Every prediction marked HELD or WRONG, with the evidence"); the extraction is queued as
the next unit and is named in §8.

---

### FE-3 · Module 1 · **M1·U4b** — the extractions, performed

Commit **`fd11c7b`**. The three `M1·U4` verdicts acted on, each moved only after the duplication was
measured across both editors. `ArticleEditor` 769 → 628 lines, `ExperienceEditor` 672 → 524.

| Extracted | What it owns |
| --- | --- |
| `useTranslatableForm` | the 422 / error-summary / tab-activation machinery — the largest identical block, and pure behaviour |
| `DashboardTranslationTabs` | the locale tabs, with a per-locale slot for the fields |
| `DashboardEntityFormActions` | the sticky action bar, the save-state line and the two-step delete |
| `DashboardEntityEditorSkeleton` | the editor-shaped loading state |

**What was deliberately left behind**, under the owner's "extract only proven boundaries, do not
build a generic CRUD framework":

- **The publish/schedule region.** It duplicates NOWHERE. It reaches the shared action bar through
  `#leading` and `#actions` slots, and **no prop in that component describes a status**, so it cannot
  learn what publishing is.
- **The unreadable alert**, though it duplicates structurally: three conditional titles and three
  conditional descriptions, all entity copy. A component would drill six strings through a prop bag
  and buy nothing. That is the owner's rule applied to a case that *looked* extractable.
- **Every form model, schema, payload builder and clearing semantic.** Merging those is the generic
  layer that was ruled out.

**Four per-module 422 wrappers were deleted.** `article`/`experienceFieldErrorName` and `…Locale`
existed only to narrow the shared functions' `string` locale at the call site; the composable is
generic over the locale type, so that narrowing happens there and the wrappers became dead
production code tested by nothing but their own specs. Removed after a **repo-wide** survey (`ts`,
`vue`, `mjs`, `md`) rather than a file-scoped one — which is what found the prose citation in
`admin-article-types.ts` that would otherwise have been left pointing at a deleted symbol. No
coverage was lost: `dashboard-translation-errors.spec.ts` already owns every case they asserted.

The composable is now the **single point of failure for both editors' error handling**, so it is
tested directly rather than only through whichever editor happens to exercise it. Negative control:
suppressing the tab activation failed **4 of its 11** tests.

#### ⚠ The extraction COST bytes rather than saving them

| Route | before | after | Δ | cap | spare |
| --- | --- | --- | --- | --- | --- |
| `/dashboard/articles` | 91,631 | 91,631 | **+0** | 102,400 | 10,769 |
| `/dashboard/articles/new` | 107,383 | 112,102 | **+4,719** | 122,880 | 10,778 |
| `/dashboard/articles/{id}` | 107,491 | 112,210 | **+4,719** | 122,880 | 10,670 |
| `/dashboard/experiences` | 87,404 | 87,404 | **+0** | 99,328 | 11,924 |
| `/dashboard/experiences/new` | 105,051 | 109,782 | **+4,731** | 120,832 | 11,050 |
| `/dashboard/experiences/{id}` | 105,159 | 109,890 | **+4,731** | 121,856 | 11,966 |

Both COLLECTIONS are unchanged at **+0 B**, which is the per-module field split still holding — a
list route pulls in none of this. The two editor deltas are near-identical, so the cost is
attributable to the shared chunks rather than to noise. **This buys one implementation of the error
machinery instead of two; it does not buy bytes.** §10.1 recorded the Articles field split as worth
6,211 B, so this codebase judges extractions in bytes too, and this one goes the other way. Every
route stays inside its cap. ⚠ D20-35's recorded baselines are **not** re-stamped to match:
re-deriving from the post-extraction tree would RAISE the caps to 126,976 B, which nobody authorised.

Also repaired: `dashboard-closure.spec.mjs`'s exact route list, which **D20-35 should have extended**.
It failed on the full unit suite, which the D20-35 commit did not run — that commit verified
`route-assets.spec.mjs` and `size:routes` only. The gate did its job; the process around it did not.

---

### FE-3 · Module 1 · **M1·U5** — the authoritative gates

Commit **`328bf9c`**.

#### The defect the new test CLASS found, in shipped code

Adding an axe scan of the editor's **LOADING** state immediately failed — `page-has-heading-one`, in
**both** dashboard languages. Each editor renders three exclusive branches (unreadable / resolving /
ready) and the `<h1>` lived inside the ready one, so while the entity loads the page is a skeleton
with **no level-one heading at all**.

⚠ **This was PRE-EXISTING in the shipped Articles editor.** The Articles lane axes its editor only in
the SETTLED state — its `openEditor` helper waits for the form before scanning — so the loading state
had never been scanned and the violation had never been reported. It was found by adding a test
*class*, not by looking harder at an existing one: a skeleton is gone by the time an ordinary scan
runs, and only holding the response makes it scannable. Fixed in both editors; the heading now sits
above all three branches, which is correct anyway because the title depends only on create-vs-edit.

The finding IS the negative control: before the fix, exactly the two editor-loading scans failed, one
per language, and nothing else.

#### Gate results, on the committed tree

| Gate | Result |
| --- | --- |
| `typecheck` | exit 0 |
| `typecheck:e2e` | exit 0 |
| `lint` | exit 0 |
| unit | **1808/1808**, exit 0 |
| `size` (R13 / CSS) | **29.19 KB gz / 30.00** — UNCHANGED across the whole module. FE-3 module 1 cost **zero public CSS**, so R13's ~0.81 KB headroom is untouched |
| `size:routes` | exit **0** — all fourteen governed routes inside their caps |
| `check:logical` | exit 0 |
| `check:bundle` | exit 0 |
| `dashboard-experiences` lane | **34/34** exit 0 (10 of them the new a11y/380px tests) |
| `dashboard-articles` lane | green after the shared extraction — **84/84** across both lanes, exit 0, 2 pairs |
| axe EN + AR | collection settled · collection loading · editor settled · editor loading — **all unfiltered**, no rule disabled, no selector excluded |
| 380px | collection and editor, both languages, viewport asserted before measuring |

#### ⚠ The full suite is NOT reliably green on this machine — stated rather than rounded up

`npm run test:e2e:sharded` (11 lanes, ≤4 concurrent pairs) was run **twice**. **507 tests**; each run
had **exactly one failure, and a DIFFERENT one each time**:

| Run | Failure | Isolated re-run |
| --- | --- | --- |
| 1 (contended — a full unit suite was running alongside it, which was a scheduling mistake) | `contract › Home EN → AR — switched head state` | **PASSES** |
| 2 (clean, nothing else running) | `settings-dedupe › / costs one request…` — *"expected one live render, got 2"* | fails once, then **PASSES** on retry |

Neither reproduces the other, and both pass in isolation, so these are **flakes, not regressions**.
The `settings-dedupe` one is the known request-count class: `/` is `swr:60`, so a cached render can
satisfy a navigation the test expects to cost one live read. That lane already sets
`readyPath: '/about'` specifically so its own probe cannot warm the counter — the mitigation exists
and is incomplete.

**Attribution.** This campaign's change set is entirely dashboard components/composables, dashboard
i18n keys, e2e specs and budget scripts (`git diff --name-only 75cc391^..HEAD`) — nothing that
renders on `/` or issues a settings read there. And **shard 3, which holds all three affected lanes
(`dashboard-login`, `dashboard-articles`, `dashboard-experiences`), passed 93/93 in BOTH runs.**

Recorded as a finding rather than reported as green. See **R15**.

#### ⚠ The Projects regression lane the owner asked for DOES NOT EXIST

The owner's instruction was to re-run "the relevant Projects browser/E2E lane" before declaring M1
complete. There is none, and this is measured rather than assumed:

- `grep -rn "dashboard/projects" e2e/` → **0 matches**. No e2e spec anywhere visits a Projects
  dashboard route. (`project-detail-cache` is the PUBLIC project page's cache lane.)
- The only browser coverage of the shared picker in the repository is the **Experiences** lane, which
  this campaign wrote — and it exercises the picker hard: seeded selection, deselect-to-empty,
  add-to-empty, and the request body on save.

**What WAS run, and it is stronger than "unit tests":** `ProjectEditor.spec.ts` uses
`mountSuspended(ProjectEditor)` — the **real** Nuxt runtime with real child resolution and **no
stubs** — so `DashboardSkillPicker` is genuinely mounted. It asserts seeding from the project,
toggling with the replace-wholesale payload, and the unknown-id preservation. **36/36 green.**

A guard was added for exactly what this change touched: the picker's copy moved from keys it looked
up itself to **label props the parent passes**, which fails quietly by rendering the literal string
`undefined` while every attribute-based assertion still passes. Negative control: misspelling one
label key on the Projects side failed **that test and only that test** — the other 35 passed against
the broken copy, which is the proof the guard is the only thing that would have caught it.

**What is still NOT covered for Projects:** a real Nitro render, real HTTP, layout/CSS, the picker's
filter interaction, its pending/skeleton state, and axe. Building that lane is a **Projects retrofit**,
which the owner explicitly deferred. Carried as **R16** for the owner's decision.

#### R14 at this boundary

Unchanged and **not tripped**: the module added **no lane and no server pair**. Lane count **11 < 12**.
A two-lane run booted exactly **2** pairs; the sharded full run held to **≤4** concurrent pairs by
design.

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
| ~~**R12**~~ | ~~`/dashboard/articles` ships UNMEASURED.~~ **CLOSED by D20-33** (`e0128c2`, Docs `3f2626e`). Superseded by the cap question in §9.4, itself **RESOLVED 2026-08-18** (`a0d4dd0`, 122,880 B). |
| **R14** | **CLOSED 2026-08-24 — sharded execution is the default full-suite strategy (see §5/R14-closure checkpoint).** Historical narrowing record: **NARROWED 2026-08-18 (FE-3/U-1), not closed.** The e2e suite's FIXED COST exceeds this machine — deterministic and re-measured: a full run peaks at load **17.4** on 12 cores, drives available memory to **5.9 GB** and adds **~1 GB of swap**, for ten Nitro servers at 140–290 MB RSS each plus ten backends. What is FIXED: a run now boots only the lanes it selects (**1 pair** for a one-lane run, against 10, same command — §5 FE-3/U-1), so per-module development runs and the `test:e2e:repeat` sweeps no longer pay for the whole farm. What is NOT: `npm run test:e2e` still selects nothing and therefore still boots all ten, so **FE-3's five modules still take it to 15 pairs on the default path**. `npm run test:e2e:sharded` bounds it to 4 concurrent pairs and is available but is NOT the default, because the intermittent casualty did not reproduce (see the amendment in §5 FE-2c/U-5) and a governed CI gate must not be re-pointed on unreproduced evidence. **Trigger to make it the default:** either a full-suite casualty reproduced on demand, or the lane count passing **12**. ⚠ **RE-CHECKED 2026-08-18 when `M1·U2` landed the eleventh lane: the trigger is NOT tripped.** 11 < 12, and no casualty has been reproduced — the last full-suite control run was 471 passed / exit 0. Recorded explicitly rather than passed over in silence, because the check was owed at this exact point and a silent non-event is indistinguishable from a forgotten one. The **third** FE-3 module reaches 12 and trips it on lane count alone. Also confirmed live: a one-lane run still boots exactly **1 pair** (4100/4101), so U-1's narrowing holds with a lane added. ⚠ **RE-CHECKED AGAIN at `M1·U3`, because the check was owed at that boundary too: still NOT tripped.** The editor added **no lane and no server pair** — a mutable lane owns exactly one spec file, so its tests joined the existing one and rode the pair `M1·U2` had already booted. Measured live at **1 pair** across a 26-test run; lane count **11 < 12**; no casualty reproduced. CI's behaviour stays UNVERIFIED — fewer cores, and nothing is pushed. |
| **R15** | **The full e2e suite is not reliably green on this machine.** Two `test:e2e:sharded` runs over 507 tests each produced exactly ONE failure, a DIFFERENT one each time, and both passed on isolated re-run — `contract › Home EN → AR switched head state`, and `settings-dedupe › / costs one request` (*"expected one live render, got 2"*). The latter is the known request-count class: `/` is `swr:60`, so a cached render can satisfy a navigation the test expects to cost one live read; that lane's `readyPath: '/about'` mitigation exists and is incomplete. **Not attributable to FE-3** — the change set is dashboard-only, and shard 3 (all three affected lanes) passed 93/93 in BOTH runs. ⚠ Do NOT "fix" these by re-running until green; the correct repair is to make the count-based assertions robust to SWR, on a non-SWR route or behind a count guard. Related: running a full unit suite CONCURRENTLY with the sharded e2e run reproduces R14's resource ceiling and manufactures unrelated failures — run them one at a time. |
| **R16** | **There is NO Projects browser/e2e lane, and the shared `DashboardSkillPicker` now has two consumers.** Measured, not assumed: `grep -rn "dashboard/projects" e2e/` returns **0**. The picker's browser coverage comes entirely from the Experiences lane. Projects is covered at component level by `ProjectEditor.spec.ts` (`mountSuspended`, real child resolution, no stubs, 36/36) plus a new copy-regression guard that was negative-controlled. NOT covered for Projects: real Nitro render, real HTTP, layout/CSS, the picker's filter interaction, its pending state, and axe. The owner deferred a Projects retrofit; this row exists so the gap is a decision rather than an oversight. |
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

### 9.5 D20-35 — the Experiences editor routes' caps · **RESOLVED 2026-08-18 — CAPS STAMPED**

⚠ **This subsection was left headed `OPEN` after the owner ruled; the header was corrected at the
fourth zero-trust resume (2026-08-19).** The decision below was taken, and it is applied in code:
`scripts/lib/route-assets.mjs` carries `'/dashboard/experiences/new': 118 * KB` (**120,832 B**) and
`'/dashboard/experiences/…/{id}': 119 * KB` (**121,856 B**) — the two formula caps this section
asked for, verified live rather than taken from prose. Web `6b59261`, Docs `97efd02`
(`docs/web-modernization-campaign`, local-only). `size:routes` is green again on fourteen governed
routes. **The text below is preserved as the record of the decision as it was raised** — in
particular its closing do-not-re-stamp warning, which is STILL LIVE and still binding.

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

#### ⚠ **DISCHARGED 2026-08-19 — and the finding's own premise did not survive measurement**

Owed to `M1·U5`, never received, re-opened at the fourth resume, closed here as its own unit under
OD-15. **Measured, not argued.** The headline: *"the recorded baselines no longer reproduce"* is
**false as stated**. They reproduce exactly — at the tree each was measured on. The comparison above
was a **category error**: a historical derivation input read against a later tree.

#### The instrument, and why it can be believed

Per-module `renderedLength` for a route's closure, keyed by **module id** (never chunk filename, so
build-to-build hash churn cannot manufacture a delta), reusing the gate's own `resolveDashboardClosure`,
`attributeRenderedBytes` and `classifyModuleId` so it cannot drift from what `size:routes` enforces.
`/dashboard/**` is `ssr: false`, so the closure comes from build metadata alone — no preview server.

| Control | Result |
| --- | --- |
| **Negative** — build `HEAD` twice, compare | **0 of 14 routes differ; 0 modules differ.** Build-to-build noise is exactly zero |
| **Positive (first attempt) — INVALID** | A 4,000 B unused `export const` probe moved the number by **0 B**. `renderedLength` is POST-tree-shaking, so an unused export contributes nothing **by construction**. Recorded rather than quietly re-run: read as a pass it would have "proved" sensitivity while proving none |
| **Positive (redone)** | Probe referenced from the template so the build must retain it → delta localised to **exactly one module**, the right one. ⚠ Magnitude was **+32 B, not +4,000** — the literal was eliminated anyway (absent from every output chunk). So this control proves LOCALISATION, and does **not** prove magnitude fidelity |
| **Reproduction (the control that actually settles it)** | Rebuilding `fd4e9df` reproduces `/dashboard/experiences` = **85,551 B, exact to the byte** — an independent reproduction of a measurement taken in another session. And rebuilding `7e6d11a` reproduces **all nine** of §9.5's "Measured" values **9-for-9**. Two historical measurements, reproduced exactly, by an instrument that had never seen them |

⚠ **The reproduction claim is narrower than it reads, and the narrowing was itself measured.** Exactly
**ONE of the eleven** baselines has been reproduced at its own provenance tree — `/dashboard/experiences`
at `fd4e9df`. An attempt to extend it to the three **Articles** baselines **FAILED**: rebuilding
`944443f`, FE-2c's last commit, measured **91,022 / 106,776 / 106,884** against the recorded
**88,344 / 106,095 / 106,203**. So `944443f` is **RULED OUT** as their provenance tree, and because the
recorded values are *lower* than it produces, the real measurement **predates** it. Their provenance is
therefore recorded as **UNRESOLVED** rather than guessed, and resolving it needs an FE-2c bisect.

**This does not weaken the finding — it sharpens it.** "The baselines do not reproduce **at HEAD**" is
now explained and expected. "They reproduce at their own tree" is **proven once, refuted nowhere, and
untested for nine.** Both statements are in the code comment in exactly those terms, because the
failure to reproduce Articles at `944443f` is precisely the kind of evidence that a general claim would
have buried.

The last row is why the synthetic probe's weakness does not undermine the result: the instrument is
validated against real recorded numbers, which is a stronger claim than any injected probe.

#### The attribution, exact and with no remainder

`/dashboard/experiences`, `fd4e9df` (`M1·U2`) → `7e6d11a` (`M1·U3`): **+1,853 B across exactly four
modules, summing to the delta with nothing left over.**

| Δ bytes | Module |
| --- | --- |
| **+1,345** | `app/composables/useAdminExperiences.ts` |
| **+187** | `app/composables/admin-experience-fields.ts` |
| **+161** | `app/pages/dashboard/experiences/[id].vue` (route module, ADDED) |
| **+160** | `app/pages/dashboard/experiences/new.vue` (route module, ADDED) |

**The cause is architectural, and it generalises to every module FE-3 has left.** The COLLECTION
route pays for the EDITOR's growth, because both share one composable inside the collection's static
closure. Nothing regressed; the editor simply arrived. ⚠ **This is a live prediction for `M2·U3`:**
building the Skills editor will raise the Skills COLLECTION's measured bytes, and that is expected
behaviour, not a defect to hunt. It is also the measured argument for §10.1's `*-fields.ts` /
`*-form.ts` split — the split is what keeps this charge small.

#### ⚠ The ledger's own hypothesis is REFUTED — and it was right about the count

§9.5 proposed *"the ~50 new i18n keys × 2 locales, plausible, NOT measured to attribution."* The key
count was **correct**: `git diff fd4e9df 7e6d11a` shows **50 net new keys per locale** (51 added, 1
removed, in both `en.json` and `ar.json`), +6,778 B of raw JSON across the two.

**But those bytes cannot reach this number at all.** `i18n/locales/**` has **ZERO module records in
the entire client build** — not zero in this route's closure, zero in all 121 chunks — because
nuxt-i18n loads locale messages outside the Rollup module graph the gate measures. Translation
growth is structurally incapable of moving an app-owned route measurement.

⚠ **A correct-looking number nearly confirmed a wrong mechanism.** +6,778 B of raw i18n against a
+1,853 B route delta is the same order of magnitude and would have read as "some of it landed" under
any estimate-based check. Only per-module attribution separates *the right count* from *the right cause*.

#### Two findings this measurement uncovered that §9.5 does not contain

1. **ELEVEN routes carry baselines, not nine — and all eleven drift.** §9.5 predates the D20-35
   editor baselines drifting. On the current tree `/dashboard/experiences/new` is **109,711** against
   a recorded **105,051** (+4,660) and `/dashboard/experiences/…/{id}` is **109,819** against
   **105,159** (+4,660). **Every one of the eleven still PASSES its cap**, with the tightest headroom
   at `/dashboard/articles/…/{id}` = **10,741 B**.
2. **§9.5's own "Measured" column is now stale for the four editor routes, and `M1·U4b` is why.**
   That column was taken at `7e6d11a`; since then `/dashboard/articles/new` moved **107,383 →
   112,031** and `/dashboard/articles/…/{id}` **107,491 → 112,139** (+4,648 each), matching the
   Experiences editors' +4,660 almost exactly. One shared cause across four routes, and it is the
   ledger's own `M1·U4b` finding — *"the extraction COST bytes rather than saving them"* — now
   measured on the routes that pay it.

#### What was changed, and what deliberately was not

**Changed — the record, which is what was wrong.** `route-assets.mjs`'s doc comment claimed the
baselines were recorded *"so each frozen cap can be re-derived from its stated input"* **without
naming a tree** — true of the derivation, false of any reproduction, and it is the sentence the
finding was raised on. It now states the pinning explicitly and carries the measurements above. A new
`DASHBOARD_APP_OWNED_BASELINE_PROVENANCE` map records **which tree each baseline was measured on**, so
*"it does not reproduce"* can never again be raised without answering *"reproduce **where**?"*.

**NOT changed — every byte value.** No baseline re-stamped, no cap moved, no gate re-pointed. The
provenance map carries no bytes and derives nothing; a spec test pins that it cannot acquire the
power to move a cap, because a SHA correction that changed a budget would be the exact failure this
whole finding is about.

**Gates on the committed tree:** `route-assets.spec.mjs` **156 passed**, and both new assertions were
**proven able to fail before being trusted** — entry deleted → fails; value blanked → fails; restored
byte-identical (`sha256` verified) → 156 pass. Each mutation was applied through Python with a module
**parse check before the run**, because `M2·U1` established that a suite which did not run is not a
failing test.

---

### 9.6 OD-14 — the Skills minimum-translation rule · **RESOLVED 2026-08-19 · OWNER**

Raised by the `M2` investigation as escalation 4. My architect ruling had provisionally required ≥1
translation as a client rule while declining to narrow the contract anywhere else. **The owner has now
decided it directly, which replaces my provisional call as the authority** — and supplied substance
the ruling did not have.

#### The rule

| Translations authored | Verdict | Save |
| --- | --- | --- |
| **zero** | INVALID | **blocked** |
| **one** | VALID but **INCOMPLETE** | allowed |
| **all configured locales** | VALID and COMPLETE | allowed |

**The middle row is the whole decision.** Requiring ≥1 and requiring *all* are two different rules,
and the completeness indicator exists precisely to make the incomplete-but-valid state visible rather
than to force it closed. The indicator must therefore keep reporting incompleteness for a one-locale
Skill — it must not be reduced to a validity flag.

#### ⚠ It is a FRONTEND invariant, and the code must say so

`CreateSkillDto.translations` is **required** but declares **no `minItems`** — verified directly
against `openapi/openapi.json`. So the contract permits an empty array, and the database is not known
to reject one.

- **Do NOT comment, document or assert that the API contract or the database enforces this.** This
  ledger's standing rule is that a comment must never claim an invariant the code does not actually
  enforce; here the trap is one step further out — claiming an invariant *another system* does not
  enforce. The Zod schema is the only thing enforcing it, and the comment must name itself as such.
- **Do NOT modify the Backend/API to add it.** Out of bounds for this campaign, and the owner said so
  explicitly. If the backend should enforce it too, that is a separate Backend decision.

#### Test consequences — two of them are discriminating, and one is easy to get wrong

1. **Zero-translation save must be BLOCKED**, and the negative control is removing the rule from the
   Zod schema: the block test must then fail, and it must be the ONLY one that fails. If removing the
   rule breaks nothing, the rule is not what is doing the blocking.
2. **A ONE-locale Skill must SAVE, and must still report INCOMPLETE.** ⚠ These are two assertions and
   a test that only makes the first is vacuous for this decision — the whole point of OD-14 is the
   state that is simultaneously valid and incomplete. Assert both, or the rule is indistinguishable
   from "require all locales" in one direction and from "require none" in the other.
3. **Arabic-only must be a first-class case, not a mirror of the English-only one.** The owner states
   there is **no mandatory primary authoring language**. This lands exactly on the single-locale
   indexed-422 hazard `dashboard-translation-errors` already documents: an Arabic-only payload sends
   ONE entry, so `translations[0]` is **Arabic**, and any resolver pinned to a canonical `['en','ar']`
   attaches the error to the English tab the operator deliberately left empty while the real problem
   stays invisible. That module's own header records the proof: with the resolver pinned, a
   both-locales test still PASSED and only the single-locale test failed. **So the Arabic-only save
   test is not redundant coverage — it is the one that can fail.**

#### Standing instruction attached by the owner

**Do not stop separately for this rule again.** It is settled; implement it and continue. The
route-cap decision remains the one open owner gate for M2 — return with the three MEASURED baselines
and their D20-29-derived caps as **one batched decision**, after the collection and editor routes are
actually implemented and measured. Not before, and never inherited.

### 9.7 OD-15 — the M2 sequencing, and the baseline-provenance unit · **RESOLVED 2026-08-19 · OWNER**

Raised at the fifth zero-trust resume, which reported `M2·U2` as owner-blocked. **It was not**, and
the owner corrected the premise rather than answering the question.

#### Two things this decision retires

1. **`useAdminSkills` absorption is NOT an open owner decision.** It was **already approved** under
   the **preserve-the-surface contract**, and that contract states the terms precisely:
   - absorb it in `M2·U2` **if the implementation satisfies the established contract**;
   - **both shipped picker consumers must remain green WITHOUT being edited** — that is the whole
     test, and it is discriminating: editing a consumer to make it pass converts the evidence into
     its own opposite;
   - **if either consumer requires modification, that is EVIDENCE the absorption broke the preserved
     surface** — and it is then **resolved centrally**, never by patching the consumer.
2. **No route cap may be invented or approved before the route exists and has been measured.** A cap
   is an **output** of the unit, not an input to it. Explicitly: **no cap is inherited from Articles,
   Experiences, or Projects merely for consistency.**

#### The consequence for `size:routes`, stated so it is not "fixed" by someone later

It is **ACCEPTABLE** for `size:routes` to be **intentionally non-green** when the sole cause is that
a new route is *registered but not yet governed* — the same measured-then-decide flow D20-33 and
D20-35 already ran. **Do NOT fabricate a temporary cap to make the gate green.** A gate turned green
by a number invented for that purpose reports nothing, and the invented number then becomes a
derivation input that outlives its excuse.

#### The unit ordering the owner set

**The baseline-provenance attribution is closed FIRST, as its own clean unit** — it is the only
outstanding item that is not owner-gated — and `M2·U2` follows it. Its constraints, verbatim in
force:

- **measure and explain** the provenance mismatch;
- **fix reporting/attribution** if that is what is wrong;
- **do NOT re-stamp historical derivation inputs**;
- **do NOT move governed caps**;
- **do NOT convert `85,551` → `87,404`** merely to make a current report reproduce;
- **distinguish HISTORICAL CAP DERIVATION from CURRENT-TREE MEASUREMENT** — this is the distinction
  the whole finding turns on, and §9.5's warning is the same rule stated from the other side.

#### What `M2·U2` owes when it runs

Build the Skills collection and its **twelfth** lane; perform the approved `useAdminSkills`
absorption; run the **preserve-surface discriminating checks** (both consumers green, unedited);
**re-evaluate R14** now that the declared lane count reaches 12; and measure the completed
`/dashboard/skills` route.

#### ⚠ OD-15 amendment (same day, same owner) — `M2·U2` does NOT stop for the collection cap

An earlier revision of this section ended `M2·U2` by *"returning the measured baseline plus its
D20-29-derived cap as an owner decision"*. **That stop is removed.** The owner directed: record the
measured `/dashboard/skills` baseline and its D20-29-derived **proposed** cap, then **continue
directly into `M2·U3`**, leaving that route **intentionally ungoverned** meanwhile.

**Implement and measure all three routes** — `/dashboard/skills`, `/dashboard/skills/new`,
`/dashboard/skills/{id}` — and **return ONCE** with all three measured baselines and all three
D20-29-derived proposed caps as **one batched owner decision**. This is the same batching §9.6's
standing instruction already asked for; the amendment settles it as binding sequencing rather than
preference, and removes the intermediate stop that would have split the batch in half.

**`size:routes` may remain intentionally non-green across that whole measurement window**, solely
because these newly implemented routes are registered but not yet governed. **Do not invent
temporary caps to make the gate green.**

**Stop earlier only for a genuine owner-level product/architecture decision, or a hard unresolved
blocker.** A cap awaiting measurement is neither.

---

## 8. Exact next action

⚠ **Everything below the NEXT THREE ACTIONS block is HISTORICAL RECORD, not instruction.** This
section was written during FE-1/FE-2 and its sub-phase table still marks **FE-2c "in progress"**
while §2 records FE-2 **COMPLETE**. That table is kept as the FE-2 record and must not be read as a
work queue. The live next action is here, and in §1's `M1·U5` checkpoint — nowhere else.

### MODULE 2 IS **SKILLS**, and the routing is settled — owner decision 2026-08-19 (**OD-13**)

**OD-13 — FE-3 module 2 runs as a BOUNDED CODEX LANE.** The owner ruled that OD-12's delegation
threshold is satisfied: Articles established the tracer-bullet architecture and Experiences proved it
against a materially different module, so module 2 is genuine replication *unless its contract proves
otherwise*. Claude remains **architect, integrator, reviewer, and the authority for every gate**, and
independently inspects the full diff, validates architecture compliance, runs the authoritative
tests, verifies browser behaviour where claimed, and rejects or revises divergence. **All
shared-abstraction changes stay central.** The lane may NOT touch the lane strategy, global CI
behaviour, the governed performance model, the Backend/API repository, or the private Docs repo
unless separately scoped. Codex must **investigate and report before building**, and must report a
contract incompatibility with evidence rather than forking a competing pattern.

**Which module — read from the plan, not chosen for convenience.** The owner explicitly declined to
pull Projects forward to close R16. The FE-3 inventory (plan §5.2, §6/FE-3) is **experiences ·
skills · testimonials · categories/tags**, plus the shared per-entity SEO panel. Module 2 = **Skills**,
and this is **recorded rather than inferred**: §5.4 of the `M1·U3` plan already states *"Skills is
FE-3 module 2"* in as many words.

**Why that ordering still holds after Articles + Experiences — three reasons, all measured:**

1. **Skills is the only FE-3 entity that two ALREADY-SHIPPED modules depend on.** Projects'
   `technologyIds` and Experiences' skills relation both read `GET /admin/skills` through
   `useAdminSkills.ts` / `DashboardSkillPicker`. Making it owner-editable is the one FE-3 module that
   unblocks correctness in surfaces that already exist.
2. **`M1·U3` deliberately took on a debt payable by exactly this module.** §5.4 shipped a minimal
   read-only options source *"marked in its own header as provisional and absorbed by FE-3 module 2
   when the real one lands"*. That debt is due now, and every module landed ahead of Skills extends
   the window in which a provisional composable is the vocabulary source for the whole Dashboard.
3. **Contract shape makes Skills the true replication case.** Measured on `openapi/openapi.json`:
   `/admin/skills/{id}` carries **`get`**, as does `/admin/testimonials/{id}` — but
   `/admin/categories/{id}` and `/admin/tags/{id}` carry only `patch`/`delete` and have **no detail
   read**. So Skills replays the M1 collection-plus-editor pattern faithfully, while categories/tags
   are a taxonomy shape that would force pattern invention on the FIRST delegated lane — the worst
   possible place for it.

**Nothing discovered so far invalidates the order.** R16 does not: Projects is an FE-2-era module,
not an FE-3 one, so promoting it would swap a replication lane for a retrofit — which is precisely
what the owner declined.

### M2 · INVESTIGATION — the first delegated lane, and what I verified rather than accepted

**Dispatch 1 was READ-ONLY**, per the owner's *"investigate first and report before building"*.
Codex CLI 0.147.0, thread `01a016dc-b898-7bd1-899b-9c879d43a104`. The sandbox enforces read-only:
`touchedFiles: []`, `readOnlyViolation: none`, worktree clean after. **No gates were run by the lane
and none are claimed.**

#### Independently re-verified — the report was checked against the contract, not believed

Every load-bearing claim was re-derived here from `openapi/openapi.json` and the repo:

| Claim | Verified |
| --- | --- |
| Skills **is** translatable | ✅ `SkillTranslationDto` = `{locale, label}`, both required; `AdminSkillEntity.translations` is a locale-keyed map |
| `slug` is **immutable through PATCH** | ✅ `UpdateSkillDto` has no `slug` property at all — create-only |
| Only `brandColor` admits explicit `null` | ✅ it is the sole `nullable: true` property on both DTOs |
| The admin list is **unpaginated and unfiltered** | ✅ `parameters: []`, and the 200 schema's only property is `data` — no `meta` |
| DELETE carries a **409** | ✅ `'Skill is linked to a project.'` — and it names ONLY project linkage |
| `dashboard-translation-errors` already covers Skills | ✅ its header names `Create/UpdateSkillDto` among the sixteen |
| `AdminSkill` sits in the **project-owned** type file | ✅ `admin-project-types.ts:29` |
| `SkillGroup` is **already taken** | ✅ `app/utils/resume.ts:17` — a real auto-import collision; `AdminSkillGroup` avoids it |

⚠ **My brief contained an error, and the lane caught it.** It stated an unsolicited `?locale=`
answers **400**. `useApi.ts:14–19` says **422**, and it is right. The implementation rule is
unchanged — every admin call passes `locale: false` — but the next brief must not repeat the wrong
status, and a lane that corrects its briefing is behaving as intended rather than deferring to it.

#### VERDICT — replication HOLDS, and the strongest evidence is what was NOT requested

**Skills is genuine replication.** It has the decisive Experiences shape: unpaginated admin
collection, detail `GET`, one create/edit component, translation-map reads with translation-array
writes, Zod + `UForm`, indexed-422 → locale-tab mapping, delete. **No extension to any of the six
shared abstractions was requested** — which is the outcome OD-12's constraint exists to test, and it
is the first independent evidence that the pattern really is a pattern rather than two similar
modules.

One abstraction correctly **DOES NOT FIT**: `DashboardSkillPicker` edits a `string[]` relation
*against* the skill vocabulary, and a Skill **is** that vocabulary rather than a reference into it.
Recorded because a "does not fit, here is why" is the answer the fork-constraint is meant to produce,
and accepting it is what keeps the constraint honest.

#### My decisions on the escalations, as architect

| # | Escalation | Decision |
| --- | --- | --- |
| 1 | `useAdminSkills` absorption | **APPROVED as proposed, under a preserve-the-surface contract.** Absorb in place; do NOT create a parallel `useAdminSkillsCollection`. `useAdminSkills`, `skillLabel`, `skills`, `pending`, `forbidden`, `failed`, `load` all keep their names and semantics; `AdminSkill` MOVES to `admin-skill-types.ts` under the same export name. ⚠ **The discriminating gate: `ProjectEditor.spec.ts` and the Experiences editor coverage must stay green WITHOUT being edited.** If either needs a change, the absorption broke a shipped consumer and the change is mine, not the lane's. |
| 2 | Three route caps | **Deferred by design, not forgotten.** Measure collection, `/new` and `/{id}` independently and return ONE batched decision — the D20-34/D20-35 procedure. **Caps are never inherited** and never invented to silence a gate; `size:routes` exit 2 in the interim is a MEASUREMENT FAILURE, which this campaign has now handled twice. |
| 3 | R14 lane 12 | **Already handled centrally** — see the re-derivation above. The lane correctly refused to touch lane strategy or CI. |
| 4 | Validation policy | **Do NOT narrow the contract where it is silent.** No hex-only `brandColor` validator and no `<input type="color">` (it cannot express `null`, which is the one clearable field). No integer/nonnegative `order` — that rule was **Experiences'**, and copying it is exactly the replication drift R6 names. **One deliberate exception, which the owner has since decided directly — cite OD-14, not this cell.** My provisional call was ‘the editor requires ≥1 authored translation’; **OD-14 (§9.6) is now the authority**, and it carries substance this ruling did not: the three-state semantics (zero INVALID / one VALID-but-INCOMPLETE / all COMPLETE), the requirement that the completeness indicator keep exposing the incomplete state, and that **no primary authoring language is mandatory**. The commenting constraint survives unchanged and is reinforced there: it is a FRONTEND invariant and the code must not claim the contract or the database enforces it. |
| 5 | Delete linkage | **Model ONLY the documented project-linked 409.** Adding experience linkage would encode backend behaviour no contract states and no test here can observe. If the real backend also blocks on experiences, the instrument is wrong in a way its own tests cannot reveal — recorded as a known limit of the instrument rather than guessed at. |
| 6 | No shared-six extension | **Accepted** — and it is the verdict's main evidence, above. |
| 7 | Navigation ordering | **Append only.** The lane must NOT reorder existing nav entries. The plan's eventual IA order and the shipped nav already differ; reconciling them is FE-5's coherence pass, and doing it inside a module lane would bury an IA change in a CRUD diff. |

#### The unit plan accepted for module 2

`M2·U1` instrument → `M2·U2` collection + lane → `M2·U3` editor → `M2·U4` extraction verdicts →
`M2·U5` gates + axe. It mirrors Module 1's sequence, which is what replication should look like.

⚠ **This blocking claim was WRONG on both counts, and OD-15 retired it — see §9.7.** It read:
*"`M2·U1` is dispatched; `M2·U2` and `M2·U3` are BLOCKED on owner decisions — U2 on the
`useAdminSkills` absorption landing and the collection's cap, U3 on the two editor caps."* The
absorption was **already approved** under the preserve-the-surface contract and was never an open
gate; and a cap **cannot** be an input to the unit that produces the route it governs — it is an
**output**, decided from measurement afterwards. Kept rather than deleted because the error is
instructive: it would have stalled the campaign waiting for a decision nobody was ever going to make,
and it inverted the measured-then-decide order that D20-33 and D20-35 both establish. `M2·U1` did
correctly go first.

### M2 · **M2·U1** — the instrument LANDED, and the controls I re-ran rather than accepted

Commit **`a65aa36`**. The first delegated lane to produce code. Scope held exactly: two new files,
`git status` showed nothing else, and the lane did not commit.

#### Gates — re-run HERE with real exit codes, not accepted from the report

| Gate | Result |
| --- | --- |
| `typecheck` | exit **0** |
| `lint` | exit **0** |
| `npx vitest run scripts/e2e/skills-server.spec.ts` | exit **0** — **30/30** |

⚠ **My first gate run reported nothing, and I nearly read that as green.** `${PIPESTATUS[0]}` was
clobbered by an intervening `echo`, so all three `exit=` lines came back EMPTY while the wrapper
exited 0. Re-run with each status captured to its own variable. This is the repository's own
pipefail rule biting the reviewer rather than the lane.

#### The negative controls, reproduced independently

The lane reported four. **The instrument's pre-control hash it published — `e1d589e8…b719` — matches
the file I reviewed byte-for-byte**, so the controls were run against these exact bytes and not an
earlier draft. I re-ran the inverse pair myself, which is the pair that matters:

| Control | Mutation | Observed | Restored |
| --- | --- | --- | --- |
| explicit `null` CLEARS | treat `null` as omission | **1 failed** — `CLEARS a stored brandColor on explicit null` | byte-identical ✓ |
| omission PRESERVES | treat omission as clear | **2 failed** — the preservation test **and** the empty-PATCH test | byte-identical ✓ |

⚠ **They are inverses and were controlled SEPARATELY, which is the point.** Each mutation breaks a
different test; an implementation confusing the two directions passes a suite that only ever probes
one. This is the defect class that produced module 1's silent relation wipe.

#### A FIFTH control the lane did not run, and OD-14 is why it was owed

Since **OD-14 is a FRONTEND invariant**, the instrument must NOT enforce it — otherwise module 2's
OD-14 tests would pass against the mock instead of against the form, and the frontend rule could be
deleted with the suite still green. The lane wrote a test asserting an empty `translations` array is
accepted with 201, but never proved that test can fail.

**Mutation:** make the instrument reject an empty `translations` array.
**Result:** exactly **1 failed** — `does not invent a non-empty-translations server rule the contract
never declares` — and nothing else. Restored byte-identical (`e1d589e8…b719`), clean re-run 30/30.

⚠ **My first attempt at this control was INVALID and is recorded rather than quietly re-run.** The
mutation was shell-escaped into the file and wrote broken TypeScript, so vitest reported `no tests`
and exit 1. **A suite that did not run is not a failing test** — read as a passing control it would
have "proved" the guard while proving nothing. Re-done through a Python mutation with a parse check
before the run.

#### What the instrument deliberately does NOT do

`order` accepts negative and fractional values, and `brandColor` accepts non-hex strings — both under
my ruling that Skills must not inherit **Experiences'** narrower rules, which is the replication
drift plan R6 names. Both are written in the file header with that reason, not left implicit.

### ⚠ R14 RE-DERIVED AT THE MODULE-2 BOUNDARY — the trigger is reached one module EARLIER than the prose says

Counted live, not inherited: `scripts/e2e/lanes.ts` declares **11** lanes (`contract`,
`ssr-scenarios`, `about-readiness`, `resume-pdf`, `dashboard`, `settings-dedupe`, `dashboard-media`,
`project-detail-cache`, `dashboard-login`, `dashboard-articles`, `dashboard-experiences`).

**Skills lands the twelfth.** R14 states its trip condition two ways that do not agree — *"the lane
count passing **12**"* versus *"the **third** FE-3 module reaches 12"* — and the second is
**arithmetically false**: 11 lanes plus module 2's one lane is 12 at the **SECOND** FE-3 module. The
worked example was wrong, not the threshold.

**What is NOT being done about it, deliberately.** The governed default gate is **not** re-pointed to
`test:e2e:sharded` on this finding alone. R14's own rule is that a governed CI gate must not be
re-pointed on unreproduced evidence, and no full-suite casualty has been reproduced — R15 records two
runs, one failure each, different both times, each passing in isolation. Re-pointing a gate because a
counter ticked over, under a threshold whose own prose is self-contradictory, would be a governance
change made on ambiguity. **`npm run test:e2e:sharded` remains available and is the recommended local
full-suite path meanwhile.** The arithmetic is corrected here so the next boundary check starts from a
true count; whether "passing 12" means *reaches* or *exceeds* is an owner call the moment it is load-
bearing, and it is not load-bearing while the sharded path is opt-in.

### PIPELINE STATE — three lanes in flight (OD-16), set 2026-08-19

| Slot | Lane | Mode | Worktree / branch | Status |
| --- | --- | --- | --- | --- |
| **A** | `M2·U2` — Skills collection + the **twelfth** e2e lane, incl. the approved `useAdminSkills` absorption | **WRITE** | `/home/eslam-muatamed/worktrees/lane-m2-u2-skills` · `lane/m2-u2-skills` | dispatched |
| **B** | `T·U1` — Testimonials e2e instrument (module 3), mirroring `M2·U1` | **WRITE** | `/home/eslam-muatamed/worktrees/lane-t-u1-testimonials` · `lane/t-u1-testimonials` | dispatched |
| **C** | Taxonomy investigation **part 2**, scoped to everything the broken list envelope does NOT touch | read-only | (reads the campaign worktree) | dispatched |

All three branched from `campaign/frontend-v1` at `9a8a673`. Each write lane has `node_modules`
symlinked to the campaign worktree — **do not reinstall in a lane**, and note the symlink when
removing a worktree.

⚠ **Lane C is deliberately fenced.** Its brief states the list-multiplicity question is CLOSED, tells
it not to design around the broken shape, and instructs it to answer **"BLOCKED ON CONTRACT FIX"**
where an answer genuinely depends on the list response. A report that declines those questions is
worth more than one that guesses, and the reconciliation after the API fix is the orchestrator's.

**Integration is SERIAL and is Claude's** (OD-16): inspect the full diff, reject architecture forks,
apply shared/global edits centrally, cherry-pick into the campaign branch, run the authoritative
gates, measure routes, run discriminating controls. **A lane's "green" is not authoritative.** Both
write lanes will request **central changes** — e2e lane registration, a nav entry, cap registration —
and neither may edit `scripts/e2e/lanes.ts` itself.

⚠ **Heavy measurement stays serialized even with three lanes running.** Builds, `size`, `size:routes`,
bundle analysis and full/sharded e2e run one at a time, from the campaign worktree, never inside a
lane. R15's two differently-failing full-suite runs are the reason.

### THE NEXT THREE ACTIONS (set at the FIFTH zero-trust resume, 2026-08-19)

⚠ **These supersede the fourth-resume block below, all three of whose actions are now DISCHARGED.**
That block is kept as the record of what was owed and how each closed.

**1. REVIEW INV-1 (Testimonials), then INV-2 (Categories & Tags) — do not act on either first.**
Both returned complete, both are **UNREVIEWED**, and OD-13's standard applies: re-derive every
load-bearing claim from `openapi/openapi.json`, do not accept the report. Artifacts and thread ids are
in §8; reply into a lane with `--session <threadId>` rather than re-dispatching, which would waste it.
Start with the two verified escalations already recorded — **INV-2's Escalation 1 is a confirmed API
contract defect** (the taxonomy list endpoints declare a single entity while their summaries say
"List"), and it **gates** Escalation 2, because the inline-editing recommendation rests on the list
carrying every editor field. **Check first whether INV-1's translation-PATCH question is already
answered by §10.3 rule 6** before treating it as open.

**2. Dispatch the `M2·U2` WRITE lane (Skills collection + the twelfth e2e lane) under OD-16** — in an
**isolated worktree/branch**, module-local files only. The `useAdminSkills` absorption is **already
approved** (OD-15) and is NOT an owner question: both shipped picker consumers must stay green
**without being edited**, and a consumer needing modification is EVIDENCE the absorption broke the
preserved surface, to be resolved centrally. Lane registration, nav entry and cap registration are
**central changes Claude applies** — the lane reports the need, never edits `scripts/e2e/lanes.ts`.

**3. Do NOT stop at the collection cap — continue into `M2·U3` and batch (OD-15 amendment).** Record
`/dashboard/skills`'s measured baseline and a *proposed* D20-29-derived cap, leave the route
intentionally ungoverned, build and measure the editor routes, then return **ONCE** with all three
measured baselines and all three proposed caps. `size:routes` may stay **intentionally non-green**
across that window solely because the new routes are registered but not yet governed. **No temporary
cap may be invented to make it green.** ⚠ Serialize every heavy measurement (OD-16): parallel gate runs
manufacture failures, which is what R15 recorded.

⚠ **A prediction this session measured, so `M2·U3` does not misread it as a regression:** building the
Skills EDITOR will RAISE the Skills COLLECTION's measured bytes, because both share one composable
inside the collection's static closure. Experiences did exactly this — `useAdminExperiences.ts` +1,345 B
charged to the collection route when the editor landed (§9.5). Expected, not a defect.

---

### THE NEXT THREE ACTIONS (set at the fourth zero-trust resume, 2026-08-19 — **ALL THREE DISCHARGED**)

**1. Re-derive R14's lane-count trigger BEFORE module 2 starts — do not inherit it.** R14 states its
trip condition two ways that do not agree: *"the lane count passing 12"* and *"the **third** FE-3
module reaches 12"*. But R14 also records that `M1·U2` landed the **eleventh** lane and `M1·U3` added
**none** — so if module 2 lands one lane, the count reaches **12 at the SECOND FE-3 module**, one
module earlier than the prose predicts. Count the lanes live (`--list`/`lanes.ts`), decide whether
`test:e2e:sharded` becomes the default gate, and record the answer. R14's own standard applies: a
silent non-event is indistinguishable from a forgotten one.

**2. Discharge the baseline-provenance attribution §9.5 owed to `M1·U5` and never received.** Nine
routes' `DASHBOARD_APP_OWNED_BASELINE_BYTES` no longer reproduce; the deltas run in **both**
directions, so no single cause explains them; the Experiences collection's `+1,853 B` is recorded as
*plausible, NOT measured to attribution*. Measure the attribution (the ~50 new i18n keys × 2 locales
hypothesis is the candidate, unproven). ⚠ **Do NOT re-stamp the constants to make the report
reproduce** — they are the DERIVATION INPUT for frozen caps, so re-stamping `85,551 → 87,404` would
silently re-derive that cap `99,328 → 101,376`, i.e. a budget change performed to fix a report label.
The report is what is wrong.

**3. FE-3 module 2, under OD-12 — and its first gate is an OWNER CALL, not a build step.** OD-12
authorizes Codex delegation for modules 2–5 *"only after Articles + Experiences have established the
pattern"*, and the `M1·U5` checkpoint records that the pattern now holds across two modules. So the
routing decision (in-house vs bounded delegated lane) is live and belongs to the owner. Once routed,
module 2 replays the M1 unit sequence: instrument → collection + lane → editor → extraction verdicts
→ gates + axe.

⚠ **Binding on module 2 however it is routed — a lane must NOT invent a competing shared
abstraction.** The shared set is now exactly: `useTranslatableForm`, `DashboardTranslationTabs`,
`DashboardEntityFormActions`, `DashboardEntityEditorSkeleton`, `DashboardSkillPicker`, and
`dashboard-translation-errors`. **Extend it or escalate — never fork it** (plan §6; OD-12 makes this
the lane contract, not advice). Also binding, from §10.1: **keep the `*-fields.ts` / `*-form.ts` split
per module** — it was found by measurement and recovered 6,211 B on the Articles collection route.

---

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

---

### Interrupted-session recovery checkpoint — 2026-08-19

Forensic recovery is recorded in
[`scratchpad/fe3-recovery/campaign-027-interrupted-session-recovery.md`](../../scratchpad/fe3-recovery/campaign-027-interrupted-session-recovery.md).
The campaign Web tree was clean before this documentation write at
`5fe84e49443e1a94f0c6a97a129d3c9b5f71790b`; it remains the exact resume tip after the docs-only commit
that records this checkpoint. `origin/dev` is `54cea28737c558767ccb24a34e2b437b62f7f058`,
`origin/main` is `648aa467cd8bc7157cbcad2fd7c0e8981ee1f16c`, and the campaign branch is absent from
origin.

The recovery found no post-`f6ec825` application commit. It found two dirty isolated write lanes:
Skills M2·U2 (collection implementation present but not integrated or verified) and Testimonials T·U1
(instrument only, not a module). Their exact file SHA-256 inventory is in the recovery report and must
be preserved. M2·U3, Skills route measurement, central lane registration, navigation, caps, and Web
contract reconciliation did not start.

API PR #89 is merged on API `dev` at `0225f76b57c5bb770f06281f1d96dce318c61112`; API `main` remains
`9af1aace27289404efa57e8111c5fc3786c65f75`. The taxonomy contract blocker is resolved on API `dev`
only. Web's vendored contract was intentionally not changed; reconcile it normally after resumption,
then rerun INV-2's architecture question. Safest resume: inspect and classify the preserved Skills lane
diff first, then the Testimonials instrument, before any integration or new implementation.

### M2·U2 integration checkpoint — 2026-08-19

Skills M2·U2 commit `85bd8e9e538c97bda3b9bee877a57b8cb0ad6975` was cherry-picked without conflict as
campaign commit `45485d80f0b0458b7d62e0b98d819c890ee22958`. On the integrated tree, typecheck,
typecheck:e2e, and lint passed; the Skills focused unit passed 4/4; lane/route registry tests passed
51/51; Skills E2E passed 9/9 and Experiences E2E passed 36/36. Each focused lane booted one
preview/backend pair. Skills is the 12th declared lane, and focused selection resolves one lane.

The existing Nuxt/Vitest `useAdminSkills` consumer test executed and passed 3/3. The `/dashboard/skills`
route cap remains undecided. `size:routes` exited with the authoritative governance/measurement
divergence because the route has no owner-approved cap; measurement unavailable through the
authoritative gate until the measurement workflow is resolved. No cap was added. The preserved
untracked M2·U3 prep files remain in `/home/eslam-muatamed/worktrees/lane-m2-u2-skills` untouched and
were not integrated. M2·U3 has not started.

### Testimonials T·U1 integration checkpoint — 2026-08-19

Testimonials instrument commit `026cacba6f5755d06604a06f7dde67cae68f2ec3` was cherry-picked
without conflict as campaign commit `1b70725`. Focused verification on the integrated tree passed:
Testimonials instrument 28/28, typecheck, typecheck:e2e, and lint. The five negative-control classes
(order bounds, minimum translations, locale format, non-empty translation text, and omission-preserving
translation upsert) were already proven in the isolated lane. T·U1 remains instrument-only;
Testimonials Dashboard collection/editor have not started. No shared frontend architecture changed.

### Skills M2·U3 integration + measurement checkpoint — 2026-08-22

Skills editor commit `3e8bf6911d1979afc3353971eee998d3c1891740` (isolated lane based on `797ab90`)
was cherry-picked without conflict as campaign commit `5c7db16` — not squashed, not amended. One
mechanical M2·U3-local defect surfaced on the integrated tree and reproduces identically in the lane
tree: `skills/public-isolation.spec.ts` had no `MODULE_FILES` entry for the newly added
`composables/useAdminSkill.ts`, so the scan flagged the admin editor composable as public surface.
Fixed by listing it alongside its sibling `useAdminSkills.ts` (`785d1b8`); scan scope unchanged,
nothing weakened. Resulting campaign HEAD: `785d1b83c4f249d3af175bc081b7c2ebda5d97c4`.

Gates on the integrated tree: typecheck 0, typecheck:e2e 0, lint 0; full Skills-focused unit
selection (admin-skill-form, admin-skill-fields, useAdminSkills, skills index, skills
public-isolation) 25/25. Production build exit 0 recorded directly in the log (no wrapper masking),
`.output` verified before any downstream use; a second `ANALYZE_BUNDLE=1` rebuild for measurement is
bit-for-bit output-neutral per config/bundle-analysis.ts (sidecar only), same tree hash. Official
`dashboard-skills` E2E lane against the production preview: **17/17, exit 0**, exactly one
preview/backend pair (skills backend 4201 + Nitro from `.output` 4200), including all six
discriminating editor cases (Arabic-first save, English-first save, zero-translations blocked, PATCH
excludes slug, `brandColor: null` clear, 422→Arabic tab).

Route measurements on HEAD `785d1b8` via the established closure/attribution workflow
(`resolveDashboardClosure` + Rollup `renderedLength` attribution, the exact code path
`size:routes` uses for governed routes). Instrument control before reading: `/dashboard/experiences`
read 87,963 B vs its T·U1-era reading of 87,404 B (+559 B, consistent with the documented i18n-key
drift pattern of prior units — provenance drift, not instrument error); D20-29 formula positively
controlled against D20-34 (`85,551 → 99,328`) and the D20-33 amendment (`106,095 → 122,880`).

| Route | Raw app-owned measured | D20-29 proposed cap | Headroom |
| --- | --- | --- | --- |
| `/dashboard/skills` | **83,997 B** | **97,280 B** | 13,283 B |
| `/dashboard/skills/new` | **96,571 B** | **111,616 B** | 15,045 B |
| `/dashboard/skills/{id}` | **96,679 B** | **111,616 B** | 14,937 B |

⚠ **These three caps are PROPOSED ONLY — NOT YET APPROVED, NOT registered** in doc 20 nor mirrored
in `DASHBOARD_APP_OWNED_CAP_BYTES`. The owner approves all three together. For scale they sit below
the Experiences editors' measured baselines (105,051/105,159 B) and well below the Articles editor
cap (122,880 B). `size:routes` therefore remains intentionally non-green solely because the Skills
routes await owner governance.

R13 factual state: public CSS 29.19 kB gz / 30 kB cap — Δ0 vs the previous 29.19 KB checkpoint.
R14 factual state: 12 declared lanes; Skills focused selection = 17 tests, one lane resolved; one
preview/backend pair booted. No R14 redesign in this task. M2 remains open only for cap
governance/final closure.

### FE-3 Module 2 (Skills) closure checkpoint — 2026-08-22

**D20-36 REGISTERED AND VERIFIED — Module 2 is COMPLETE.** The owner approved all three Skills caps
as one batched decision; each is D20-29's formula on its OWN measured baseline, no sibling number
inherited or rounded toward:

| Route | Baseline | Cap |
| --- | --- | --- |
| `/dashboard/skills` | 83,997 B | **97,280 B** (95 KiB) |
| `/dashboard/skills/new` | 96,571 B | **111,616 B** (109 KiB) |
| `/dashboard/skills/{id}` | 96,679 B | **111,616 B** (109 KiB) |

Registration: `scripts/lib/route-assets.mjs` (`DASHBOARD_APP_OWNED_CAP_BYTES` + baseline/provenance
records, provenance tree `785d1b83c4f249d3af175bc081b7c2ebda5d97c4`) and the two editor routes in
`DASHBOARD_ROUTES` — the same mechanism Articles and Experiences use; no new budget system. Web
governance commit `b871e66`; Doc 20 decision recorded on the private Docs campaign branch as
**D20-36** (Docs `9bbc525`, local-only). Route-budget focused specs updated and green:
`route-assets` + `dashboard-closure` + `check-route-size` = **184/184**, including the discriminating
assertions that pin the owner's exact bytes and reject consistency-rounding.

Authoritative verification on a fresh provenance-valid build at `b871e66` (real build exit **0**
recorded directly): **`size:routes` exit 0** across all seventeen governed routes. Skills rows:
collection Δ-floor 6,972 B / app 83,997 ≤ 97,280 ✓ · new Δ 72,287 / 96,571 ≤ 111,616 ✓ (D20-24
quality-target warning, same band as every content-module editor) · {id} Δ 72,331 / 96,679 ≤
111,616 ✓ (same warning).

**Final evidence for the module:** collection complete (M2·U2 request-state contract + third
public-isolation gate); editor complete (M2·U3, bilingual Zod + UForm); OD-14 semantics covered —
zero translations → INVALID/blocked, one → VALID-but-INCOMPLETE, all configured → COMPLETE, with the
zero-translation client invariant's discriminating control proven in the isolated lane (the test
fails when the block is removed); Arabic-first and English-first saves covered; PATCH excludes slug;
`brandColor: null` explicit clear; translation 422 → Arabic locale tab activated. Official
`dashboard-skills` E2E lane **17/17, exit 0** on exactly one preview/backend pair. Public CSS
remains **29.19 / 30 KB** gz; lane count remains **12**. Nothing was pushed or deployed.

FE-3 state after this closure: modules 1–2 COMPLETE; modules 3–5 (Projects extraction verdicts,
Testimonials, Taxonomy per OD-12/OD-15 sequencing) remain OPEN. No next module was started here.

### FE-3 Module 3 · Testimonials T·U2 checkpoint — 2026-08-22

**The Testimonials Dashboard collection is COMPLETE on the campaign branch.** Starting HEAD
`5babc37df924f734d261f5cf00d969ac6436ec46` (verified live, clean tree). One logical implementation
commit: **`474b250`** — "FE-3 module 3 · T·U2 — the Testimonials collection, and the order that must
not be re-sorted" (19 files, +1,349/−7). Scope held to collection-only: no editor, no Taxonomy, no
new module, no route caps assigned, no backend/API changes, no shared-architecture forks.

Implemented per the established collection pattern (Skills closest; Experiences' stale-refresh
notice): `admin-testimonial-types.ts` (read alias over `AdminTestimonialEntity`; write payloads
deferred to the editor unit), `admin-testimonial-fields.ts` (+spec) with the fields/form boundary
made BEFORE an editor exists, `useAdminTestimonials.ts` (+spec — unpaginated `{ data }`, zero query
parameters, `locale: false`, superseded-response token), and `/dashboard/testimonials`
(+index.spec, +public-isolation gate as module 3's third scan). Rows render the SERVER order verbatim
— `order` is displayed as data and never becomes a client-side sorting policy — plus `isVisible`,
nullable `avatarId` presented as linked-id-or-none data, locale-map completeness badges, EN/AR nav
entry (`i-lucide-message-square-quote`) in the Content group. Create/edit links point at the future
editor routes exactly as M1·U2/M2·U2 did; those routes are NOT built here.

Lane architecture unchanged in shape: one new registry record (`dashboard-testimonials`, backend
`testimonials`, ports 4300/4301, `resetsBackendState: true`). **Declared lane count 12 → 13**;
shard plan/isolation guards derive automatically. The focused selection boots exactly ONE
preview/backend pair.

Authoritative verification, all exit 0 unless stated: typecheck 0 · typecheck:e2e 0 · lint 0.
Focused unit/registry selection **276/276** (testimonial-fields 12, useAdminTestimonials 4,
collection index 9, public-isolation 2, dashboard-nav updated, lane-isolation, testimonials
instrument calibration 24, dashboard-closure, route-assets incl. the two governance-inventory tests
updated for the deliberately ungoverned registration — measured set now 18 routes).
Official `dashboard-testimonials` E2E lane **15/15, exit 0**, twice (initial + post-control rerun),
on exactly one pair (testimonials backend 4301 + Nitro `.output` 4300): full-sequence server-order
pin; out-of-sequence fixture order pin; visibility/order/avatar presentation; en-only completeness;
delayMs loading skeleton; empty; error+retry-recovers; forbidden; no-public-endpoint-request leak;
EN/AR 380px RTL/LTR cold-boot with no key paths; unfiltered axe EN+AR over settled AND held-loading
states — all clean.

Order negative control (the module's most important invariant): injected
`[...items].sort((a, b) => a.order - b.order)` into the page's `v-for`; rebuilt; the discriminating
E2E test ("keeps the SERVER order when order values run out of sequence", fixture C→A→B at
order 40/10/30 so a monotonic seed cannot pass by coincidence) FAILED with
`expect(received).toEqual(expected)` as required. Restored byte-identically — SHA-256 of
`app/pages/dashboard/testimonials/index.vue` = `f8dbc9610f2f4c4a32cffc01c81a65b51ae84932080b05d20d6a9331ce26e929`
before mutation, after restore, and as committed. Full lane then re-ran green.

Route measurement (established closure/attribution workflow, ANALYZE_BUNDLE=1 build exit 0,
preview-gated shell fetch): `/dashboard/testimonials` closure = 53 JS assets, route total
269,489 B gz (798,939 B raw), **app-owned rendered 86,069 B** (the D20-29 baseline input),
unclassified 0 B, CSS 28,724 B gz from the route's own shell. Public CSS via `/about`: 28,724 B gz
≈ 28.05 KB against the 30 KB cap (this tree's factual reading; differs from R14's noted 29.19 kB —
different tree/build, same gate method). `size:routes` is INTENTIONALLY non-green (exit 2, fast,
pre-preview): "measured but NOT governed: /dashboard/testimonials" — exactly the deliberate
M2·U2-style state; **no cap was assigned and none inherited**. The owner derives the Testimonials
cap from the 86,069 B baseline under D20-29. Provenance caveat recorded honestly: the verification
build ran on the implementation tree (dirty), so `stamp-build` correctly skipped the governed
provenance marker; Lighthouse gates were not run and nothing downstream consumed a stamp.

Nothing was pushed or deployed; campaign tree clean after the docs-only ledger commit below.
FE-3 state: modules 1–2 COMPLETE; module 3 collection done, Testimonials EDITOR (T·U3+) remains
open, as do modules 4–5. No next unit was started here.

### FE-3 Module 3 · Testimonials T·U2 CLOSURE checkpoint — 2026-08-22

**D20-37 REGISTERED AND VERIFIED — T·U2 is COMPLETE.** The owner approved the Testimonials
collection cap as a route-specific decision derived from its own measured baseline by D20-29's
formula. Starting HEAD for this closure step: `6f7ce79c1c4da645af67a5edc7cc2d8b1fdadce1` (verified
live, clean tree).

| Route | Baseline | Cap |
| --- | --- | --- |
| `/dashboard/testimonials` | **86,069 B** | **99,328 B** (97 KiB) |

Registration: Web governance commit **`27a12ce`** (`scripts/lib/route-assets.mjs`
`DASHBOARD_APP_OWNED_CAP_BYTES` + baseline/provenance records; provenance tree `474b2501dbee…`, the
T·U2 implementation commit). The numeric equality with the Experiences collection's 99,328 B is
recorded as COINCIDENCE of close baselines under one frozen formula — explicitly NOT inherited,
NOT rounded toward, and pinned by discriminating spec assertions on both baselines' independence.
Explicitly not a waiver, not a shared-floor change, not a generic incremental-allowance change, not
a D20-32 recalibration. Doc 20 decision recorded on the private Docs campaign branch
(`docs/web-modernization-campaign`) as **D20-37** (Docs `4b55145`, local-only).

Verification before registration: route-budget focused specs (route-assets + dashboard-closure +
check-route-size) **186/186**, including the new pins that fix the owner's exact bytes (86,069 →
99,328), reject inheritance-by-coincidence, and restore the two-way governance coverage assertion
(18 governed routes, measured == governed). Then a fresh clean-tree provenance build at `27a12ce`
(real build exit **0**; stamp written `.output/.provenance.json` → `27a12ce`): the §1.2 closure
workflow REPRODUCED the T·U2 checkpoint reading byte-for-byte (app-owned 86,069 B, route total
269,489 B gz, CSS 28,724 B gz, unclassified 0 B) before `size:routes` was trusted. Authoritative
**`size:routes` exit 0**: `/dashboard/testimonials` Δ-floor 6,879 / 86,016 ✓ · app 86,069 ≤ 99,328 ✓
· total JS 263.2 KB gz below the 300 KB quality target (no D20-24 warning) · CSS 28.1 KB / 30 KB ✓.
Eighteen governed routes, all inside their caps.

Established T·U2 evidence (from the implementation checkpoint at `474b250`, unchanged since):
unpaginated whole-list read with zero query parameters (`{ data }`, no meta, unsolicited query →
422 upstream); no URL query/filter/search state; SERVER order preserved verbatim with `order`
displayed as data only — negative-controlled by injecting a client-side `order` sort and proving the
out-of-sequence E2E test fails, restored byte-identically (SHA-256 `f8dbc961…e929`); bilingual EN/AR
chrome with cold-boot RTL/LTR and no raw key paths; locale-map completeness indicators with no
cross-locale substitution in the badges; full request-state semantics (skeleton/empty/error+retry/
forbidden/stale-refresh); 380px green both locales; unfiltered axe clean in EN and AR over settled
AND held-loading states. Official `dashboard-testimonials` E2E lane **15/15, exit 0** (run twice)
on exactly ONE preview/backend pair (Nitro :4300 + testimonials backend :4301). Declared lane count
**13**.

Not done here, deliberately: the Testimonials EDITOR (T·U3+) was not started; Taxonomy untouched;
no other module started; R14 strategy unchanged; nothing pushed or deployed. Campaign tree clean
after this docs-only ledger commit; Docs campaign worktree clean.

### FE-3 Module 3 · Testimonials T·U3 checkpoint — 2026-08-22

**The Testimonials EDITOR is COMPLETE on the campaign branch.** Starting HEAD
`449cd84d2b3a0f40f697b1484bddfe670136ea3e` (verified live, clean tree). One logical implementation
commit: **`7f22ce7`** — 15 files, +1,400/−6. Scope held to the editor only: `/dashboard/testimonials/new`
and `/dashboard/testimonials/[id]` on the established editor architecture (shared
translation-error machinery, `DashboardTranslationTabs`, `DashboardEntityFormActions`,
`DashboardEntityEditorSkeleton`, unsaved-changes guard, request-state surfaces; Zod + UForm). No new
editor abstraction was invented; no Taxonomy work; no other module started.

Contract-faithful specifics: OD-14 adapted to THREE required text fields per locale — any authored
text makes the locale required-complete before save, zero complete locales blocks client-side with
NOTHING on the wire, Arabic-first and English-first equally valid, one locale valid-but-incomplete.
Order is integer ≥ 0 (control floor + schema refinement). The avatar REUSES the shared MediaPicker
verbatim (its doc comment names testimonial avatars as an intended consumer); PATCH discriminates
omission from clear exactly as the contract demands — untouched avatarId OMITTED (server preserves),
explicit `null` only on operator clear, replacement id on re-pick — and translations write as an
UPSERT of complete locales, so clearing a locale in the form drops it from the array instead of ever
wiping stored content server-side. 422 field paths resolve through the SENT locale array onto tabs;
DELETE confirms and returns to the collection.

Instrument note: the lane's backend gained a minimal ADDITIVE media read surface (list / resolve /
upload of three seeded assets) so the shared picker functions mechanically inside the lane — no
`/admin/testimonials*` semantics changed, T·U1 calibration untouched and green.

Negative controls (both narrow and reversible, restored byte-identically, SHA-256
`90d3892d0762e5c5a3d299c777356cdecc783ad66ebafef53ceb1804cd49ea43` verified):
1. Minimum-translation guard removed → the first control run PASSED, which exposed a weak instrument:
   the API's own 422 backstop was satisfying the assertion. The test was hardened to demand ZERO
   create requests leave the browser ("a suite that fails to execute is not a valid control" applied
   in reverse — a test that cannot fail for the right reason is not discriminating). Under mutation
   it then FAILED with "an unguarded save reached the API"; after restore it passes.
2. Avatar always-send mutation (`body.avatarId = form.avatarId` unconditionally) → the
   "OMITS avatarId when untouched" test FAILED on `not.toHaveProperty`; passes after restore.

Verification, all exit 0 unless stated: typecheck 0 · typecheck:e2e 0 · lint 0 · focused unit/
registry selection **292/292** (form model incl. modeled translation-DTO schema rejecting `EN`/
empty/over-length, payload omission/upsert discrimination, composable detail-read 400→not-found,
collection specs unchanged-green, nav, lane isolation, closure inventory now 20 routes,
route-assets two-sided governance expectation naming exactly the two ungoverned editor routes).
Official `dashboard-testimonials` E2E lane **33/33, exit 0** (final run on the restored tree),
still ONE spec file and ONE preview/backend pair (Nitro :4300 + testimonials backend :4301) — the
lane was extended, not duplicated. Editor a11y EN+AR clean (unfiltered axe on the settled editor);
380px cold-boot RTL/LTR correct with panel-level direction independence and no overflow.

Route measurements (§1.2 closure workflow, ANALYZE_BUNDLE build exit 0, unclassified 0 everywhere):

| Route | Raw app-owned measured | D20-29 proposed cap | Headroom |
| --- | --- | --- | --- |
| `/dashboard/testimonials/new` | **125,465 B** | **144,384 B** (141 KiB) | 18,919 B |
| `/dashboard/testimonials/{id}` | **125,573 B** | **145,408 B** (142 KiB) | 19,835 B |

⚠ Both caps are PROPOSED ONLY — NOT registered anywhere. The owner approves them together as one
batched decision, per the standing rule neither cap inherits the collection's 99,328 B nor any
sibling number. The collection itself measured 87,774 B on this tree (+1,705 vs its baseline from
shared i18n-key drift), still ≤ its governed cap. `size:routes` is therefore intentionally non-green
(exit 2): "measured but NOT governed: /dashboard/testimonials/new, /dashboard/testimonials/{id}" —
the exact deliberate state D20-34/D20-36 resolved for earlier modules. Public CSS unchanged at
**28,724 B gz (Δ0)** vs the previous checkpoint, under the 30 KB cap — no byte-chasing warranted.

Nothing was pushed or deployed; campaign tree clean after this docs-only commit. FE-3 state:
modules 1–2 COMPLETE; module 3 collection+editor done pending owner cap approval; modules 4–5 open.
No next unit was started here.

### FE-3 Module 3 (Testimonials) closure checkpoint — 2026-08-22

**D20-38 REGISTERED AND VERIFIED — Module 3 is COMPLETE.** The owner approved both Testimonials
editor caps as one batched decision; each is D20-29's formula on its OWN measured baseline, no
common cap, nothing inherited or rounded toward a sibling:

| Route | Baseline | Cap |
| --- | --- | --- |
| `/dashboard/testimonials/new` | 125,465 B | **144,384 B** (141 KiB) |
| `/dashboard/testimonials/{id}` | 125,573 B | **145,408 B** (142 KiB) |

Registration: Web governance commit **`2309ae2`** (`scripts/lib/route-assets.mjs`
`DASHBOARD_APP_OWNED_CAP_BYTES` + baseline/provenance records, provenance tree `7f22ce775e4c…`, the
T·U3 implementation commit). Explicitly NOT a waiver, NOT a shared-floor change, NOT a generic
incremental-allowance change, NOT a D20-32 recalibration. Doc 20 decision recorded on the private
Docs campaign branch as **D20-38** (Docs `1bffebe`, local-only).

Step-1 measurement verification BEFORE registration: the recorded T·U3 checkpoint readings
(125,465 / 125,573 B) were REPRODUCED byte-for-byte — same app-owned figures, same route totals
(326,821 / 326,866 B gz), zero unclassified bytes — on a fresh clean-tree provenance build at
`2309ae2` (real build exit **0**, `.output/.provenance.json` stamped `2309ae25…`, `.output`
verified present). Route-budget focused specs green: route-assets + dashboard-closure +
check-route-size = **187/187**, including pins that fix the owner's exact bytes, assert the two caps
DIFFER from each other and from every sibling editor cap, and restore two-way governance coverage
(twenty governed routes, measured == governed).

Authoritative verification on the stamped build: **`size:routes` exit 0** across all twenty governed
routes. Testimonials rows: collection 87,774 ≤ 99,328 ✓ · new Δ-floor 64,080 / app 125,465 ≤ 144,384 ✓ ·
{id} Δ-floor 64,125 / app 125,573 ≤ 145,408 ✓. Both editor routes sit in the same D20-24
quality-target warning band as every other content-module editor (passing, attribution obliged);
CSS 28.1 KB gz per route.

Final Module 3 evidence (T·U1 → T·U3): deterministic resettable instrument with calibrated contract
distinctions; unpaginated `{ data }` collection with zero query/filter state rendering SERVER order
verbatim (`order` displayed as data only; discriminating control: injected client-side sort fails an
out-of-sequence-fixture test, restored byte-identically); bilingual EN/AR authoring with Arabic-first
and English-first create both valid; zero-translation frontend invariant enforced wire-level — no
request leaves the browser (control: guard removal failed that test after the original assertion was
proven non-discriminating against the API's 422 backstop); integer ≥ 0 order blocked at control and
schema; translation omission preserves (in-form cleared locale restored from server); upsert changes
only supplied locales; avatar via the SHARED MediaPicker with PATCH omission = preserve, explicit
null = clear, replacement = new id (omission control: always-send mutation failed); 422 field paths
resolve through the SENT array onto the correct locale tab; DELETE confirm → 204 → collection.
Official `dashboard-testimonials` E2E lane **33/33, exit 0** on exactly ONE preview/backend pair,
still ONE spec file; declared lane count **13**. EN/AR axe clean (collection + editor); 380px green.
Public CSS **28,724 B gz / 30 KB (Δ0)**.

The lane instrument's additive media read surface (three seeded assets for list/resolve/upload)
is TEST SUPPORT ONLY so the shared picker runs mechanically in the lane — it is not a production
API change, and the product reuses the existing MediaPicker against the real media endpoints.

Nothing was pushed or deployed. Campaign tree clean after this docs-only commit; Docs campaign
worktree clean. FE-3 state: modules 1–3 COMPLETE; modules 4–5 open. No next module was started here.

### Taxonomy contract prerequisite — RECONCILED, INV-2 reviewed · checkpoint 2026-08-23

Narrow unit authorized by the owner: verify the Backend dev contract delta, reconcile Web's vendored
contract through the established workflow, and review INV-2 against the corrected contract. **No
Taxonomy UI, no e2e instrument, no Dashboard routes, no caps, no architecture change, nothing pushed.**

#### ⚠ Live-state drift at session start — refs moved FORWARD, both expected SHAs still resolve

The task brief named API `dev` = `0225f76b…` / `main` = `9af1aace…`. Live after fetch:
`origin/dev` = `b791c9c6…`, `origin/main` = `d3eb74cc…`. Measured, not assumed: **`0225f76b` IS an
ancestor of `origin/dev`, and `9af1aace` IS an ancestor of `origin/main`** (`merge-base --is-ancestor`,
both true). What moved: **PR #91 merged `dev` → `main`**, so the taxonomy list-schema fix is now on API
**main as well as dev** — plus PR #90 (media upload compensation) which touched only
`src/modules/media/*`; dev additionally carries PR #97 deploy-summary fixes touching only workflow/
deploy scripts. **Neither post-fix commit touches any contract surface**: `git rev-parse <ref>:openapi.json`
= `185f067e…` at ALL THREE of `0225f76b`, `d3eb74cc`, `b791c9c6` (old main `9af1aace` = `7a9e0ba6…`).
Production serving tree was NOT re-measured in this unit — stated precisely rather than assumed.

**Consequence for the authorization to consume a dev-only contract:** moot in the safest direction.
The exact SHA the owner authorized (`0225f76b`) carries the same contract blob that is now API
`main`'s tip blob, so Web's reconciliation restores byte-identity with BOTH branches simultaneously.

#### Step 1 — the exact OpenAPI delta (measured before adopting anything)

Structural walk of old-main blob `7a9e0ba6` → fix blob `185f067e`: path count **52 → 52**, zero paths
added or removed, **exactly six scalar differences, all inside two endpoints**:

| Endpoint | Before | After |
| --- | --- | --- |
| `GET /api/v1/admin/categories` | `data.$ref → AdminCategoryEntity` | `data.{type:"array", items.$ref → AdminCategoryEntity}` |
| `GET /api/v1/admin/tags` | `data.$ref → AdminTagEntity` | `data.{type:"array", items.$ref → AdminTagEntity}` |

**No other change exists in the document.** Public categories/tags, skills, testimonials re-read from
the same blob: all already array-shaped, unchanged.

⚠ **OD-17's users/roles claim re-verified FROM THE ARTIFACT, and it is still TRUE there:** in the same
corrected blob, `/api/v1/admin/users` declares `data.$ref → UserEntity` and `/admin/roles`
`data.$ref → RoleEntity` — single-entity shapes for list endpoints. **PR #89 fixed only categories and
tags; the defect class remains armed for FE-4's RBAC module.** Not part of this delta, not fixed here,
not a Taxonomy blocker — recorded so it is rediscovered by reading, not by a failed module.

#### Step 2 — Web contract reconciled · commit `2263bc7`

One atomic logical commit per doc 16 §3 / FE-1 precedent (`19e3a05`): `openapi/openapi.json` +
regenerated `app/types/api.d.ts`, nothing else (+10/−4 across exactly those two files).

| Check | Result |
| --- | --- |
| Vendored contract byte-identity with authorized SHA | `sha256(openapi/openapi.json)` = `sha256(git show 0225f76b:openapi.json)` = `799d2ed9…` |
| Generation | `npm run api:types` (openapi-typescript 7.13.0), run twice — **gen2 byte-identical to gen1** |
| CI fixed-point gate replicated on the COMMITTED tree | `npm run api:types && git diff --exit-code` → **PASS, zero diff** at `2263bc7` (ci.yml:92-100 mechanism) |
| Generated-type shape | `data: components["schemas"]["AdminCategoryEntity"][]` / `["AdminTagEntity"][]` — generated, not hand-edited |
| `npm run typecheck` | **exit 0**, 0 `error TS` |
| Contract gates (`contract-fixtures.spec.ts` + `prism-locale-selection.spec.mjs`) | **37/37, exit 0** |

Recorded explicitly per the owner instruction: Web is intentionally consuming the reviewed API dev
contract `0225f76b…`; that contract's blob is identical at current API `main` `d3eb74cc…` and `dev`
`b791c9c6…`; API Production metadata were not re-measured and no promotion occurred; runtime
compatibility is unaffected because the list handlers always returned arrays — only the emitted schema
was wrong. **Deliberately NOT touched:** the handwritten array generics at `useAdminArticles.ts:216-217`
(`Envelope<readonly AdminCategory[]>` / `<readonly AdminTag[]>`). They are Articles-owned, they now
merely AGREE with the corrected contract instead of masking it, and removing them would broaden this
unit. Left for the Taxonomy implementation lane (or the eventual Articles refit) to retire.

#### Step 3 — INV-2 reviewed against the corrected contract · both escalations CLOSED

Re-derived independently from `openapi/openapi.json` @ `2263bc7` plus API source read-only at
`0225f76b` (`taxonomy/categories.service.ts`, `tags.service.ts`). The preserved artifact holds the two
escalations; every load-bearing claim below was re-verified, not believed. Per-entity facts:

| # | Claim point | Categories | Tags |
| --- | --- | --- | --- |
| 1 | List response shape | `{ data: AdminCategoryEntity[] }`, no `meta` ✅ corrected | `{ data: AdminTagEntity[] }`, no `meta` ✅ corrected |
| 2 | List query parameters | **zero** — unpaginated full list, `orderBy createdAt asc` (source) | **zero**, same ordering |
| 3 | Translation read shape | locale-keyed map → `CategoryTranslationEntity {name, slug, description?}` | map → `TagTranslationEntity {name, slug}` |
| 4 | Translation write shape | ARRAY of `CategoryTranslationDto {locale*, name*, slug*, description nullable}` | ARRAY of `TagTranslationDto {locale*, name*, slug*}` |
| 5 | Create DTO | `CreateCategoryDto`: required `['translations']`, sole property | `CreateTagDto`: required `['translations']`, sole property |
| 6 | Update DTO | `UpdateCategoryDto`: required **none**; sole property `translations` | `UpdateTagDto`: required **none**; sole property `translations` |
| 7 | Delete semantics | hard delete, `204`; **409 documented when referenced by articles** (RESTRICT, source-comment D09-3); also 400/401/403/404/429 | hard delete, `204`; **no 409 documented** — model none (M2 ruling #5 stands: document-only behavior) |
| 8 | Nullable fields | `description` only (entity + DTO, both locales' worth) | **none** |
| 9 | Omission semantics | PATCH **upserts supplied locales, never deletes** (source: `upsert` loop in `$transaction`; omitted locale preserved; empty array = accepted no-op). Emptying a server-held locale BLOCKED client-side — §10.3 rule 6 verbatim. `description: null` CLEARS, omitted PRESERVES (D10-23 inverse pair, straight Prisma passthrough) | same upsert/never-delete; no nullable field exists, so no clear-case |
| 10 | Immutable fields | none beyond server-generated `id` — slug IS mutable via PATCH (422 "slug already in use") | same |
| 11 | Relation semantics | none on the entity (no parent/order/status fields exist at all) | none |
| 12 | Documented errors | POST/PATCH 422 validation-or-slug-conflict; PATCH/DELETE 400 bad UUID, 404 not-found; DELETE 409 article-referenced | POST/PATCH 422; PATCH/DELETE 400/404; DELETE no 409 |
| 13 | Detail GET | **NO** — `/admin/categories/{id}` carries only `patch`/`delete` (re-verified in corrected contract) | **NO** — same |
| 14 | List entity ⊇ editor needs | **YES, mechanically**: UpdateDto accepts ONLY `translations`, and the list entity IS `{id, translations-map}` — every writable field, complete per locale | **YES** — same structure |

**Escalation 1 — CLOSED by reconciliation.** Lists are arrays matching their summaries and siblings;
nothing left to rule.

**Escalation 2 — premise re-verified, answer is mechanical.** No detail GET exists on either entity,
so an `[id]` route has no honest single-entity read (reload/deep-link unservable without inventing
client-side absence semantics). Because claim 14 is YES for both entities, **the Dashboard CAN edit an
existing Category/Tag using the list entity as the complete edit source.** INV-2's option 1 (inline
create/edit on each collection page; no detail routes) is therefore mechanically supported, and its
load-bearing premise is no longer doubtful — it is verified against the corrected contract.

#### Taxonomy surface shape — what the approved plan already governs

- **One Dashboard destination:** plan §7.1 groups "Taxonomy (Categories + Tags)" as ONE nav entry in
  Content, deliberately not two entries (`plan.md:633-640`). That grouping stands; this unit does not
  revisit it.
- **Internally two collections:** Categories and Tags are separate endpoints, entities and DTOs; the
  destination hosts two collection surfaces however the lane composes them.
- **Smallest mechanically supported create/edit interaction:** overlay editing on the collection
  surface (no `[id]` routes, no second fetch), grounded in evidence — no detail GET (claim 13), list
  completeness (claim 14), and established repo overlays: `USlideover` already in `messages.vue` /
  `media.vue`, `UModal` in `MediaPicker.vue`. The exact component choice belongs to the module lane;
  what is ruled out mechanically is any route-based editor requiring data the API cannot fetch. No new
  generic architecture; shared set extended-or-escalated per OD-12.

#### Module-numbering discrepancy — recorded, deliberately unresolved

Plan inventory = five entities (experiences, skills, testimonials, categories, tags) + the shared
per-entity SEO panel (`plan.md:556-558`). Campaign execution grouped Categories + Tags as one
Taxonomy investigation/surface and labelled it "FE-3 module 4" (`ledger.md`, OD-16 dispatch table).
The interrupted-session recovery separately labels Categories = 4 and Tags = 5 (recovery doc §5).
**Not settled here** whether Tags counts as a distinct module or half of one surface, and the stray
"Projects extraction verdicts" phrase in the M2-closure checkpoint remains unsupported by any decision
record. Bookkeeping settles AFTER the implementation shape is known.

#### Blocker status and smallest next implementation unit

**The original Taxonomy blocker — the broken admin list envelope — is CLOSED** by `2263bc7` against
the owner-authorized contract. No new blocker was found. What remains before a write lane is ordinary
sequencing, not blockage: the module's first unit is its **e2e instrument** (categories/tags mock
backend + calibration + negative controls, mirroring `T·U1`), then the collection surface(s) + central
lane registration, per the established pattern. **None of it was started here.**

Gates note: this unit ran only the established contract gates (fixed point, typecheck, contract specs).
No build, no route-size gate, no browser test — no runtime Dashboard surface changed, so no budget can
move; CI re-runs the full matrix at the integration boundary. Nothing pushed or deployed. Campaign
tree clean after this docs-only commit.

### FE-3 Taxonomy · **U1** — the Categories + Tags instrument, and the proof it can fail · checkpoint 2026-08-23

Commit **`6cd4907`**: `scripts/e2e/taxonomy-server.ts` + `taxonomy-server.spec.ts`, exactly two new
files, nothing else touched. Lane registration, nav, pages, caps all deliberately ABSENT — same shape
as Skills `M2·U1` and Testimonials `T·U1`; the browser-spec unit registers the lane later. The
instrument's standalone default port is **4401** (allocated pairs end at 4300/4301); the authoritative
pair belongs to the lane record when it lands.

**One backend models BOTH entities**, because the approved product surface groups them under one
Taxonomy destination (plan §7.1) — while the stores keep separate slug namespaces, mirroring the two
tables' independent `@@unique([locale, slug])` constraints (verified in the Prisma schema at API
`0225f76b`; category slugs do NOT collide with tag slugs).

Semantics modeled, each from the corrected contract and the API source read, none invented:

| Area | Categories | Tags |
| --- | --- | --- |
| List | `{ data: AdminCategoryEntity[] }`, zero query params (unsolicited → 422), createdAt asc | identical |
| Detail GET | **none exists**; GET under `{id}` falls through to the generic unsupported-route 404 | identical |
| Edit source | list row `{ id, translations }` is COMPLETE — UpdateDto accepts only `translations` | identical |
| Create | requires ≥1 translation | identical |
| PATCH | all-optional; UPSERTS supplied locales; omission preserves; `[]` accepted NO-OP; no replace-all, no delete-locale | identical |
| Nullable | `description` sole nullable: explicit null CLEARS, omission PRESERVES (D10-23 pair) | none — `description` is a FOREIGN property on tags and is rejected with the indexed path |
| Slug | mutable via PATCH; conflict → 422 `translations[N].slug`; own-slug resave clean | identical |
| Delete | 204 / 400 malformed / 404 absent; **documented 409 when article-referenced**, modeled as a control-plane referential set (`articleReferencedCategoryIds`) — NO article endpoints invented | 204/400/404 and **NO relation case modeled or inventable** |

Calibration: **54 tests, exit 0** (`typecheck` 0/0 errors · `typecheck:e2e` 0 · `lint` 0). Includes an
explicit no-detail-GET pin: GET `/admin/{categories,tags}/{id}` answers the generic 404 for well-formed,
malformed AND absent ids, so a later UI cannot accidentally depend on an endpoint the real API lacks.

**Negative controls A–G, each proven by execution, never asserted:** one precise mutation → targeted
suite run FAILS on the intended test(s) → restore → sha256 `1d2df090…` verified identical after EVERY
control (and the committed tree's server bytes are that exact SHA):

| Control | Injected defect | Test that FAILED |
| --- | --- | --- |
| A | scalar list response instead of array | "preserves SERVER order" |
| B | upsert replaces ALL locales | "never deletes an omitted stored locale" |
| C | omitted translations key resets the map | "an empty PATCH body changes nothing" |
| D | `translations: []` clears | "accepted NO-OP" |
| E | explicit-null description fails to clear | "explicit description null CLEARS" |
| F | documented 409 removed | "DOCUMENTED 409" |
| G | fabricated tag relation-409 | "every tag answers 204" |

Two authoring findings kept because they are the lesson, not noise:

1. **The no-detail-read invariant enforced ITSELF.** The calibration's first draft had a `getRow()`
   helper reading rows via a detail GET — sixteen tests failed against my OWN instrument before any
   UI exists, precisely because the endpoint does not exist. The helper now reads rows from the LIST,
   which is also the standing proof that list entities carry every field an edit flow needs.
2. Seed UUIDs initially used variant nibble `c`, which fails the repo's RFC-4122 `[89ab]` variant
   check — 34 failures of pure fixture hygiene, fixed in the seeds, not by loosening the pattern.

Not done here, deliberately: no Dashboard Taxonomy UI, no nav entry, no collection page, no editor
overlay, no lanes.ts record, no route caps, no users/roles work, no build, no browser E2E. The FE-3
Module 4/5 numbering discrepancy (Categories+Tags as one surface vs recovery doc's 4=Categories/5=Tags)
remains **intentionally unresolved** until implementation shape is known.

Next smallest unit (per the established pattern): the Taxonomy collection surface + central lane
registration, then cap measurement as one batched decision — none of it started here. Nothing pushed
or deployed; campaign tree clean after this docs-only commit.

### FE-3 Taxonomy · **U2** — the collection surface · checkpoint 2026-08-23

Implementation commit **`0de9b54`** (18 files, +1,566/−4). `/dashboard/taxonomy` is LIVE as the ONE
Taxonomy destination plan §7.1 prescribes: TWO sections — Categories and Tags — under a single
Content-group nav entry (`i-lucide-tags`), bilingual EN/AR chrome included.

#### What shipped, and the contract facts each decision encodes

| Surface | Behavior |
| --- | --- |
| Request state | Each section owns an INDEPENDENT copy of the §14.9 contract: skeleton → empty / error+retry / forbidden-on-its-own-terms / stale-refresh notice. Two honest instances of the module pattern (`useAdminCategories` / `useAdminTags`) — NO shared list abstraction invented. Browser-proven: Tags failed via browser-level interception while Categories rendered all four rows; recovering Tags through ITS retry issued ZERO Categories re-requests |
| Order | Both sections render rows in RECEIVED order — no `.sort()` anywhere. Lane pins both sequences against fixtures whose names run C→A→B, so any client-side sort fails loudly |
| ⚠ No detail read | The page issues EXACTLY two api requests (`/admin/categories`, `/admin/tags`) and NOTHING else under either `{id}` namespace — counted at the BROWSER level per navigation. This is the invariant a later editor must never break |
| Row presentation | Name with cross-locale recognition + untitled fallback; slug verbatim as data (`dir="ltr"` code chip); category description only when stored; per-locale completeness badges derived from the returned map alone — never substituted |
| Honest omissions | NO create/edit/delete controls ship: no destination exists for them, and dead buttons are dishonest UI. They join the create/edit unit |

A Vue trap worth recording for every future FE page: refs nested inside plain objects do NOT
auto-unwrap in templates — `v-if="sections.categories.forbidden"` was an always-true Ref object, not
a boolean. The fix is structural, not local: destructure composables at TOP LEVEL and wrap derived
state in `reactive()` so templates read unwrapped booleans.

#### Gates — all on the COMMITTED tree at `0de9b54` (the pre-commit hook's eslint --fix obliged re-running everything after staging)

| Gate | Result |
| --- | --- |
| `typecheck` | **exit 0**, 0 error TS |
| `typecheck:e2e` | **exit 0** |
| `lint` | **exit 0** |
| Focused unit+registry (page spec, fields spec, both-composables spec, dashboard-closure, route-assets, lane-isolation) | **243/243, exit 0** |
| Official `dashboard-taxonomy` lane | **18/18, exit 0**, exactly ONE preview/backend pair (Nitro :4400 + taxonomy backend :4401) |
| axe EN + AR | clean on the settled page AND on the held-loading state (`delayMs` makes the skeleton scannable) |
| 380px EN + AR | cold-boot RTL/LTR correct, no raw key paths, no horizontal overflow |

Negative control (collection-specific): injected a client-side alphabetical sort into the categories
`v-for`, REBUILT, ran the targeted server-order test → **FAILED at the exact assertion**
(`expect(categoryIds).toEqual([...CATEGORY_API_ORDER])`); restored byte-identically
(sha256 `d31f3c89…` verified against the snapshot AND against the committed blob — the hook did not
perturb it), rebuilt, full lane re-ran green.

#### Route measurement — proposed cap ONLY, nothing registered

Registered in `DASHBOARD_ROUTES` measured-but-UNGOVERNED (the M2·U2/T·U2 state verbatim);
`size:routes` exits **2** naming exactly `measured but NOT governed (no frozen cap in doc 20):
/dashboard/taxonomy`. Measurement via the established closure/attribution workflow on an
`ANALYZE_BUNDLE=1` production build (exit 0, `.output` present, stale-meta guard passed,
unclassified 0 B):

| Figure | Value |
| --- | --- |
| App-owned (D20-29 baseline input) | **92,160 B** rendered |
| JS route total | 269,921 B gz (53 closure assets) |
| Route-shell CSS | 28,736 B gz ≈ 28.06 KB against the 30 KB cap |
| PROPOSED D20-29 cap (NOT registered) | **106,496 B** (104 KiB) — `ceil(92,160 × 115 / 102,400) × 1024` |
| Headroom if approved | 14,336 B |

No provenance marker: `stamp-build` correctly refused on the dirty implementation tree; numbers were
taken on the exact source this commit contains (blob sha verified above). Lighthouse was not run;
nothing downstream consumed a stamp.

Not done here, deliberately: no create/edit overlays, no detail routes, no caps registered, no other
module started, users/roles untouched. The Module 4/5 numbering discrepancy remains intentionally
unresolved. Nothing pushed or deployed; campaign tree clean after this docs-only commit. Next unit:
the Taxonomy create/edit surface (overlay-based — no detail read to build an `[id]` route on), then
the batched cap decision.

### FE-3 Taxonomy · **U2 CLOSURE** — D20-39 registered and verified · checkpoint 2026-08-23

**D20-39 GOVERNED AND REPRODUCED — TAXONOMY U2 IS COMPLETE.** The owner approved the collection cap
as a route-specific decision derived from its own measured baseline by D20-29's frozen formula:

| Route | Baseline | Cap |
| --- | --- | --- |
| `/dashboard/taxonomy` (ONE destination: Categories + Tags together) | 92,160 B | **106,496 B** (104 KiB), headroom 14,336 B |

Registration: Web governance commit **`f0ba67c`** — `DASHBOARD_APP_OWNED_CAP_BYTES` +
baseline/provenance records (provenance tree `0de9b54d2efdb28191be7b0e66ae8171e7fd3d2b`, the U2
implementation commit whose page blob was byte-verified at measurement time). Explicitly NOT a
waiver, NOT a shared-floor change, NOT a generic incremental-allowance change, NOT a D20-32
recalibration; NOT inherited from Articles/Experiences/Skills/Testimonials and NOT rounded toward any
sibling. Doc 20 decision recorded on the private Docs campaign branch as **D20-39** (Docs `b18b5a2`,
local-only).

Verification BEFORE registration: governance focused specs (route-assets + dashboard-closure +
lane-isolation) **217/217**, including the new pins that fix the owner's exact bytes (92,160 →
106,496), reproduce the formula from the recorded baseline, and assert no sibling shares the taxonomy
baseline; then a fresh clean-tree `ANALYZE_BUNDLE=1` provenance build at `f0ba67c` (real build exit
**0**, `.output` present, stamp written with head `f0ba67c`): the authoritative gate **REPRODUCED**
the U2 checkpoint reading byte-for-byte — app-owned **92,160 B ≤ 106,496 B ✓**, Δ-floor 7,110 /
86,016 ✓, total JS 263.6 KB gz below the 300 KB quality target (no D20-24 warning), CSS 28.1 KB /
30 KB ✓. Authoritative **`size:routes` exit 0**: twenty-one governed routes, all inside their caps;
coverage closed in both directions after U2's deliberate ungoverned window.

#### Final Taxonomy U2 evidence (established at the implementation checkpoint, unchanged)

- ONE `/dashboard/taxonomy` destination hosting Categories + Tags as two sections under one nav entry; bilingual EN/AR chrome.
- INDEPENDENT section request state — browser-proven: Tags failed via interception while Categories rendered all rows; Tags' retry issued ZERO Categories re-requests.
- NO detail routes exist; ZERO `{id}` GET requests leave the page — counted at browser level per navigation (exactly two list requests).
- List rows are the complete future edit source (Update DTOs accept only translations; the row carries every writable field).
- Both sections render SERVER order verbatim; negative control injected a client-side sort and FAILED the server-order assertion, restored byte-identically (page blob `d31f3c89…`).
- Official `dashboard-taxonomy` E2E lane **18/18, exit 0** on exactly ONE preview/backend pair (:4400/:4401); declared lane count **14**.
- axe EN+AR clean on settled AND held-loading states; 380px cold-boot RTL/LTR green, no overflow.
- Public CSS 28,736 B gz ≈ 28.06 KB against the 30 KB cap.
- Create/edit UI has NOT started; no overlay, no forms, no delete actions, no dead controls.

The FE-3 Module 4/5 numbering discrepancy (Categories vs Tags as separate module numbers vs one
taxonomy surface) remains intentionally unresolved — this closure governs what the route IS, not how
the campaign counts it.

FE-3 state after this closure: modules 1–3 COMPLETE; Taxonomy collection COMPLETE (create/edit open);
shared SEO panel open. No next unit was started here. Nothing pushed or deployed. Campaign tree clean
after this docs-only commit; Docs campaign worktree clean.

### FE-3 Taxonomy · **U3a** — the form/payload layer · checkpoint 2026-08-23

Implementation commit **`1917a15`** (6 files, +685): `admin-category-form.ts` + `admin-tag-form.ts`
and their specs, plus one i18n key per locale (`dashboard.taxonomy.validation.atLeastOneLocale`). NO
Dashboard UI changed — no modal/sloverer/buttons/nav/routes/caps; `/dashboard/taxonomy/index.vue` is
byte-untouched.

**The binding invariant is structural, not aspirational: NEITHER module exports a fetcher.** There is
no detail GET on either entity, so editing initializes via `initialCategoryForm(row)` /
`initialTagForm(row)` straight from collection-list entities, and a spec guard pins that get-prefixed
exports cannot exist in these modules. A function that cannot be called cannot build a request the
API cannot answer.

Semantics implemented and pinned (29 focused tests):

| Rule | Category | Tag |
| --- | --- | --- |
| PATCH builder | emits ONLY locales whose content differs from the initialized row — omission IS preservation under upsert | identical |
| Untouched locale | omitted → server preserves verbatim | identical |
| Edited / newly authored locale | supplied as an indexed upsert | identical |
| Nothing changed | `{}` — an empty body; a wholesale array is never produced | identical |
| `translations: []` | can never be emitted destructively (pinned by serialized-output assertion) | identical |
| Slug | per-locale, MUTABLE — edited locales carry current slug; conflicts arrive later as indexed 422s | identical |
| Nullable | `description` sole nullable: within an emitted locale the key travels ONLY on change — omission preserves, explicit `null` clears; empty text is NEVER converted to null | NONE — spec pins exact item keys `[locale,name,slug]` so the category clear-case cannot leak |
| Authoring invariant | OD-14 applied: schema superRefine requires ≥1 usable locale (non-blank name AND slug); Arabic-first and English-first equally valid; half-filled locales valid-but-unemitted (Skills precedent) | identical |
| 422 mapping | reuses `dashboard-translation-errors`; sent order = `categoryChangedLocales` — Arabic-first single-locale payloads resolve index 0 onto the ARABIC tab (canonical-list trap stays closed) | identical |

Deliberate divergence recorded: this builder does NOT follow Testimonials' send-every-in-use-locale
rule. There the endpoint replaced wholesale, so sending everything was the only safe shape; here
replacement does not exist and re-sending an untouched locale would claim authority over stored data
the operator never exercised.

Negative controls A–E, each executed, each failing exactly its intended test, both files restored and
SHA-verified byte-identical (`40cdbb95…` / `1b1e0286…` — the committed bytes ARE those restored
bytes): A changed-locales→authored-all (omission test failed) · B empty body→`[]` emission (empty-body
pin failed) · C explicit-null suppression (clear test failed) · D fabricated tag `description:null`
(exact-keys isolation test failed) · E minimum-translation guard disabled (zero-translations rejection
failed).

Gates on the committed tree: typecheck **exit 0** · lint **exit 0** · focused specs **29/29 exit 0**.
Not run by scope: production build, browser E2E, size/route gates, axe, full suites.
⚠ **CORRECTED at U3b:** this section's earlier phrasing pointed at "future editor routes" —
Taxonomy has NO editor routes. Create/edit lives ON `/dashboard/taxonomy` as overlays; that same
route is what U3b remeasured, and any cap change applies to that one route.

Not done here: no overlay UI (that is U3b's unit), no navigation/routes/caps changes, no SEO panel,
Module 4/5 numbering still intentionally unresolved. Nothing pushed or deployed; campaign tree clean
after this docs-only commit.


### FE-3 Taxonomy · **U3b** — create/edit/delete overlays ON the route · checkpoint 2026-08-23

Implementation commit **`4fe9cfe`** (11 files, +1,323/−18): `TaxonomyCategoryOverlay.vue` +
`TaxonomyTagOverlay.vue` mounted on `/dashboard/taxonomy`, write methods added to the two collection
composables (`useAdminCategoryWrites`/`useAdminTagWrites` — throwing; still NO detail read), page
buttons/row actions wired, bilingual overlay copy added.

**Invariants browser-proven (38/38 lane, ONE preview/backend pair :4400/:4401):**
edit opens from the clicked row with ZERO `{id}` GETs (counted per navigation); zero usable
translations blocked client-side with ZERO writes; PATCH carries only changed locales — untouched
locale omitted AND preserved after refresh, `[]` never emitted destructively; slug mutable;
description explicit clear sends `null`, untouched key omitted, empty-input normalized to `null` at
the binding only; tag items carry exactly `[locale,name,slug]` and delete models no relation case
while the category article-reference 409 surfaces localized with the entity intact; dirty close asks
confirm(); collection refreshes via composable `load()` only and BOTH sections keep SERVER order
after mutations; unfiltered axe clean EN+AR on settled page AND open create/edit overlays; 380px
EN/AR green with per-field direction independent of chrome.

**Controls A–F**, each mutating app source → REBUILD → targeted browser test FAILS naming its test →
byte-identical restore SHA-verified: A planted detail fetch on edit-open · B minimum-translation
guard removed · C changed→authored replace-all · D explicit-null suppression · E fabricated tag 409 ·
F post-refresh client-side sort.

**Route budget HONESTLY BREACHED — returned to the owner, cap untouched:** the overlay lives on the
governed route, so `/dashboard/taxonomy` re-measured at **135,345 B app-owned** vs the D20-39 cap
**106,496 B** — `size:routes` **exit 1** (135,345 > 106,496 ✗), total JS 301.0 KB gz enters the
D20-24 warning band, CSS unchanged 28,736 B gz / 30 KB ✓. D20-29 formula on the completed-route
baseline yields a PROPOSED-ONLY replacement of **155,648 B (152 KiB)** — NOT registered, NOT applied.
No provenance stamp: implementation-tree builds correctly refuse; gates were run on real exit codes.

Two reusable findings recorded: (1) refs nested in slot-scope objects need renaming (`locale:` →
`fieldLocale`) or templates silently bind undefined; (2) Reka's slideover entrance + initial-focus
pass swallows early tab clicks — `overlaySettled` now waits for `data-state="open"` plus a transition
guard, and `fillField` ACTIVATES the tab then fills visibly (a forced fill on a hidden panel mutates
nothing in Vue state).

Module 4/5 numbering remains intentionally unresolved. Nothing pushed or deployed. Campaign tree
clean after this docs-only commit.

### FE-3 Taxonomy · **IMPLEMENTATION COMPLETE** — D20-40 registered · closure checkpoint 2026-08-23

Governance commit **`b820825`**: `/dashboard/taxonomy` re-baselined to **135,345 B** with cap
**155,648 B (152 KiB)** (D20-29 on the completed U3b route; headroom 20,303 B), provenance
`4fe9cfe…`. Doc 20 decision **D20-40** (Docs `c180132` + reproduction-delta correction `074494f…`
`07449f4`, local-only). Route-budget focused specs **217/217** including pins for BOTH generations
(D20-39 historical pair kept as evidence) and no-sibling-baseline independence.

**Reproduction honesty:** the stamped governance build (`b820825`) measures **135,496 B** — +151 B
(+0.11 %) over the checkpoint's 135,345 — attributed to the pre-commit hook's eslint --fix
reformatting two overlay files after measurement; zero unclassified bytes both readings; owner pair
registered exactly as decided; `size:routes` **exit 0** (135,496 ≤ 155,648 ✓).

**D20-24 warning band acknowledged with attribution:** total JS 301.0 KB gz (~1 KB over target);
attribution names the page module script (~20.3 KB) — the justified weight of one route owning two
collections plus both overlays. Not chased; no other budget moved; CSS 28,736 B gz / 30 KB Δ0.

#### FINAL TAXONOMY EVIDENCE (complete product surface)

One `/dashboard/taxonomy` destination hosting Categories + Tags; independent section request states;
NO detail routes and NO detail-GET dependency (browser-counted); list rows are the complete edit
sources; U3a form semantics proven; overlay create/edit/delete complete; Arabic-first AND
English-first authoring valid; zero-translation wire-level guards; upsert/omission-preserves;
Category description null-clear; documented Category article-reference 409 localized with entity
intact; Tags carry no fabricated 409; 422 → correct locale tab; unsaved-change confirm on dirty
close; server order preserved after every refresh; official lane **38/38 exit 0** on ONE
preview/backend pair (:4400/:4401); unfiltered axe EN+AR settled page and open overlays; 380px EN/AR
green; controls A–F each caught their defect with byte-identical restores.

FE-3 open items: the shared per-entity SEO panel only. Module 4/5 numbering remains intentionally
unresolved. Nothing pushed or deployed; campaign tree clean; Docs campaign worktree clean.

### FE-3 · **SEO-U1** — the shared presentational SEO panel · checkpoint 2026-08-23

Implementation commit **`2456e96`** (4 files, +323): `app/components/dashboard/SeoPanel.vue` +
`SeoPanel.spec.ts`, plus one additive `dashboard.seo.*` label group in BOTH catalogues. Grounded in
the read-only SEO investigation: per-entity SEO exists ONLY on Articles and Projects (FR-CNT-010/020;
D09-4 embeds it in translation rows; the contract gives Experience/Skill/Testimonial/Category/Tag
DTOs zero SEO fields), so those two editors are the only intended FE-3 consumers, and the remaining
FE-3 surface is extracting their duplicated inline SEO sections — not adding SEO anywhere else.

**The panel is PRESENTATIONAL ONLY, and the boundary is pinned by a test, not a convention:** four
bound fields (`metaTitle`, `metaDescription`, `canonicalUrl`, `ogImageId`) with verbatim emit-through
(so the picker's null-on-clear survives untouched), optional per-field error props for the caller's
form context, `contentDir` applied to natural-language fields while canonical URL stays LTR under
every direction, `DashboardMediaPicker` reused (`allowed-kind="IMAGE"`) rather than a second picker.
No persistence, no payload building, no API access, no form state, no tab ownership, no status/slug
logic; the source-scan spec rejects any mention of a consuming module by name.

**No runtime caller exists yet — deliberate.** `ArticleEditor.vue` and `ProjectTranslationFields.vue`
are byte-unchanged (verified via `git diff` empty), zero call sites exist (grep), and therefore no
governed route closure moved. No build, size or route gates were run BY SCOPE: an uncalled component
cannot change any route budget. Old per-module SEO label keys stay — they are still live until the
wiring units replace them.

Gates on the committed tree: focused component spec **15/15 exit 0** · `typecheck` **exit 0** ·
`lint` **0 errors** · `locale-parity` **5/5** · `check-logical-properties` **exit 0** · sibling editor
specs re-run green (**44/44**) to prove no incidental disturbance. The pre-commit hook's
`eslint --fix` was verified NOT to perturb the component (post-commit sha256 equals the pre-mutation
pristine capture) — the D20-40 drift lesson applied.

Negative controls A–D, each executed against the component, each failing exactly its targeted test,
each restored and SHA-256-verified byte-identical (`6800752d…` after every restore):
A removed `dir="ltr"` from canonical URL → both direction tests FAILED · B coerced picker clear to
`''` → verbatim-null forwarding test FAILED (`expected [ '' ] to deeply equal [ null ]`) · C removed
`allowed-kind="IMAGE"` → picker-kind test FAILED (`undefined ≠ 'IMAGE'`) · D injected entity-specific
wording → entity-blind source scan FAILED naming the line.

Next unit is **SEO-U2**: reconcile the Projects payload's null-clearing semantics
(`admin-project-form.ts` currently omits blank SEO fields — its justifying comment is falsified by
the adopted contract, which declares all four nullable with "null clears it"; Articles already sends
explicit `null`). Nothing pushed or deployed; campaign tree clean after this docs-only commit.

### FE-3 · **SEO-U2** — Projects SEO null-clearing corrected · checkpoint 2026-08-23

Implementation commit **`37443be`** (3 files, +238/−19): `admin-project-form.ts`,
`admin-project-form.spec.ts`, and the ONE line in `ProjectEditor.vue` that passes the seeded
baseline to update saves. The pre-campaign defect is closed: blank SEO values were omitted from
every PATCH, so a stored `metaTitle` / `metaDescription` / `canonicalUrl` / `ogImageId` could never
be cleared — the save reported success while the server kept everything. The builder's old
justification ("DTO types these `string`, never `null`") was factually false against the adopted
contract (`ProjectTranslationDto` declares all four `?: string | null`, "null clears it", D10-23).

**The three-state rule, decided by ORIGINAL-vs-CURRENT** — the seeded form (the SAME baseline the
unsaved-changes guard already holds; no second dirty-tracking system) is now a second parameter of
`buildProjectPayload`: unchanged since load → key omitted → server preserves · held-then-blanked →
explicit `null` → server clears · changed → new trimmed value. `ogImageId` follows the identical
pair (same id → omitted; held → null cleared; replaced → new id; never-held → omitted). CREATE
passes no baseline and keeps its omission-on-blank shape byte-for-byte — nothing stored to clear.
Required translation fields still travel verbatim in both modes; per-locale upsert preservation is
untouched, and an untouched locale's SEO keys stay absent from its entry (verified cross-locale).

Focused gates on the committed tree: `admin-project-form.spec.ts` **42/42 exit 0** (33 before;
+9 PATCH-semantics tests covering every field × untouched/cleared/changed, both locales,
already-empty preservation, and create-mode pins) · `typecheck` **exit 0** · `lint` **0 errors**.

Negative controls against the OLD behavior, each failing exactly its targeted tests, each restored
sha256-verified byte-identical: **A** omission-on-clear restored → 5 clear-case tests FAILED ·
**B** og-image clear-as-omission → 2 FAILED · **C** unconditional emission (no baseline comparison)
→ 6 untouched-preservation tests FAILED. Control A is the live-defect proof: the suite discriminates
the real shipped bug, not just the new implementation.

No UI wiring changed: `SeoPanel.vue`, `ArticleEditor.vue`, `ProjectTranslationFields.vue` are
byte-unchanged in the commit and the tree; the panel still has zero callers; no route budget moved;
no build/size/browser gates run BY SCOPE. One commit-message repair worth noting for honesty: the
first implementation commit's message lost two backquoted words to shell substitution and was
amended UNPUSHED within the minute — same tree, same diff, no history rewritten beyond itself.

Next unit: **SEO-U3a — wire DashboardSeoPanel into Articles**, then U3b (Projects), then the batched
gate pass. Nothing pushed or deployed; campaign tree clean after this docs-only commit.

### FE-3 · **SEO-U3a** — Articles consume the shared SEO panel · checkpoint 2026-08-23

Implementation commit **`0466c94`** (6 files, +173/−39). The duplicated four-field SEO block inside
`ArticleEditor.vue` is replaced by `<DashboardSeoPanel>` bound directly to the existing per-locale
translation form state with per-field server-error props — payload ownership, save behavior and the
`useTranslatableForm`/`dashboard-translation-errors` 422 flow are untouched. The editor keeps owning
its disclosure `<details>` wrapper; the panel gained a `bare` prop that drops its own fieldset/
legend/help there (named for the OFF state because Vue casts an absent Boolean prop to `false` —
the first draft's `heading?: boolean` silently defaulted every consumer to bare and was caught by
the panel spec before any wiring).

**Media lazy boundary PRESERVED, and now pinned:** the panel's OG picker is `LazyDashboardMediaPicker`
(same interface Articles already used), and a source-scan test in the panel spec makes a static
`<DashboardMediaPicker>` regression a failure — control D proved the pin fires.

**Old Article SEO presentation removed; i18n reconciled.** `[data-editor-meta-title]` and siblings
are gone from the editor DOM (asserted), and the four `dashboard.articles.field.{metaTitle,
metaDescription,canonicalUrl,ogImage}` keys became provably dead repo-wide after wiring — removed
from BOTH catalogues, parity gate green. Projects' duplicate keys stay: Projects is not wired yet.
One deliberate presentation normalization recorded honestly: panel fields carry explicit per-content
`dir` (Articles' old SEO inputs inherited chrome direction); this matches ProjectTranslationFields'
documented doc 11 §6 pattern.

Gates on the committed tree: focused specs **67/67** (panel 16 · editor 17 — binding, EN/AR
isolation, picker select/clear→null through the panel, indexed canonicalUrl 422 → ARABIC input +
tab, unsaved-state, no-`[data-project-field]`/no-Projects-keys pins · article-form 19+... · parity)
· `typecheck` exit 0 · `lint` 0 errors · post-commit re-run 33/33 + lint 0 (hook's eslint --fix did
not perturb bytes).

**Route measurement** (`ANALYZE_BUNDLE=1 NUXT_PUBLIC_SITE_URL=… npm run build` exit 0 on the
implementation tree — stamp correctly refused on the dirty tree, so these readings carry no
provenance marker): `/dashboard/articles/new` **116,693 B** app-owned and `/dashboard/articles/{id}`
**116,801 B** against their frozen **122,880 B** caps — **both PASS**, headroom ≈6.2/6.1 KB;
`size:routes` **exit 0** across all governed routes. ⚠ Attribution honesty: the recorded D20-33
baselines (106,095/106,203) predate many campaign units and their provenance tree is UNRESOLVED in
`route-assets.mjs`, so the ~10.6 KB delta must NOT be attributed to this unit alone without a
pre-unit rebuild — which was deliberately not run (no byte-chasing; caps pass either way).
CSS reads **29.2 KB gz / 30** on this build — inside the ledger's recorded tree-to-tree variance
band (28.05–29.19), to be re-measured on a clean stamped tree at SEO-U4's batched gates.

Negative controls A–D, each failing exactly its targeted tests, each restored sha256-verified:
**A** `v-model:meta-title` demoted to one-way `:meta-title` → 3 FAILED (binding, independence,
unsaved) · **B** canonicalUrl error routed to literal `en` → indexed-422 test FAILED · **C** panel
clear coerced to `''` → clear test FAILED · **D** Lazy prefix removed → lazy-boundary pin FAILED.

Official `dashboard-articles` lane **48/48, exit 0** on ONE preview/backend pair, including
unfiltered axe EN+AR over the refitted editor. Full e2e, other lanes and Projects work untouched.

Next unit: **SEO-U3b — wire DashboardSeoPanel into Projects** (replacing ProjectTranslationFields'
fieldset; Projects payload semantics already corrected at SEO-U2), then SEO-U4 batched gates.
Nothing pushed or deployed; campaign tree clean after this docs-only commit.

### FE-3 · **SEO-U3b** — Projects consume the shared SEO panel · checkpoint 2026-08-23

Implementation commit **`ef92d8e`** (4 files, +170/−47). The duplicated SEO fieldset inside
`ProjectTranslationFields.vue` (legend, help, three inputs, STATIC `DashboardMediaPicker`) is
replaced by `<DashboardSeoPanel>` in its TITLED mode — the panel owns exactly the fieldset/legend/
help this file used to duplicate. Bound per locale through the component's own `setField` emit path
into the existing translation form state; no shadow SEO state, no baseline duplication. Content
direction stays per locale; canonicalUrl stays LTR through the panel.

**Payload semantics remain owned by SEO-U2, unchanged here** — and proven through the REAL editor:
text edits → new strings; held-then-blanked text and a cleared OG image → explicit `null`; replaced
image → new id; untouched values → keys ABSENT from the PATCH entry (server preserves); EN↔AR edits
mutually isolated; canonical LTR under the RTL section; an SEO edit opens the save affordance.
`admin-project-form.ts` is byte-untouched by this unit.

**One shared picker path for both entities now:** the translation component imports NO picker; the
panel's Lazy variant is the only SEO media-picker route, pinned by a source-scan test (control E
proved it fires). After wiring, six duplicated Projects SEO label keys (`projects.field.{metaTitle,
metaDescription,canonicalUrl,ogImage}`, `projects.editor.{seo,seoHelp}`) became provably dead and
were removed from both catalogues; parity gate green. Articles (`ArticleEditor.vue`,
`admin-article-form.ts`) and `SeoPanel.vue` are byte-unchanged in commit and tree.

Gates on the committed tree: focused specs **109/109** (ProjectEditor **46** = 36 existing + 10 new
refit proofs · panel 16 · project-form 42 incl. the full SEO-U2 suite · parity 5) · `typecheck`
exit 0 · `lint` 0 errors · post-commit re-run 46/46. Negative controls A–E, each failing its
targeted tests, each restored sha256-verified byte-identical: **A** disconnected metaTitle binding
→ 4 FAILED · **B** cross-locale write rerouting at the editor level → isolation test FAILED (among
10 — the mutation reroutes all translation writes, recorded honestly) · **C** clear-to-empty
coercion → 1 FAILED · **D** omission-on-clear restored in the payload layer → the 5-test SEO-U2
control set FAILED (live-defect discrimination still holds) · **E** old static picker path
restored → source pin FAILED.

No route measurement BY SCOPE — `/dashboard/projects/new` (175,104 B) and `/dashboard/projects/{id}`
(176,128 B) caps untouched; SEO-U4 owns the clean-tree batched build/measurement. **R16 remains
OPEN**: Projects still has no real browser lane; per-unit verification stayed at component level.

Next unit: **SEO-U3c — focused Projects browser lane / R16 closure**, then **SEO-U4** as the final
batched measurement/gates unit. Nothing pushed or deployed; campaign tree clean after this
docs-only commit.

### FE-3 · **SEO-U3c** — the Projects browser lane lands; R16 CLOSED · checkpoint 2026-08-23

Implementation commit **`7ea02fe`** (6 files, +926). `dashboard-projects` is now an official lane:
ONE mutable spec file (`e2e/dashboard-projects/projects.spec.ts`) owning its own resettable backend
process pair (4500/4501), registered in `scripts/e2e/lanes.ts` (**lane count 14 → 15**) and in
`ci-preview.mjs`; config, shard plan and the isolation guard all derive, unchanged. A focused run
boots exactly ONE production preview + ONE projects backend, measured.

The backend (`scripts/e2e/projects-server.ts`) models what this surface needs and no FE-3 sibling
has: the PAGINATED collection envelope (`data`+`meta.total`), auth with the rotating-refresh
handshake its siblings answer, media resolution for the OG picker's stored reference, latency
control for the request states, and the D10-23 SEO pair ON THE WIRE — omitted key preserves,
explicit null clears.

**21/21 browser tests, exit 0**, over real Nitro + real HTTP: collection/editor/create entry; held
read → skeleton → settled (collection AND editor); error/retry recovery and forbidden-as-its-own-
state; picker vocabulary/search/held-selection/no-touch-save intactness; shared SEO panel EN+AR —
per-locale isolation both directions, cleared `metaTitle` reaching the PATCH as `"metaTitle": null`
(**the SEO-U2 live defect, asserted on the wire plus round trip**), cleared `ogImageId` → null via
the picker's OWN clear control, untouched values omitted; dirty→save→rest cycle; 380px EN/AR
overflow; RTL chrome cold boot; **unfiltered axe EN, AR and the held-loading state**; browser-level
public-isolation request capture across load + save.

**R16 is CLOSED.** The gap was real and it bit immediately: pointing a browser at this surface for
the first time found a genuine accessibility defect — the editor loading state rendered NO level-one
heading (`axe page-has-heading-one`), fixed inside Projects with an `sr-only` h1 mirroring the
settled heading, pixels identical, axe clean without disabling any rule. Two test-harness races were
also fixed before they could lie: the PATCH listener registered after the click, and a clean form
(a disabled save) mistaken for a save target. Fixture lesson recorded: the seed initially omitted
required `createdAt`/`updatedAt`, and every row card threw `Invalid time value` to an empty vnode —
a contract violation by the FIXTURE, not the surface.

Negative controls A–E, each requiring a real rebuild, each failing exactly its targeted browser
assertion, each restored sha256-verified byte-identical: **A** omission-on-clear restored → wire
null assertion FAILED · **B** cross-locale write rerouting → isolation FAILED · **C** held
technology seeding dropped → picker preservation FAILED · **D** loading-state ownership removed →
skeleton assertions FAILED · **E** canonical forced-LTR removed → LTR-under-RTL FAILED.

No route cap changed and none measured BY SCOPE (`/dashboard/projects/new` 175,104 B,
`/dashboard/projects/{id}` 176,128 B frozen); SEO-U4 owns the clean-tree batched build and final
FE-3 gates. Articles, SeoPanel.vue and admin-article-form.ts byte-unchanged. Nothing pushed or
deployed; campaign tree clean after this docs-only commit.

---

## FE-3 CLOSED — final integration, measurements and closure gates · checkpoint 2026-08-23

Gate-sync commit **`96ea5b6`** (7 test files, no product change — see below) + this docs-only
closure commit. **FE-3 IS COMPLETE: every approved product surface is implemented, verified, and
inside its governance. FE-4 is next.**

### Final FE-3 product inventory

| Surface | State |
| --- | --- |
| Experiences CRUD (module 1, M1·U1–U5) | COMPLETE |
| Skills CRUD (module 2, D20-36) | COMPLETE |
| Testimonials CRUD (module 3, D20-37/38) | COMPLETE |
| Categories + Tags Taxonomy (D20-39/40) | COMPLETE |
| Shared per-entity SEO panel (SEO-U1–U3c) | COMPLETE |

The historical Module 4/5 numbering discrepancy remains bookkeeping-only; Tags was never a separate
unfinished product surface.

### The shared per-entity SEO panel — what closure means

One `DashboardSeoPanel` (four contract fields, presentation only, entity-blind by pinned source
scan) now serves the ONLY two entities the contract gives SEO fields to: **Articles** (bare mode,
caller owns disclosure) and **Projects** (titled mode), through the single Lazy media-picker path.
**Projects' null-clear defect is fixed and browser-proven on the wire**: cleared `metaTitle`/
`ogImageId` reach PATCH as explicit `null`; untouched values are omitted; EN/AR isolated;
canonical LTR under RTL chrome. R16 CLOSED via the official `dashboard-projects` lane (21 tests).

### Clean authoritative build

`ANALYZE_BUNDLE=1 NUXT_PUBLIC_SITE_URL=https://example.com npm run build` → **exit 0**, `.output`
present, provenance stamped ON THE CLEAN TREE: head `632b160…`, tree `ff263e2b…`, output
`6f1a7d81…` (1653 files). No wrapper masking (explicit exit read).

### Final route measurements (frozen caps, all PASS — `size:routes` exit 0, zero unclassified bytes)

| Route | App-owned | Cap | Headroom | Verdict |
| --- | --- | --- | --- | --- |
| `/dashboard/articles/new` | **116,683 B** | 122,880 B | 6,197 B | ✓ |
| `/dashboard/articles/{id}` | **116,791 B** | 122,880 B | 6,089 B | ✓ |
| `/dashboard/projects/new` | **152,710 B** | 175,104 B | 22,394 B | ✓ |
| `/dashboard/projects/{id}` | **152,888 B** | 176,128 B | 23,240 B | ✓ |

No breach → no cap escalation, no new D20 decision required. All four sit in the D20-24 warning
band on route TOTAL (>300 KB gz quality target) with attribution unchanged from their registration
readings (entry+page composition); warnings oblige attribution, not failure.

### Global performance gates

`size` exit 0 · `size:routes` exit 0 · `check:bundle` exit 0 (138 public chunks, no forbidden
modules) · `check:logical` exit 0. **Public CSS: gate reads 28.1 KB gz / 30.0 KB — PASS on every
route**; independent byte cross-check of the entry stylesheet reads 28,983 B gz (+247 B vs the
28,736 B Taxonomy-closure figure, within method variance; no new utilities were introduced by any
SEO unit — the panels compose existing classes). Cap untouched; no recovery needed.

### Static/unit gates (serial)

`typecheck` exit 0 · `typecheck:e2e` exit 0 · `lint` exit 0 · **unit suite: 144 files / 2102 tests,
exit 0, 0 failures, 0 skips**.

⚠ **The full-suite run earned its keep before it went green.** The first reading failed 6 tests —
all deterministic expectation drift the focused-suite era had accumulated, none product regressions:
the nav Content-group assertion predated Taxonomy's entry, five per-module public-isolation gates
each treated later siblings' composables as "public surface" (PATH-defined scan), and ArticleEditor's
API mock answered `/admin/media/*` with an article so the OG picker threw unhandled errors after
green tests. Fixed as `96ea5b6`: every isolation gate now registers the COMPLETE sibling module set,
which retires this drift class for future modules rather than patching one offender.

### Affected browser lanes (final clean build)

`dashboard-articles`: **48/48, exit 0**, ONE pair, 1.8 min — includes unfiltered axe EN+AR and
380px EN/AR over the refitted editor. `dashboard-projects`: **21/21, exit 0**, ONE pair, 49 s —
includes unfiltered axe EN, AR AND held-loading state plus 380px EN/AR. Step-6 a11y evidence is
therefore cited from these lanes, not duplicated.

### Full suite vs sharded suite (R14/R15 evidence)

| Run | Command | Result | Duration |
| --- | --- | --- | --- |
| Normal full | `npx playwright test` | **614 passed / 2 failed**, exit 1, 0 skipped, 616 discovered | 5.9 min |
| Sharded (opt-in) | `npm run test:e2e:sharded` | **616 passed / 0 failed**, exit 0 — 4 shards (329+85+110+92), ≤4 concurrent pairs | ~5–8 min wall |

The two full-run casualties, classified: (1) `[contract] locale-head-contract "Home EN→AR"` —
`window.__chrome` undefined at evaluate, i.e. the page raced its own hydration-injected observer:
NOT an affected FE-3 lane; resource-contention/hydration-race class. (2)
`[dashboard-articles] F-1 "UPDATING overlay is Arabic while a refresh is in flight"` — the
milliseconds-wide updating window closed before sampling under 15-pair load: affected FE-3 lane,
but the SAME spec passed 48/48 in isolation this session. Both match R15's recorded signature
(load-dependent transport/timing, never content assertions). Neither reproduced under sharding.

**R14 conclusion: (B) — evidence now supports making sharding the default.** The old
`11 < 12` guard is dead: the count trigger is exceeded (15 lanes) and the casualty trigger fired in
this very measurement (2 casualties at full concurrency, zero at ≤4 pairs). Recorded as a
RECOMMENDATION ONLY — changing the default command is a separate central decision for FE-4/FE-5
planning, deliberately not made here.

**R15 status: remains OPEN, stated precisely — the known flaky class REPRODUCED today under full
concurrency (2 casualties) and did NOT reproduce under sharded execution. Nothing is claimed fixed.**

### Deterministic blockers

None. No approved FE-3 product surface remains open. **FE-3 is officially COMPLETE. FE-4 is next**
(static-page SEO module, global head/tags, settings completion, RBAC owner decision, overview).

Nothing pushed or deployed. Campaign tree clean after this docs-only commit.

---

## R14 CLOSED — sharded execution is now the DEFAULT full-suite strategy · checkpoint 2026-08-24

Implementation commit **`af26998`** (4 files, +89/−6): `package.json` command graph,
`scripts/e2e-shards.mjs` header record, seven structural pins in the lane-infrastructure spec,
PROJECT_GUIDE developer documentation. Orchestration ONLY — no test assertion changed, no timeout
raised, no retry added, no worker/shard count tuned.

**The measured reason, preserved verbatim from SEO-U4 (not rewritten):** the final FE-3 gate ran
the normal full suite ONCE at 15-lane full concurrency → **614/616, exit 1**, both casualties
matching the R15 resource/race class (`contract` hydration-observer race; Articles updating-window
missed under load) — and then the existing opt-in runner → **616/616, exit 0** across 4 shards at
≤4 concurrent pairs. Both trigger conditions of the old `11 < 12` guard were therefore live at
once: lane count exceeded AND a casualty class reproduced on the default path.

**What changed:**

| Command | Before | After |
| --- | --- | --- |
| `npm run test:e2e` | bare `playwright test` — ALL 15 pairs at once | **delegates to the existing 4-shard runner** |
| `npm run test:e2e:sharded` | the authoritative runner | unchanged — still the ONE implementation |
| `npm run test:e2e:unsharded` | did not exist | **explicit diagnostic**: bare `playwright test`, for reproducing R15 and infrastructure diagnosis; documented as NOT the recommended path; no retries |

CI needed NO edit: `.github/workflows/ci.yml` already invokes `npm run test:e2e`, which now
delegates. Focused lanes are untouched by construction AND by pin: single `--project` selection
still resolves to exactly ONE pair through plain Playwright, and the shard runner's refusal of
`--project` has its GUARD CONDITION pinned (see control D below).

**Seven structural pins** in `lane-isolation.spec.mjs`: default delegates to the one sharded runner
(no second implementation anywhere in the script graph) · shard count pinned to the MEASURED 4 ·
unsharded diagnostic exists and never recurses into sharding · focused lanes bypass the runner with
a live guard · all **15** lane records with unique port pairs · CI rides the default script · no
retries in any command or the config (`retries: 0`).

**Negative controls A–D**, each executed against this spec and restored sha256-verified:
A default re-pointed to unsharded → 1 FAILED · B concurrency raised 4→6 → exact-measured pin FAILED ·
C unsharded command deleted → 2 FAILED · D shard guard disabled → initially **PASSED against its
mutation** because the pin matched only the refusal message — the assertion was strengthened to bind
the guard condition itself and control D re-run: FAILED. The lesson is recorded: a string-presence
pin on an error MESSAGE does not pin behaviour; bind the condition.

**Authoritative run of the NEW default from the committed tree:** `[e2e-shards] 15 lanes in 4
shard(s), at most 4 concurrent preview pairs` → **616/616 passed, exit 0**, shards 329/85/110/92
(~7 min wall). The old unsharded full suite was NOT re-run — its failure evidence is the recorded
justification for this change.

**R14: CLOSED** — the measured sharded orchestration is now the default full-suite strategy.
**R15: remains OPEN** — known intermittent hydration/loading-window races remain diagnostic defects;
the new default avoids the high-contention execution condition that reproduced them but does not
prove the assertions themselves fixed. FE-3 remains COMPLETE; no product behavior changed; no budget
touched; FE-4 remains next. Nothing pushed or deployed; campaign tree clean after this docs-only
commit.

---

## FE4-U1a — the Static Page SEO CONTRACT INSTRUMENT · checkpoint 2026-08-24

Implementation commit **`68a02ce`**: `scripts/e2e/page-seo-server.ts` +
`page-seo-server.spec.ts`, exactly two new files, nothing else touched — the Skills M2·U1 /
Testimonials T·U1 / Taxonomy U1 instrument shape. **No Dashboard UI, no route, no lane record, no
public `<head>` wiring, no FR-DSH-052 modeling, no Settings/Messages/Overview work.** Every modeled
behavior was re-derived from the adopted contract (`openapi/openapi.json`, blob `185f067e…`) before
being written.

### The contract facts the instrument pins

| Area | Modeled behavior |
| --- | --- |
| Page-key vocabulary | CLOSED seven-key set (D09-24): `home, about, experience, projects, blog, resume, contact`. Page KEYS, never ids/slugs — a UUID path is outside the vocabulary (admin 422 / public 404). |
| Admin list | `{ data: AdminPageSeoEntity[] }` — one entry per known key, EVERY enabled locale present, all-null when unauthored. ZERO query parameters (unsolicited → 422), no pagination/filter/sort/meta. **Order is NOT documented in the contract**, so completeness is asserted by SET and entries are looked up BY KEY; no semantic ordering assumption is encoded. |
| Admin detail | Whole per-locale map for one page; unknown key → **422** ("Unknown static page key"), never 404. |
| PATCH upsert | Supplied locales UPSERT; omitted locales untouched (no replace-all, no delete-locale). Within a locale: omitted field PRESERVES, explicit null CLEARS, non-null REPLACES. Validation before write; all locales apply in one pass. Unknown/disabled LOCALE → the dedicated **400** class; unknown key / malformed fields → **422**. Foreign top-level keys REJECTED — including every FR-DSH-052 field (`googleSiteVerification`, `gtmContainerId`, …), proving the DTO boundary excludes global tags. |
| ogImageId | Must reference an EXISTING IMAGE asset: malformed UUID 422 · missing id 422 · PDF id 422 · valid IMAGE accepted · null clears · omission preserves. Minimal embedded media registry is fixture vocabulary only — no upload/picker/media endpoints. |
| Public read | Override layer, not content record (D10-24): known-but-unauthored → **200 all-null** (both locales), 404 RESERVED for unknown keys. NO cross-locale fallback (D10-6). Disabled locale → 400, malformed locale → 422, default `en`. `ogImage` resolved from the SAME registry with the ASSET-LEVEL localized alt for the requested locale. |
| Coherence | Admin routes and the public route read ONE in-process state — an admin PATCH is immediately observable publicly (the property FE4-U2's head rendering will depend on), proven directly including an OG set→descriptor→clear→null round-trip. |

Seeds: `about` fully authored both locales, `blog` AR-only, five pages unauthored — every proof
starts from discriminating data without setup. Operational controls follow the established
instrument set: resettable fixtures, forbidden/error modes, delayMs hold, one-shot write failure.

### Gates (committed tree at `68a02ce`; hook's eslint --fix verified NOT to perturb bytes)

| Gate | Result |
| --- | --- |
| Focused instrument | **56/56 passed, exit 0** |
| `npm run typecheck:e2e` | **exit 0** |
| `npm run typecheck` (full) | **exit 0** |
| `eslint` on both files | **exit 0** |

Negative controls A–F, each ONE behavioral mutation → targeted vitest run FAILS naming its test →
byte-identical restore, sha256 `d691a317…` verified after EVERY restore (and equals the committed
blob):

| Control | Injected defect | Test that FAILED |
| --- | --- | --- |
| A | locale upsert → replace-all map wipe | "PATCH EN UPSERTS EN and preserves the stored AR row verbatim" |
| B | omitted nullable field → implicit null | all FOUR "OMITTED field PRESERVES" tests (per-field discrimination held) |
| C | explicit null → omission (preserves) | all FOUR "explicit null CLEARS" tests |
| D | public reads on a disconnected shadow state | "an admin PATCH is immediately observable from the public endpoint" |
| E | IMAGE-kind restriction removed | "rejects a NON-IMAGE (PDF) asset id with 422" |
| F | known-unauthored page answered 404 publicly | "a KNOWN page with NOTHING AUTHORED returns 200 with every field null" |

Two authoring findings kept because they are the lesson: (1) the first draft FORGOT to wire the
foreign-property rejection into PATCH validation — the FR-DSH-052 boundary test caught a real
instrument bug before any negative control ran; (2) TypeScript narrowing does not cross sibling
method branches — the closed-set guard was hoisted above GET/PATCH rather than duplicated.

### Standing state carried forward

- **Users/Roles list-schema contract defect** (scalar `$ref` vs array runtime): still armed in blob
  `185f067e…`, covered by the existing backend handoff, **non-blocking** — OD-2 defers its only
  consumer.
- **Dynamic RBAC management UI remains POST-V1** (OD-2); permission-aware Dashboard behavior stays
  D11-2 as implemented.
- **Related-articles OD-7 remains UNRESOLVED** — plan §6 lists it under FE-4, the FE-3-closure FE-4
  naming omits it; do not start it without an owner ruling.

**Next unit: FE4-U1b — the Static Page SEO form/payload semantics** (pure form model + payload
builder + specs, no UI), then the collection/editor surfaces. No browser lane registered in U1a by
design; standalone server default port 4601, authoritative pair belongs to the later lane record.
Nothing pushed or deployed; campaign tree clean after each docs-only commit.

---

## FE4-U1b — the Static Page SEO form/payload SEMANTICS · checkpoint 2026-08-24

Implementation commit **`0f013d4`**: `app/composables/admin-page-seo-form.ts` +
`admin-page-seo-form.spec.ts` plus ONE additive i18n key per locale
(`dashboard.seo.validation.canonicalUrl`). **No Dashboard page/route, no API composable, no lane, no
public `<head>` wiring.** Pure and Nuxt-free like every sibling admin form module.

### The semantic layer the future editor consumes

| Area | Behavior |
| --- | --- |
| Form model | Per locale (`en`, `ar`): `metaTitle/metaDescription/canonicalUrl` as editable strings (null reads → `''`), `ogImageId: string \| null`. Baseline snapshot independent of current state. |
| Optional override data | **NO OD-14 content guard — deliberately.** All-null locales are valid; a single populated field is valid; clearing the FINAL remaining override is legal and emits the explicit clears. A dedicated test prevents accidental reuse of the content-entity minimum-translation rule, and negative control F proved the tests discriminate it. |
| No-change result | `buildPageSeoPatch` returns **`null`** when nothing changed — the explicit no-mutation sentinel. `{ translations: [] }` is UNREACHABLE by construction because the adopted contract rejects an empty array ("at least one entry"). |
| PATCH emission | Only CHANGED locales travel (baseline-vs-current, trim-disciplined); within an emitted locale only changed fields travel: unchanged → omitted (preserved) · held→blanked → explicit `null` (cleared) · initially-null still-blank → omitted · replacement → trimmed value. ogImageId: untouched → omitted · replaced → new id · cleared held id → `null`. Never replace-all. |
| Canonical URL | Client-side URI validation ONLY for non-blank values (blank = legitimate cleared state); absolute http(s) check via `URL`; EN/AR independent; NO invented length limits (contract declares none). |
| Identity | `pageKey` is REQUEST-PATH identity only — the initializer drops it and the builder cannot serialize it into `UpdatePageSeoDto`. |
| Sent order / 422 mapping | `pageSeoChangedLocales(...)` IS the request's translation order; indexed error paths resolve through the reused-unchanged `dashboard-translation-errors` helpers against that order — Arabic-only payloads put Arabic at index 0. |
| Media boundary | This layer stores ids only: no resolution, no fetch, no kind enforcement (API/instrument + picker behavior). |

### Gates (committed tree at `0f013d4`; hook's eslint --fix verified NOT to perturb bytes)

| Gate | Result |
| --- | --- |
| Focused form/payload suite | **39/39 passed, exit 0** |
| `dashboard-translation-errors.spec.ts` (compatibility check, unmodified) | **6/6 exit 0** |
| `locale-parity` gate | **5/5 exit 0** |
| `npm run typecheck` (full) | **exit 0** |
| `eslint` on all changed files | **exit 0** |

Negative controls A–F, each ONE behavioral mutation → targeted vitest run FAILS naming its test →
byte-identical restore, sha256 `079f06f4…` verified after EVERY restore (equals the committed blob):

| Control | Injected defect | Test(s) that FAILED |
| --- | --- | --- |
| A | unchanged form emits `{ translations: [] }` | "a completely unchanged form returns NULL" |
| B | held-then-cleared text omitted instead of null | all THREE per-field clear tests |
| C | blank current emits null even when baseline blank | all THREE initially-null preservation tests |
| D | cleared ogImageId omitted instead of null | "HELD id CLEARED → explicit null travels" |
| E | sent order forced to canonical `[en, ar]` | Arabic-only index-0 mapping test (both-locales test passes — the documented canonical-order trap exactly) |
| F | OD-14-style one-authored-locale guard added to the schema | both all-null/final-clear validity tests |

One authoring correction recorded for honesty: the first draft of the canonicalUrl
"initially-null" test asserted against a seed where the value was HELD (omission means the key is
ABSENT from the entry, not present-with-value); rewritten against a genuinely null baseline before
any control ran.

### Standing state carried forward

- **Dynamic RBAC management UI remains POST-V1** (OD-2).
- **Users/Roles list-schema contract defect**: still armed, backend-handoff-owned, non-blocking.
- **Related-articles OD-7 remains UNRESOLVED.**

**Next unit: FE4-U1c — the Static Page SEO Dashboard route/surface architecture** (collection of the
seven pages + per-page editor consuming this module and the U1a instrument; new lane registration;
route measurement → batched cap decision at closure). Nothing pushed or deployed; campaign tree
clean after each docs-only commit.

### FE4-U1b.1 — canonicalUrl client validation parity correction · checkpoint 2026-08-24

Implementation commit **`8a48709`**: U1b had narrowed client-side canonicalUrl validation to
HTTP(S)-only **without contract evidence — corrected (CASE B)**. Evidence, all read live:

| Source | Finding |
| --- | --- |
| `openapi/openapi.json` | every `canonicalUrl` (Page SEO, Article, Project) is plain `format: uri`, nullable — NO scheme restriction, no pattern, no scheme enum anywhere |
| API repo source (`src/modules/seo/dto/page-seo.dto.ts`) | runtime validation is class-validator `@IsUrl({ require_protocol: true })` |
| API's own pinned dependency (`validator@13.15.35`, executed) | ACCEPTS absolute `http/https/ftp` URLs with a host (`ftp://eslammuatamed.com/resource` → true); REJECTS relative refs, protocol-relative forms and non-hierarchical schemes (`mailto:`, `urn:` → false); TLD-bearing host required |

So an HTTP/HTTPS-only check narrowed the contract without evidence AND diverged from the real
acceptance set. Correction: `isValidCanonicalUrl` now accepts absolute http/https/ftp URLs with a
host via WHATWG parse; residual server strictness (`require_tld`: `http://localhost/...` is 422)
is documented as deliberately LENIENT-side divergence — the form never blocks a value the API would
accept. Discriminating non-HTTP fixture added (`ftp://…` accepted end-to-end through schema +
payload layer); mailto/urn pinned rejected; i18n message updated in BOTH locales.

All other U1b semantics byte-unchanged: nullable/clear/no-op payload behavior, no OD-14 guard,
sent-order error mapping, pageKey-as-path-identity. Gates on the committed tree: focused suite
**41/41 exit 0** (+ translation-errors compatibility 6/6), full `typecheck` exit 0, lint exit 0.
Negative control: temporarily restoring the http/s-only narrowing FAILED both ftp-parity tests;
restored byte-identically (post-commit sha256 `2abad834…` verified). Nothing pushed or deployed.
**FE4-U1c remains next.**

---

## FE4-U1c — the Static Page SEO READ-ONLY destination · checkpoint 2026-08-24

Implementation commit **`ff74a98`**: `app/pages/dashboard/seo/index.vue` +
`index.spec.ts`, `app/composables/useAdminPageSeo.ts`, the System-group nav entry, and EN/AR copy.
**READ ONLY — zero write affordances:** no save/edit/picker/input/PATCH anywhere on the surface;
a structural source-scan test plus a request-capture test (every issued call is `GET
/admin/seo/pages`) pin that. Negative control E proved the scan discriminates an injected PATCH.

| Fact | State |
| --- | --- |
| Route | ONE destination `/dashboard/seo` — no `[pageKey]`/detail routes; seven fixed singleton pages |
| Vocabulary | Closed seven-key set pinned as `PAGE_SEO_PAGE_ORDER`: home, about, experience, projects, blog, resume, contact — in explicit PRODUCT presentation order |
| Read source | ONE `GET /admin/seo/pages` populates the ENTIRE surface; rows carry every locale, so ZERO detail GETs and ZERO public-endpoint calls (both asserted at request level) |
| Order | The list contract promises NO ordering → server array position is ignored; rendering walks the product constant and looks rows up BY KEY; scrambled-server-array test proves it (control A discriminates) |
| Selection | Local UI state: `home` BY NAME first; survives background refresh with data replaced underneath; deterministic home fallback if the selected key ever disappears (effectiveKey derivation keeps the fallback VISIBLE on the selector) |
| Request state | Established §14.9 contract via existing `useRequestState`/`UiRequestState` — skeleton initial / error+retry / explicit empty / forbidden own-state / stale-refresh notice while usable data stays visible; restrained updating only (control C discriminates a full-surface skeleton) |
| Direction | Per-locale content direction on values; canonical URLs pinned `dir="ltr"` under Arabic chrome (control D discriminates) |
| Nulls | Explicit localized "Not set — the site default applies"; ogImageId rendered as raw id, NO media resolution or fetching |
| Nav | ONE `seo` entry in System group (`dashboard.nav.seo` EN/AR); spec pins its existence AND the absence of any users/roles/permissions destination |

Gates on the committed tree: page suite **18/18**, nav **15/15**, form 41/41 + parity 5/5 +
Taxonomy regression 7/7 (combined run **86/86** pre-commit, **38/38** post-commit re-run);
`typecheck` exit 0; lint exit 0. Controls A–E each failed exactly their targeted test under one
behavioral mutation; page sha256 `044b13ca…` and composable sha256 `9a138ec3…` verified identical
after every restore and equal to the committed blobs.

### Deliberate governance/lane state

- **`/dashboard/seo` is intentionally UNGOVERNED**: `DASHBOARD_ROUTES` is an explicit list, the new
  route was NOT added, no cap derived or registered, `route-assets.mjs` untouched — measurement and
  the batched cap decision happen after U1d/U1e complete the EDITABLE surface, so no temporary
  read-only intermediate route gets governed.
- **No browser lane registered**; the U1a server remains unregistered contract infrastructure.
  **Declared lane count remains 15.**
- Standing: Dynamic RBAC UI deferred post-v1 (OD-2); Users/Roles envelope handoff non-blocking;
  OD-7 related-articles unresolved.

**Next unit: FE4-U1d — the editable Static Page SEO form + PATCH wiring**, consuming U1b's
form/payload module and the U1a instrument, then lane registration + measurement at closure.
Nothing pushed or deployed; campaign tree clean after each docs-only commit.

---

## FE4-U1d — the Static Page SEO EDITOR · checkpoint 2026-08-24

Implementation commit **`6f3b4c5`**: NEW `app/components/dashboard/PageSeoEditor.vue` (the
thin-wrapper pattern — pages route, editors own their UForm), `useAdminPageSeo.ts` gains exactly
ONE mutation, the page slims to collection + request-state + selection/protection, EN/AR editor
copy added. **FR-DSH-051's Dashboard editing behavior is COMPLETE.**

| Fact | State |
| --- | --- |
| Edit source | The LIST ROW, exclusively. Zero detail GETs on any path (request-level + structural pins); switching pages costs ZERO requests |
| Mutation | ONE PATCH per singleton page via the composable; pageKey in the REQUEST PATH only — never in a body; no create/delete/detail |
| Re-seed | The AUTHORITATIVE PATCH response replaces the row (`replaceRow`) and re-seeds the editor clean — no refetch; selected page AND active locale survive a save |
| Payloads | U1b builder unchanged: changed locales only (Arabic may be index 0), omission preserves, held-clear sends explicit null, ogImage pick/clear per D10-23, `null` sentinel → ZERO requests, `translations: []` unreachable |
| Optional data | NO OD-14 rule anywhere: all-null valid, single-field valid, final-override clear PATCHes nulls |
| 422 mapping | Indexed paths resolve against the ACTUAL SENT order onto field + tab; dirty edits survive; client Zod failures re-enter the SAME machinery through indexed canonical paths (SeoPanel fields carry no UForm names by design — entity-blind panel) |
| Non-validation failures | Action-level localized error, focus-managed, usable editor intact — never the full-page state |
| Unsaved protection | Dirty page-switch asks (cancel keeps edits / confirm discards); route-leave via shared guard inside the editor; background refresh NEVER overwrites a dirty/saving editor while clean ones rehydrate from refreshed rows |
| U1c regression | Skeleton/error+retry/forbidden/empty/stale-refresh/product-order/selection-by-key all re-pinned in the refit spec |

Gates on the committed tree (hook's eslint --fix reformatted the two new files at commit time —
gates RE-RUN on the committed tree rather than assumed): page/editor suite **37/37 exit 0**;
combined focused run with form suite + nav + SeoPanel + parity **114/114** pre-commit;
`typecheck` exit 0; lint exit 0.

Negative controls A–F, each ONE behavioral mutation → targeted test FAILS → byte-identical
restore (pre-commit working-tree SHAs verified: editor `9ca273fc…`, page `77fcd37c…`, form
`2abad834…`; post-commit reformatted blobs are the hook's eslint --fix output and pass every gate):

| Control | Injected defect | Test that FAILED |
| --- | --- | --- |
| A | unchanged save emits `{ translations: [] }` | "an UNCHANGED form produces ZERO PATCH requests" |
| B | 422 indexes resolved against canonical [en, ar] | "an ARABIC-ONLY sent payload maps translations[0] onto the ARABIC field" |
| C | dirty page-switch protection removed | "DIRTY + CANCEL stays on the current page" |
| D | dirty-editor guard dropped from row watcher | "a DIRTY selected page is NOT overwritten" |
| E | held clear → omission (U1b builder) | "a HELD nullable TEXT field cleared travels as explicit null" |
| F | selection-triggered detail GET | clean-switch test strengthened with zero-detail assertion, then FAILED |

Two authoring findings recorded: (1) mounting UForm directly inside the PAGE broke submit wiring
mysteriously — extracting the editor component per the established thin-wrapper pattern fixed it,
which is the architecture precedent confirming itself; (2) the mock initially parsed `init.body`
before recording, crashing on object bodies — mocks must accept both shapes so caller honesty is
tested, not serialization assumptions.

### Deliberate governance/lane state

- **`/dashboard/seo` remains intentionally UNGOVERNED** — measured + batched cap AFTER browser
  proof (U1e); governance files untouched this unit.
- **No browser lane registered**; U1a server remains contract infrastructure. **Lane count: 15.**
- Standing: Dynamic RBAC UI deferred post-v1 (OD-2); Users/Roles envelope handoff non-blocking;
  OD-7 related-articles unresolved.

**Next unit: FE4-U1e — the Page SEO browser lane + runtime proof** (register the lane against the
U1a server; real Nitro/HTTP save round-trip, 422 locale mapping, dirty switching, IMAGE picker,
380px, axe, request states), then route measurement + batched cap decision at closure. Nothing
pushed or deployed; campaign tree clean after each docs-only commit.

---

## FE4-U1e — the `dashboard-seo` BROWSER LANE · checkpoint 2026-08-24

Implementation commit **`2262125`**: `e2e/dashboard-seo/{harness.ts, page-seo.spec.ts}` (ONE spec
file — mutable-lane invariant), `lanes.ts` record **#16** (`CI_SEO_PORT 4600 / CI_SEO_MOCK_PORT
4601`, resetsBackendState), `ci-preview.mjs` backend entry, isolation-spec pin updated 15→16 with
the reason recorded. Server extensions are NARROW and ADDITIVE; every U1a contract behavior
untouched and **U1a instrument re-run green (56/56)** after modification:

| Server addition | Purpose |
| --- | --- |
| Minimal `/admin/media` list+resolve reads | the shared OG picker's browse/resolve vocabulary so it functions in the lane (same accommodation as Testimonials); NO upload/delete |
| ONE-SHOT `nextPatch422` control | deterministic Arabic-first 422 at `translations[0].canonicalUrl`; cleared by reset |

### Runtime proof — official lane: **38 passed / 0 failed, exit 0**, exactly ONE preview/backend pair

Real Nitro preview + real browser + real HTTP to the fixture backend. Highlights of what only this
lane could prove:

- **One-list architecture on the wire**: initial load = exactly one `GET /admin/seo/pages`; ZERO
  detail-shaped requests across selection, editing, saving, refreshing; selection costs zero
  API calls; zero public-endpoint (`/api/v1/seo/pages/*`) requests across the whole flow.
- **D10-23 ON THE WIRE** (captured PATCH bodies): unchanged save → ZERO PATCH; EN-only /
  AR-only entries (Arabic at sent index 0); held-clear → explicit `"metaDescription": null`;
  initially-null untouched keys ABSENT; ogImage pick → id, clear → null; `translations: []`
  never serialized; pageKey never in a body.
- **Sent-order 422**: injected `translations[0].canonicalUrl` against an AR-only payload lands
  on the ARABIC field + Arabic tab-invalid badge with edits intact; general failure (500 via
  `failNextWrite`) shows the action-level error without replacing the editor.
- **Dirty protection in both directions**: cancel keeps page+edits; confirm discards into the
  destination row; background refresh never overwrites a dirty editor while a CLEAN editor
  rehydrates from a server-side mutated row (control-plane `pages` override).
- **OG picker**: dialog opens, PDF fixture absent from IMAGE-restricted grid, picked id reaches
  PATCH, stored reference resolves through `/admin/media/:id`, clear emits null.
- **Unfiltered axe** (no rules disabled): settled EN, settled AR cold boot, held loading, error
  state, open OG-picker dialog — all clean.
- **380px EN+AR**: horizontal overflow ≤1px, selector/tabs/save/picker usable, canonical input
  pinned LTR under RTL chrome. Cold boot: EN `dir=ltr`, AR `dir=rtl` on the unprefixed route.

Negative controls A–G, each REBUILT (`npm run build` freshness verified against source mtime)
then targeted browser run FAILED for the intended reason, then restored byte-identically:

| Control | Mutation | Failing test |
| --- | --- | --- |
| A | detail GET on selection | "selecting another page renders its values and issues ZERO additional requests" |
| B | held clear → omission (U1b builder) | "a HELD text field cleared reaches the wire as explicit null" |
| C | 422 indexes vs canonical [en, ar] | "an ARABIC-ONLY sent payload maps translations[0] onto the ARABIC field" |
| D | dirty-switch protection removed | "cancel keeps the current page" |
| E | refresh reinitializes dirty form | "a background refresh does NOT overwrite a dirty form" |
| F | canonical dir=ltr removed (SeoPanel) | both "canonical input stays LTR" tests |
| G | no-op save → `{ translations: [] }` | "an UNCHANGED form produces ZERO PATCH requests" |

Restorations verified: editor/page/form blobs equal their HEAD SHAs (`0342e0eb…`, `4cf3a8b6…`,
`2abad834…`); SeoPanel byte-identical to HEAD (git diff empty). Post-commit, the tree was REBUILT
from the committed state and the focused lane re-run green (38/38 exit 0) per the D20-40
committed-tree lesson.

Two authoring findings kept: (1) the harness initially demanded an `input` DESCENDANT of
`[data-seo-field]` — the attr lands directly ON the control element (UInput→input,
UTextarea→textarea), which is why every input-touching test failed until fixed; (2) mid-test
`clearCookies()` kills the auth session — locale cold-boot tests must re-sign-in after planting
the cookie.

### Deliberate governance/lane state

- **`/dashboard/seo` remains intentionally UNGOVERNED** — no measurement, no baseline, no cap;
  governance files untouched. Measurement belongs to **FE4-U1f** (route measurement/governance +
  Static Page SEO Dashboard closure).
- **Declared lane count: 16.** Default 4-shard strategy, R14 closure, R15 status and CI untouched.
- Standing: Dynamic RBAC UI deferred post-v1 (OD-2); Users/Roles envelope handoff non-blocking;
  OD-7 related-articles unresolved. **Public SEO consumption NOT started — that is FE4-U2.**

**Next unit: FE4-U1f — route measurement/governance + Static Page SEO Dashboard closure.**
Nothing pushed or deployed; campaign tree clean after each docs-only commit.

## FE4-U1g — Static Page SEO DASHBOARD EDITING CLOSED — 2026-08-25

### Route governance: `/dashboard/seo` registered under D20-41

The owner approved ONE route-specific budget for the ONE Static Page SEO route, derived by D20-29's
formula from the authoritative U1f completed-route baseline on the clean stamped analysis build at
Web `a38a70c7f63db6002a9244ddfedda8926e4362f6`:

| Input | Value |
| --- | --- |
| app-owned baseline | **109,003 B** (65 closure assets, unclassified 0 B) |
| cap | ceil((109,003 × 115) ÷ 102,400) × 1024 = **125,952 B (123 KiB)** |
| headroom | **16,949 B** |
| total route JS | 307,806 B gz (300.6 KB) — **D20-24 WARN**, warn-only |
| public CSS | 28,736 B gz (28.1 KB) vs 30 KB hard cap — **PASS** |

Registration touched exactly the four established governance locations:
`DASHBOARD_ROUTES` (+ page module `app/pages/dashboard/seo/index.vue`),
`DASHBOARD_APP_OWNED_BASELINE_BYTES`, `DASHBOARD_APP_OWNED_BASELINE_PROVENANCE`
(→ `a38a70c7…`), `DASHBOARD_APP_OWNED_CAP_BYTES`. Web governance commit `a02c7c1`;
Doc 20 decision recorded as **D20-41** on the local Docs campaign branch (`a412f36`), local-only.

**Governance-invisibility finding (U1f), disposition:** before registration `size:routes` exited 0
while the completed route existed but was absent from the registered inventory — invisible rather
than reported ungoverned (unlike Skills M2·U2 / Testimonials T·U2 / Taxonomy U2, which registered
measured-but-ungoverned first and failed loudly). U1g adds focused tests pinning `/dashboard/seo`
into BOTH inventory sides with exact baseline/cap bytes and proving removal from either side fails;
a general filesystem-vs-governance completeness assertion over `app/pages/dashboard/**` is RECORDED
as a future governance finding and deliberately not built in this unit.

### Authoritative verify (reproduced on the governance build)

Fresh clean `ANALYZE_BUNDLE=1 NUXT_PUBLIC_SITE_URL=https://example.com npm run build` at governance
HEAD `a02c7c1`: exit 0 (direct-captured, no wrapper masking), `.output` present (1,667 files),
provenance stamp = exact HEAD. `size:routes` exit **0**: `/dashboard/seo` measured **109,003 B ≤
125,952 B PASS** — byte-identical to the approved baseline (zero drift); incremental Δ floor
44,309 B of 86,016 B (51.5 %); floors unchanged and inside caps (public 256,378/263,168; dashboard
263,497/268,288). The gate now prints the route's own D20-24 attribution block (route-owned product
code + shared framework/chrome; zod is dashboard-only; isolation INTACT across 14 dashboard-owned
modules) among **15** warn-only warnings. Focused governance suites: route-assets +
dashboard-closure specs **181/181 pass**.

### Completed evidence chain (Static Page SEO Dashboard editing)

Seven static page keys exactly — `home, about, experience, projects, blog, resume, contact`
(`PAGE_SEO_PAGE_ORDER`, explicit frontend presentation order). ONE `/dashboard/seo` route; ONE
admin-list read source (`GET /admin/seo/pages`); ZERO detail GET dependency — selection costs no
request. Request-state contract per U1b/U1b.1: optional/all-null SEO valid; omission preserves;
held-clear sends explicit null; `translations: []` never serialized; pageKey never in a body; FTP
canonical parity between editor validation and API contract; sent-order 422 mapping against the real
payload order; dirty page-switch protection and dirty-refresh protection; OG picker restricted to
IMAGE media with clear-to-null. Shared `TranslationTabs` + `DashboardSeoPanel` reused. Runtime proof
from U1e stands: one official `dashboard-seo` browser lane, 38/38 exit 0, one focused preview/backend
pair, unfiltered axe clean across EN/AR/loading/error/picker, 380px EN/AR within 1px overflow,
public-endpoint isolation (zero `/api/v1/seo/pages/*` requests).

**Static Page SEO DASHBOARD EDITING: COMPLETE.**

### Deliberate boundary — FE4-U2 remains OPEN

Completed here: FR-DSH-051 operator editing/persistence surface (plus its governance). Still open,
NOT started: public consumption of `/seo/pages/{pageKey}`; static SEO override rendered into the
public `<head>`; FR-DSH-052 (`googleSiteVerification`, `bingSiteVerification`, `analyticsEnabled`,
`gtmContainerId`, `customMetas`) and corresponding public head/tag rendering.

Declared lane count: **16** (unchanged). Nothing pushed or deployed.

## FE4-U2b — effective Static Page SEO metadata resolver COMPLETE — 2026-08-25

Implementation commit `b070bcc`: `app/utils/page-seo-metadata.ts` (+ spec), the smallest PURE layer
between the public `GET /seo/pages/{pageKey}` payload and the later U2c route wiring. No fetching, no
route knowledge, no `useHead`/`useSeoMeta`, no locale logic, no structured data — boundary tests scan
comment-stripped source for banned identifiers.

**OWNER RULING (recorded verbatim):** `PageSeo.canonicalUrl remains storage/editing-only in Frontend
v1. @nuxtjs/i18n strictSeo remains the sole rendered canonical/hreflang owner.` The resolver never
reads the field; the structural input type omits it yet admits the whole generated entity, and tests
prove null vs `https://example.com/custom` vs `ftp://example.com/resource` produce byte-identical
output with no canonical key of any name. No second canonical writer exists; D22-7/D22-8 untouched.

- **Precedence** (doc 22 §3 F-D4 over current tiers): authored Page SEO → page-localized i18n →
  localized Settings default → committed floor; title/description resolved independently;
  blank/whitespace overrides never mask a lower tier (`isBlank`/`pickMeta` semantics reused).
- **Page SEO absent/fetch-failed** → identical to no override; complete chain intact (models U2c's
  silent-failure policy; HTTP concerns live in U2c).
- **OG/Twitter**: one text pair by design — contract has no og/twitter copy fields; output exposes
  exactly `title` + `description` (+ optional image) for the wiring to fan out.
- **Image**: override produced ONLY through the existing `entitySocialImage` helper (format gate +
  absolute-URL + all-or-nothing tags); null/unsupported/unusable descriptors yield NO override so
  `app.vue`'s committed card floor keeps ownership; WebP gate behavior unchanged.
- **Home/D22-4**: title returns verbatim — `titleTemplate: null` stays the Home caller's job.
- **Structured data**: unaffected; no JSON-LD surface.

Verification: focused suite **29/29** (title/description chains 1–12, absence 13, single-source 14–15,
image 16–19, canonical storage-only 20–23, Home 24, locale isolation 25, boundary 26–28+); neighbor
reuse suites green (metadata/entity-social-image area — 56/56 across the three files); `typecheck`
exit **0**; eslint exit **0**. Negative controls A–F each executed, failed for the intended reason,
and were restored byte-identically (SHA-256 `27a4f87b…` before = after): A precedence swap → test 1;
B blank-as-override → test 3; C Settings-over-page reorder → test 4; D null-wipes-metadata → test 13;
E canonical leak into output → tests 20–22/23; F format-gate bypass → test 18.

Still open: GTM script/noscript/placement + CSP(D19-4) posture decisions (U2e); verification meta
`name=` pin (U2d); Dynamic RBAC UI deferred post-v1 (OD-2); OD-7 Related Articles unresolved.
No public page modified; no fetch/head wiring created; budgets untouched.

**Next unit: FE4-U2c — per-route PageSeo fetch + static-page SSR head wiring.**
Nothing pushed or deployed; campaign tree clean after this docs-only commit.

## FE4-U2c1 — public PageSeo READ layer COMPLETE — 2026-08-25

Implementation commit `a9aaefb`: `app/composables/usePublicPageSeo.ts` (+ spec, 25 tests) — the
smallest reusable public read the seven static pages will `await` during SSR (U2c2 wires pages).

- **Public endpoint only**: `GET /seo/pages/{pageKey}` through the existing `useApi()` door; admin
  SEO surfaces unreachable and asserted absent. **Closed vocabulary** derived from the generated
  contract (`PublicPageSeoEntity['pageKey']` — exactly home/about/experience/projects/blog/resume/
  contact); arbitrary keys are unrepresentable at the type level (pinned by a two-sided
  `@ts-expect-error` under `typecheck`).
- **Locale**: route-resolved (D06-6 `useRouteLocale()`), passed EXPLICITLY so `useApi` injects
  exactly one `?locale=` — no browser detection, no EN↔AR fallback; the requested locale's response
  is authoritative.
- **SSR-awaited**: caller pattern `await usePublicPageSeo(key)`; no `lazy`, no `server: false`, no
  client-only first read (Settings-read convention).
- **Identity = page key + locale**: reactive key `seo:page:{pageKey}:{locale}`. MEASURED finding:
  Nuxt renames the payload entry on reactive-key change (`…:en` → `…:ar`) and refetches WITHOUT an
  explicit `watch: [locale]`; adding watch on top caused TWO identical requests per switch.
  Deliberately watch-free — unlike the persistent layout's WD-6 footer case, page-scoped reads
  remount on the `/en ↔ /ar` navigation anyway.
- **Success/failure**: known all-null page stays a successful entity (falls through field-by-field
  in U2b); unexpected 404/5xx/network land in `error` with `data === null` — silent fall-through to
  baseline metadata; `retry: 0` (zero retries, no retry UX); never `createError`/`showError`.
- **Isolation/boundary**: no Settings read (`/settings/site` untouched); NO head ownership of any
  kind — no useHead/useSeoMeta/canonical/OG/Twitter/verification/GTM/JSON-LD tokens in executable
  source (comment-stripped scans). canonicalUrl may arrive as contract payload; storage-only per
  the standing owner ruling — never validated/filtered/published here.

Verification: focused suite **25/25**; neighbor suites green (31/31 across useSiteSettings +
settings-request); `typecheck` exit **0**; eslint exit **0**. Negative controls A–F each executed,
failed for the intended reason, restored byte-identically (SHA-256 `0d35ed35…` before = after):
A locale dropped from identity → t11; B pageKey dropped → t10; C locale frozen at setup → t14;
D admin endpoint → t4; E raw-promise exposure making failure fatal through the awaited setup →
t19 ×3; F default retry restored → t22 ×3.

Still open: U2d verification/customMetas rendering (+ meta-name pin); GTM script/noscript/placement
+ CSP(D19-4) decisions pending before U2e; Dynamic RBAC UI deferred (OD-2); OD-7 unresolved.
No public page modified; no head wiring created; budgets untouched; no new browser lane registered.

**Next unit: FE4-U2c2 — wire PageSeo effective metadata into the seven static public pages.**
Nothing pushed or deployed; campaign tree clean after this docs-only commit.

## FE4-U2c2a — reference Static Page SEO consumers COMPLETE (Home + About) — 2026-08-25

Implementation commit `4e37fc1`: `app/pages/index.vue` (key `home`) and `app/pages/about.vue`
(key `about`) now await `usePublicPageSeo(...)` during setup and resolve effective metadata through
`resolvePageSeoMetadata` before registering their own `useSeoMeta` — the proven three-layer boundary
(network = U2c1 composable, resolution = U2b resolver, rendering = the page).

- **Precedence live**: authored override → page i18n → Settings defaults → committed floor; title
  and description independent; blank/null fall through by resolver semantics (no duplicate logic in
  pages).
- **Home**: `titleTemplate: null` preserved exactly; the authored title arrives verbatim, never
  brand-suffixed; twitter/og pairs travel with the same effective values.
- **About**: the old local `${title} — brand` OG composition is REPLACED by the single effective
  pair — normal/OG/Twitter can no longer disagree (the coherence rule this unit pins).
- **Social image**: an accepted descriptor becomes a page-level override through the existing
  compatibility helper (absolute URL, width/height/alt together); null/unsupported registers NO
  image keys so `app.vue`'s committed card floor stays effective; OG/Twitter image never diverge.
- **Canonical**: storage-only ruling upheld at the consumer level — neither page reads canonicalUrl;
  structural scans + runtime captures prove no canonical link writer exists; strictSeo remains sole
  owner.
- **Structured data**: Home Site-schema and About Profile-schema calls keep their original input
  handles (asserted by identity), unaffected by overrides.
- **Request model**: `/settings/site` still ONE shared read across layout+pages (About now consumes
  the shared state instead of adding a request — asserted: two page mounts, exactly one settings
  call); each page adds exactly its own `/seo/pages/{key}` read. No admin endpoints.
- **Failure/all-null**: 404/500/network leave baseline metadata intact and the page rendered;
  all-null behaves identically to no override.

Focused suite `page-seo-wiring.spec.ts` **27/27**; combined relevant sweep **118/118** (resolver,
read composable, about page matrix, metadata utils); `typecheck` exit **0**; eslint exit **0**.
Negative controls A–F executed targeted, failed for the intended reason, restored byte-identically
(SHA-256 before=after: index `848c606e…`, about `f6b04a1a…`): A wrong key → t1; B un-awaited read →
t2; C override ignored → t12; D PageSeo canonical link writer → t18; E Twitter title divergence →
t12; F failure blanks description → t17.

**Still unwired (FE4-U2c2b)**: experience · projects · blog · resume · contact — mechanical
repetition of this exact pattern. Verification/customMetas deferred to U2d; GTM script/noscript +
CSP(D19-4) decisions pending before U2e; Dynamic RBAC UI deferred (OD-2); OD-7 unresolved.
No route-budget changes; no new browser lane; nothing pushed or deployed.

**Next unit: FE4-U2c2b — wire the remaining five static pages mechanically using the proven pattern.**
Campaign tree clean after this docs-only commit.

## FE4-U2c2b — remaining five static pages wired; PUBLIC TEXT/SOCIAL CONSUMPTION IMPLEMENTED — 2026-08-25

Implementation commit `4b410c3`. The proven Home/About pattern applied mechanically to Experience,
Projects (collection), Blog (collection), Resume, Contact. **All seven static public pages now
consume PageSeo** with the exact route → key mapping:

| Route(s) | PageSeo key |
| --- | --- |
| `/`, `/ar` | home |
| `/about`, `/ar/about` | about |
| `/experience`, `/ar/experience` | experience |
| `/projects`, `/ar/projects` | projects |
| `/blog`, `/ar/blog` | blog |
| `/resume`, `/ar/resume` | resume |
| `/contact`, `/ar/contact` | contact |

Every page: awaited `usePublicPageSeo(key)` BEFORE `useSeoMeta`; effective chain override → i18n →
Settings defaults → committed floor via the U2b resolver (title/description independent, blank/null
falls through); ONE text pair drives normal+OG+Twitter (Experience/Projects/Blog/Contact normalized
from their old local `${title} — brand` OG composition; Resume's hand-written Twitter pair replaced
by the same effective pair); image override only when the resolver accepts the descriptor, otherwise
no image keys registered and the committed card floor stays effective.

- **Canonical**: storage-only everywhere — structural scans + runtime captures prove zero canonical
  writers on all seven pages; strictSeo remains sole canonical/hreflang owner.
- **Structured data**: Experience BreadcrumbList, Projects collection BreadcrumbList, Resume and
  Contact schema calls keep their original inputs; no PageSeo field reaches JSON-LD (t37).
- **Article/project detail pages untouched** — entity-level SEO intact.
- **Settings**: single shared read still serves everything — five new mounts + Home/About produce
  exactly ONE `/settings/site` request (shared payload key); each page adds only its own
  `/seo/pages/{key}` read; zero admin SEO calls.
- **Failures**: per-page 404/500 fall through silently to baseline metadata, page renders, zero
  retries (composable-owned).

Verification: wiring spec extended to **69 tests, 69/69** (five-page blocks + shared guarantees +
Home/About reference blocks re-run green); combined sweep **271/271** across 9 files including the
pre-existing Experience/Resume/Contact page matrices (Contact's full 78-test form/validation matrix
green with the awaited read in place). `typecheck` exit **0**; eslint exit **0**. Negative controls
A–F executed targeted, failed for intended reason, restored byte-identically (SHA-256 verified per
file): A wrong key on Experience → key test; B un-awaited read on Projects → t31 structural scan;
C old OG composition retained on Blog → coherence test; D PageSeo canonical link writer on Resume →
canonical-owner test; E failure blanks description on Contact → fallback-survival test; F PageSeo
text injected into Experience schema → t37 isolation test. (Process note recorded honestly: a
backup-filename collision during control C's first attempt briefly restored PROJECTS content into
blog/index.vue; detected by grep verification, recovered deterministically from git HEAD + re-applied
wiring, backups rebuilt with unique names before any further control ran.)

**Static Page SEO PUBLIC TEXT/SOCIAL CONSUMPTION: IMPLEMENTED across all seven static pages.**
Still NOT complete: verification metas (U2d), customMetas (U2d), GTM + CSP/GTM decision (U2e),
final public performance/browser closure (U2f). No route-budget changes; batched measurement owed
post-wiring; no new browser lane; nothing pushed or deployed.

**Next unit: FE4-U2d — global verification + customMetas rendering in the public layout.**

## FE4-U2d1 — pure public Settings meta projection COMPLETE (verification + customMetas) — 2026-08-25

Implementation commit `4866780`: `app/utils/public-settings-metas.ts` +
`public-settings-metas.spec.ts`. The smallest PURE projection layer between the public
`GET /settings/site` payload and the later head wiring — it owns ONLY `googleSiteVerification`,
`bingSiteVerification`, `customMetas`; no rendering, no Nuxt head APIs, no Settings fetching, no
PageSeo/title/description/canonical/OG/Twitter/JSON-LD, no layout wiring yet.

- **Vendor-name pin (OWNER APPROVED)**: rendered HTML names are the vendors' own documented values
  — Google **`google-site-verification`**, Bing **`msvalidate.01`** — exported as constants,
  verified against vendor docs. No aliases; the rejected `bing-site-verification` is proven never
  emitted (t11).
- **Verification semantics**: null/undefined/empty/whitespace-only tokens emit NOTHING; present
  tokens are outer-trimmed with internal characters/case untouched (`pickMeta`, house blank
  convention).
- **customMetas**: pass through VERBATIM — name/content only, exact API order preserved, no sort,
  no application deduplication (duplicate names stay independent entries), no reserved-name
  collision policy invented (collisions with Google/Bing names preserved). The contract types both
  fields as REQUIRED non-null strings, so no stricter client validation was invented.
- **Order pinned**: Google → Bing → customMetas verbatim.
- **Security boundary**: output type can express only `{name, content}` attribute pairs;
  descriptors are constructed fresh so hostile extra runtime fields (property/http-equiv/
  innerHTML/handlers) cannot leak; no script/raw-HTML capability exists; framework head rendering
  owns escaping.
- **GTM explicitly excluded**: `gtmContainerId`/`analyticsEnabled` outside input type, zero effect
  on output (proven); GTM stays blocked on the CSP/runtime decision.

Verification: focused suite **33/33** (t1–t32 + totality/purity/pin guards); related metadata
suites green (52/52 across metadata + page-seo-metadata); `typecheck` exit **0**; eslint exit **0**
(plus lint-staged clean at commit). Negative controls A–F each executed targeted, failed for the
intended reason, restored byte-identically (SHA-256 `362cdd32…` before = after): A Bing name →
alias → t6 failed on expected `msvalidate.01`; B blank Google token emitted → t5 failed; C
customMetas sorted → t15 failed on order; D duplicate names deduped → t16 failed; E http-equiv
added to descriptor shape → t23/t24 failed on key set; F gtmContainerId projected → t27 failed.

Still open: U2d2 renders this output from the existing public-layout Settings state (must not let
unhead erase same-name descriptors); GTM/CSP decision pending before U2e; PageSeo canonical stays
storage-only; Dynamic RBAC UI deferred (OD-2); OD-7 unresolved. No layout/public page modified; no
head wiring created; route budgets untouched; no new browser lane; nothing pushed or deployed.

**Next unit: FE4-U2d2 — render verification + customMetas from the existing public-layout Settings
state and prove SSR/public-only behavior.**
Campaign tree clean after this docs-only commit.

## FE4-U2d2 — public verification/customMetas RENDERING from the public layout COMPLETE — 2026-08-25

Implementation commit `eff3e57`: `app/layouts/default.vue` (+32 lines) + three focused suites
(`default.spec.ts` 15, `default.outage.spec.ts` 3, `layout-isolation.spec.ts` 5 — **23 focused
tests**). Ownership: the PUBLIC default layout ONLY, reading the SAME awaited `useSiteSettings()`
state it already holds — zero additional `/settings/site` requests (proven at unit level: one
shared read serves layout + footer per mount).

- **Rendered names**: Google `google-site-verification`, Bing `msvalidate.01` verbatim from U2d1's
  projection; customMetas name/content only, exact API order, no dedupe/sort/filter/reserved-name
  policy in application code.
- **INSTALLED HEAD MANAGER BEHAVIOR (measured, not assumed)**: unhead@3.3.2 (`dedupeKey()` in
  `unhead/dist/shared`) keys `<meta>` under `meta:<name>` unless a per-tag `key` extends it — plain
  `{name, content}` same-name entries COLLAPSE to the last writer (probe-proven). `key` is a
  recognized TagConfigKeys entry: lifted off props (never rendered as an attribute) and appended to
  the dedupe key.
- **Identity mechanism used**: per-descriptor `key: public-settings-${index}` — deterministic,
  derived from projection position, preserves duplicates rather than deriving identity from name
  alone. Verified against FINAL SSR output (`renderSSRHead` from the installed renderer on the real
  Nuxt head instance), not helper output and not a useHead mock.
- **Upstream-unkeyable names recorded honestly**: upstream deliberately ignores `key` for names
  matching /^(?:viewport|description|keywords|robots)$/ and any name containing ":" (identity stays
  `meta:<name>`), so independent coexistence of BOTH entries is impossible there without raw-head
  bypasses — NOT silently resolved by this unit. Mitigation: numeric `tagPriority: 200` REPLACES
  the computed weight outright under capoTagWeight, and the LOWEST weight wins same-key collisions,
  so such descriptors rank below every app-owned writer (default ≈100, title 10, viewport −15) and
  YIELD instead of hijacking, regardless of registration order; uncontested names render exactly as
  projected. OWNER DECISION queued if operator-grade preservation of owned-name customs is ever
  required.
- **SSR-first**: tags resolve in initial head state via the awaited read — getter-driven
  reactivity only (no mounted hook, no DOM access, no observer); locale-switch test proves the
  shared-state change replaces en tokens with ar ones (per-field omission honoured, replacement
  not duplication).
- **Failure semantics**: blank/null tokens emit nothing; empty customMetas emits nothing; rejected
  Settings read → optional global tags absent, baseline title/description/social floor intact,
  page renders. Bonus structural guarantee found during controls: unhead `sanitizeTagsInPlace`
  drops ANY meta with empty content — an empty placeholder tag cannot exist in rendered output.
- **Isolation**: dashboard/auth shells render none of the tags (behavioral mounts through the real
  renderer + structural scan proving `projectPublicSettingsMetas` is wired in exactly ONE file;
  app.vue untouched, still baseline-floor-only).
- **Security**: hostile custom content (`<script>alert("x&y")</script>`) survives INTACT as quoted
  attribute DATA via normal framework escaping (`"` → `&quot;`); parsed final output contains zero
  script/noscript/iframe elements; every Settings meta carries exactly {name, content} attributes
  (no key/tagPriority/innerHTML leak).
- **Untouched**: GTM (`gtmContainerId`/`analyticsEnabled`/dataLayer — zero consumption), CSP,
  PageSeo/canonical/hreflang/strictSeo, JSON-LD, all seven public pages, route budgets.

Verification: focused **23/23**; full unit suite **2429/2429 across 154 files** (includes the
page-seo-wiring contract suite); U2d1 helper + settings-request + useSiteSettings suites green
(39/39); `typecheck` exit **0**; eslint exit **0** (lint-staged clean at commit). Negative controls
A–F each executed targeted against the real renderer, failed for the intended reason, restored
byte-identically (SHA-256 `b870d48d…` verified before = after per mutation): A removed per-tag key
→ duplicate-survival test failed on `['two']`; B filtered google-named customs → collision test
failed on `[]`; C sorted descriptors pre-map → API-order test failed; D moved the registration
block into app.vue → ownership scan failed on `['app/app.vue']`; E emitted a blank verification
descriptor → blank-omission test failed on `[ { … } ]` vs `[]` (first attempt with literally-empty
content passed because unhead sanitizes empty-content metas away — recorded above as a structural
guarantee, control re-run in the survivable whitespace form); F added a script-element sink for
customs → security test failed on 8 unexpected script elements.

**FR-DSH-052 verification/customMetas PUBLIC RENDERING: IMPLEMENTED.**

Still open: GTM runtime integration (script/noscript/placement decision), CSP/D19-4 decision,
final U2 public/browser/performance closure. No new browser lane created; e2e settings-dedupe lane
unchanged and NOT run here. Nothing pushed or deployed.

**Next step: OWNER DECISION before FE4-U2e (GTM). Do NOT mark GTM complete.**

---

## FE4-U2e1 — nuxt-security CSP foundation — COMPLETE (2026-08-26, commit a84421e)

The U2e0 custom architecture (Nitro nonce plumbing + Nuxt-bootstrap SHA hashing) is DISCARDED.
Preceded by U2e0.1 (ecosystem evaluation: nuxt-security 2.6.0 + @nuxt/scripts 1.3.8 proven in /tmp
production spikes; strict-dynamic adopted) and U2e0.2 (compat gate CASE A: project/CI/production all
Node 24; production binary v24.18.0 ≥ every engine floor). Docs decision **D19-14** (docs 19 v1.12.0)
supersedes D19-4's MECHANISM with intent retained.

- **Dependency**: `nuxt-security` pinned exactly `2.6.0` (package.json + lock). @nuxt/scripts NOT
  installed (U2e2 owns GTM).
- **CSP architecture** (nuxt.config.ts `security.headers.contentSecurityPolicy`):
  `default-src 'self'`; `script-src 'self' 'nonce-{{nonce}}' 'strict-dynamic'`; `style-src 'self'
  'unsafe-inline'`; `font-src 'self'`; `img-src 'self' data: https://media.eslammuatamed.com`;
  `connect-src 'self' <api-origin>`; `object-src/base-uri " 'none' "`; `frame-ancestors 'none'`;
  `form-action 'self'`; `script-src-attr 'none'`. No unsafe-inline/eval/wildcard for scripts; no GTM
  origins anywhere.
- **Nonce ownership**: nuxt-security ONLY (`nonce: true`, SRI on). ZERO custom nonce generation,
  ZERO framework-script hashing, ZERO raw header writing — structural tests pin server/plugins to
  exactly one file whose sole job is completing `connect-src` with the RUNTIME apiBase through the
  module's documented `nuxt-security:routeRules` event (CI bakes placeholder hosts by design,
  D23-8; direct-call hook variant measurably raced the module listener and was replaced by the
  ordering-proof event mutation).
- **Defaults disposition**: every unrelated header default (COOP/COEP/CORP, HSTS,
  Permissions-Policy, Referrer-Policy, X-* family, Origin-Agent-Cluster) and middleware surface
  (`removeLoggers` mutates the client bundle; corsHandler/rate/size/xss/methods limiters) explicitly
  DISABLED — baseline app emitted none of them; adopting any is a future deliberate decision.
  `hidePoweredBy:false` keeps `x-powered-by` as-is. `upgrade-insecure-requests` dropped (HTTPS-only
  end-to-end already).
- **SWR semantics (recorded honestly)**: Nitro caches header+HTML as ONE unit; a cache hit replays
  its own consistent nonce pair for the TTL window. Proven: warm `/` pair byte-consistent;
  uncached `/about` renders fresh nonces per response.
- **Real proof (contract lane, production build)**: enforcing CSP on `/`, `/about`, `/projects`,
  `/blog`, `/ar`; every EXECUTABLE script tag carries the header nonce (i18n's inert
  application/json slp block legitimately omits one); `__NUXT_DATA__` + JSON-LD nonced; hydration +
  client nav on home/about/projects/blog/ar clean; dashboard AND auth/login shells boot; canonical +
  x-default/en/ar hreflang intact; zero analytics requests. Focused e2e **15/15**.
- **Known-benign violations (documented, narrow-matched in e2e/csp-violations.ts)**:
  `script-src-attr|inline` from @nuxt/image's hardcoded `onerror` marker (no consumer of the emit);
  `script-src|eval` from valibot's JIT probe inside Nuxt UI (designed try/catch → supported jitless
  fallback), observed on /dashboard/login only. Policy unchanged; both are blocked-by-design noise,
  not allowances.
- **Gates**: full unit suite **2475/2475 across 155 files** (incl. new config/security-policy.spec.ts
  46/46); `typecheck` exit 0; `typecheck:e2e` clean; lint exit 0 (lint-staged at commit); production
  build OK (provenance stamp correctly deferred until tree-clean post-commit).
- **Negative controls A–F**: each targeted test failed for the intended reason, restored
  byte-identically (SHA-256 baseline verified after each restore): A −strict-dynamic → policy pin
  failed; B +script unsafe-inline → no-inline pin failed; C `nonce:false` → real e2e nonce proof
  failed (header carried NO nonce); D wildcard script source → no-wildcard pin failed;
  E `experimental.ssrStreaming enabled` → streaming-disabled pin failed; F planted custom
  nonce/header plugin → ownership scan failed on both gates.
- **Streaming**: remains OFF (U2e0.1 head-loss evidence stands). **Report-only rollout clarification**:
  U2e1 proves ENFORCING in CI-compatible browser runs; a prod Report-Only phase has no value without
  a chosen report destination — rollout mode is a release-time decision (D19-14).
- **Untouched**: PageSeo/Settings product semantics, backend/API, route budgets, existing e2e lanes.

**FE4-U2e2 is now complete** (Settings-driven GTM via @nuxt/scripts — public layout only, Consent
Mode defaults-denied capability, noscript omitted per U2e0.1). Still open: final U2 closure. Nothing
pushed or deployed.

**Next step: final FE4-U2 closure. Do NOT mark U2 complete.**

---

## FE4-U2e2 — isolated public GTM runtime and Home budget governance — COMPLETE (2026-08-26)

The unit landed in Web as implementation commit `b84f11037b91ca4453eade897103df1da6044a97` and
test correction commit `0cd3f180a345f80b995cba6feb13df48bf76da49`. Its private performance decision
is Docs commit `fda38853ed26c1fca8939fd70b11a6cfd1b56910`. No commit was pushed, and nothing was
deployed or sent to an external endpoint.

**Implementation contract.** `@nuxt/scripts` is pinned at exactly `1.3.8` in `package.json` and
`package-lock.json`, registered once in `nuxt.config.ts`, and used only by the lazy client-only
`PublicGtmRuntime.client.vue` boundary rendered from the public default layout. The boundary passes
only the already-resolved `gtmContainerId`; it performs no second Settings read. The guard mirrors
the backend contract `/^GTM-[A-Z0-9]{4,12}$/` and fails closed. Valid ids register one managed loader
with `onNuxtReady`, `bundle:false`, and Consent Mode v2 defaults denied for
`ad_storage`, `ad_user_data`, `ad_personalization` and `analytics_storage`. No manual script,
`dataLayer` bootstrap, pageview push, nonce/hash work, GTM `noscript`, CSP origin or dashboard/auth
registration exists. The fixture id is the fictional `GTM-TEST1234`; the enabled browser test
intercepts the loader request and never contacts a real Google endpoint.

**Budget decision.** D20-42 freezes `/` and `/ar` at **104,526 B** app-owned rendered baseline and
**120,832 B (118 KiB)** cap:

```
ceil((104,526 x 115) / (100 x 1024)) x 1024 = 120,832 B
```

The default **103,424 B (101 KiB)** cap remains on the other sixteen public routes. D20-31's
shared public floor, delivery tiers and CSS cap are unchanged. The clean analysis build at Web
`0cd3f180` recorded tree `2d014182d2b181d9ada533cd861d818913daf80e`, output
`2aaa5c9becfce1bca13e5f143d795e79f44e30d7d128a84ebc75c576e25ad968`, 1,790 files, Node `v24.19.0`
and npm `11.17.0`. It used:
`ANALYZE_BUNDLE=1 NUXT_PUBLIC_SITE_URL=https://example.com npm run build`.

**Verification on the corrected source tree.**

| Check | Result |
| --- | --- |
| `assert-exact-build` with matching governed environment | exit 0; provenance verified for `0cd3f180` |
| `npm run size:routes` | exit 0; public floor **258,158 / 263,168 B gz**, all public app-owned/delivery/CSS checks pass; 15 documented D20-24 dashboard quality warnings remain non-blocking |
| `npm run check:gtm-isolation` | GTM chunk `_nuxt/DMbUot_B2.js`, **8,919 B gzip**; public/dashboard/auth initial closures all isolated |
| `npm run check:bundle` | exit 0; 147 public chunks, no tiptap/prosemirror/shiki/markdown-it identifiers |
| `npm run check:logical` | exit 0; no physical-direction styles |
| `npm run size` | exit 0; 29.2 kB gz against 30 kB |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0; existing non-fatal localhost URL warning from `@nuxtjs/i18n` |
| `npm run typecheck:e2e` | exit 0 |
| `npm test` | **2521/2521 tests**, 157/157 files, exit 0 |
| `npx playwright test e2e/gtm/gtm-enabled.spec.ts --project=gtm-settings` | **4/4**, exit 0 |
| `npx playwright test e2e/scenarios/gtm-disabled.spec.ts --project=ssr-scenarios` | **4/4**, exit 0 |

The first full-unit run on the implementation exposed two stale assertions in
`scripts/e2e/lane-isolation.spec.mjs` (the new lane changed the registry from 16 to 17 and the
derived shard count from 4 to 5). The exact two tests failed in isolation, the assertions were
updated in `0cd3f18`, the focused rerun passed 2/2, and the full suite then passed 2521/2521. The
route-cap negative control also remains recorded: changing the `/ar` cap to `120,833` made three
governance tests fail; restoring `120,832` made the focused four-test set pass.

**Checkpoint-tip re-verification — Web `250aaf32` (2026-08-26).** The clean governed build was
re-run after the preceding ledger checkpoint with `ANALYZE_BUNDLE=1
NUXT_PUBLIC_SITE_URL=https://example.com npm run build`. Its provenance is:

| Field | Value |
| --- | --- |
| HEAD | `250aaf32e16c603fee1627e762f4e72cdcf2ae5e` |
| tree | `0035d7f1cf9aed3a355ca3162dd18f62f20bf0cf` |
| output hash | `8783b1cd6761f4f405bd650d232dbd1dfe0ceafc26ff10bf12e1730a9b532d83` |
| output files | `1,790` |
| runtime | Node `v24.19.0`, npm `11.17.0` |

`ANALYZE_BUNDLE=1 NUXT_PUBLIC_SITE_URL=https://example.com node scripts/assert-exact-build.mjs`
returned `[assert-exact-build] provenance verified: 250aaf32e16c603fee1627e762f4e72cdcf2ae5e
(tree 0035d7f1cf9a)`. `npm run size:routes` exited 0 with `Budgets satisfied`, public floor
`258,158 / 263,168 B gz`, all public app-owned/delivery/CSS checks passing, and the same 15
documented non-blocking D20-24 dashboard quality warnings. Both Web and Docs working trees were
clean after this verification. This evidence is recorded before the ledger commit below; do not
interpret it as a branch-tip stamp.

**Documentation integrity note (superseded at final closure).** An earlier checkpoint reported
`docs/group/03-delivery-and-roadmap.md (differs)` before the private Docs bundle was synchronized.
Docs commit `d6cbb84` now contains the synchronized bundle, and the live check returns
`docs:group:check OK — 3 bundles, 25 sources, all current.` No owner-gated Docs edit remains for
this unit.

**Next three actions.**

1. Obtain an owner decision on whether to regenerate and separately commit the stale Docs group bundle.
2. Complete the remaining FE4-U2 closure; **U2e3 has not started**.
3. Begin FE-5 coherence, D20-32 review, and release-readiness work only after U2 closes.

---

## FE4-U2e3 test-correction checkpoint — 2026-08-26

The final-closure investigation found two test/instrument issues and no production regression. Both
corrections were kept as separate logical Web commits, with no push, deploy, email, webhook, or
external message:

1. `6e505af` — `test(e2e): add locale-aware Page SEO Prism examples`: the committed public
   `GET /api/v1/seo/pages/{pageKey}` response now declares named `en` and `ar` examples, and the
   Prism selector tests pin discovery plus Arabic selection. The dedicated `page-seo` backend had
   already proven localized `/about` and `/ar/about` responses, so this is contract-fixture
   fidelity, not application behavior.
2. `4b686d6` — `test(e2e): await hydrated locale head navigation`: the locale-head contract lane
   waits for hydration before clicking and uses the existing narrow console-error helper for the
   known `@nuxt/image` `script-src-attr|inline` blocked-by-policy marker. No CSP allowance changed.

Live checkpoint state before this ledger edit:

| Repo | Branch / HEAD | Working tree | Campaign PR / remote effect |
| --- | --- | --- | --- |
| Web | `campaign/frontend-v1` / `4b686d6b8164c122c2ec77730389e99d578a8453` | clean | no campaign PR; not pushed |
| Docs | `docs/web-modernization-campaign` / `d6cbb84c32cc95eea356e6ae56c8985aacb5e316` | clean | no campaign PR; not pushed |
| API | campaign dependency unchanged; no API file touched | not part of this unit | no API campaign PR/effect |

Web unit evidence at this boundary: `npx vitest run scripts/e2e/prism-locale-selection.spec.mjs`
returned **13/13**, exit 0. The negative control for the selector was previously proven: changing
the Arabic example key made both selector assertions fail, then restoration returned the instrument
to green. The final focused Playwright rerun still requires an explicit captured result.

**Next three actions.**

1. Rebuild the corrected Web HEAD and verify exact-build provenance.
2. Rerun the focused contract/browser suite and the governed performance/release checks, recording
   the actual exit codes and build SHA.
3. If all gates are green, record FE4-U2e3 closure in this ledger and the already-synchronized
   private Docs bundle; otherwise record the isolated blocker without weakening a gate.

---

## FE4-U2e3 harness-fix checkpoint — 2026-08-26

The isolated browser failures were corrected without changing application code or the security
policy. The scenario backend now serves the contract's all-null Page SEO shell dependency for every
known static page; the Prism fixture has page-key-specific nullable examples so `/resume` cannot
receive About metadata; contact axe runs only after hydration; and locale-head console assertions
reuse the existing narrow CSP helper. Unknown scenario Page SEO keys remain 404.

Three logical Web commits were added, with no push, deploy, email, webhook, or external message:

1. `720a164` — `test(e2e): serve page SEO in scenario backend`
2. `954d105` — `test(e2e): stabilize scenario accessibility assertions`
3. `79866ad` — `test(e2e): select Page SEO examples by page key`

Live checkpoint state before this ledger edit:

| Repo | Branch / HEAD | Working tree | Campaign PR / remote effect |
| --- | --- | --- | --- |
| Web | `campaign/frontend-v1` / `79866adad1cd7691f01d18958e179d87b25590b5` | clean | no campaign PR; not pushed |
| Docs | `docs/web-modernization-campaign` / `d6cbb84c32cc95eea356e6ae56c8985aacb5e316` | clean | no campaign PR; not pushed |
| API | `fix/media-upload-error-contract` / `ac72539d529adf9c4255b12d8a918a718881e5e4` | clean | unrelated; no campaign effect |

Verification at this boundary: the scenario-server negative control failed with the Page SEO route
disabled (`1 failed, 28 passed`), then passed after restoration (`29/29`). The selector negative
control returned the old locale-only name (`en` instead of `en-home`), then passed after the
page-aware selector change (`14/14`). The combined targeted unit run passed `43/43`, and targeted
ESLint plus OpenAPI JSON parsing exited 0.

**Next three actions.**

1. Rebuild the corrected Web HEAD and verify exact-build provenance.
2. Rerun the focused affected browser tests, then the canonical E2E and governed Lighthouse checks,
   recording actual exit codes and the build SHA.
3. If all gates are green, record FE4-U2e3 closure here and synchronize the private Docs bundle;
   otherwise record the isolated blocker without weakening a gate.

---

## FE4-U2e3 final verification and closure -- 2026-08-26

**FE4-U2e3 is COMPLETE.** The unit corrected only E2E harness and contract-fixture fidelity; no
application production code, security policy, route budget, or API source changed. The scenario
backend serves the contract's all-null Page SEO shell dependency for every known static page, the
Prism fixture selects page-specific nullable examples, contact axe waits for hydration, and the
locale-head assertion uses the existing narrow CSP helper. Unknown scenario Page SEO keys remain 404.

### Final measured source state

| Repo | Branch / HEAD | Working tree | Campaign effect |
| --- | --- | --- | --- |
| Web | `campaign/frontend-v1` / measured source `f64a2270c04dfe008de7a8a74f330dffab49e34d` | clean at measurement boundary | no campaign PR; not pushed |
| Docs | `docs/web-modernization-campaign` / `d6cbb84c32cc95eea356e6ae56c8985aacb5e316` | clean | D20-42 bundle synchronized; not pushed |
| API | `fix/media-upload-error-contract` / `ac72539d529adf9c4255b12d8a918a718881e5e4` | clean | unrelated; no campaign effect |

No commit was pushed, no PR was opened, nothing was merged or deployed, and no email, webhook or
external message was sent. The only analytics id remains the fictional `GTM-TEST1234`; Lighthouse
and browser tests used local mocks and did not contact Google.

### Final Web commits

1. `720a164` -- `test(e2e): serve page SEO in scenario backend`
2. `954d105` -- `test(e2e): stabilize scenario accessibility assertions`
3. `79866ad` -- `test(e2e): select Page SEO examples by page key`
4. `f64a227` -- `docs(frontend-v1): checkpoint SSR harness corrections`

### Verification evidence

| Check | Result |
| --- | --- |
| Scenario server unit | **29/29**, exit 0; the route-disabled negative control failed and restoration passed |
| Prism selector unit | **14/14**, exit 0; changing the Arabic example key failed the selector assertions |
| Combined targeted units | **43/43**, exit 0 |
| Focused browser reruns | Resume **1/1**, contact **3/3**, locale-head **4/4** |
| Clean build before final gate | exit 0; tree `011c86a9937d8473e0cbb9fc81b0b5172d65ef2e`, 1,790 files |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:e2e` | exit 0 |
| `npm test` | **2525/2525 tests**, 157/157 files, exit 0 |
| `npm run size:routes` | exit 0; budgets satisfied; 15 documented D20-24 quality warnings remain non-blocking |
| `npm run check:bundle` | exit 0; 147 public chunks, no forbidden editor identifiers |
| `npm run check:logical` | exit 0; no physical-direction styles |
| `npm run check:gtm-isolation` | exit 0; GTM chunk isolated from initial public/dashboard/auth closures |
| `npm run size` | exit 0; 29.2 kB gzip against the 30 kB cap |
| Canonical `npm run test:e2e` | exit 0; five shards passed **348 + 85 + 110 + 130 + 4 = 677** tests |
| `npm run docs:group:check` | exit 0; 3 bundles and 25 sources all current |

### Governed Lighthouse evidence

`npm run lighthouse:ci` returned **exit 0**. It rejected the pre-existing `.output` because its
governed environment fingerprint had changed, quarantined it rather than measuring it, and rebuilt
through the governed lifecycle. The final artifact is:

| Field | Value |
| --- | --- |
| HEAD | `f64a2270c04dfe008de7a8a74f330dffab49e34d` |
| tree | `011c86a9937d8473e0cbb9fc81b0b5172d65ef2e` |
| output hash | `e1a0498e1a3ba0733dfa59a19b233ef198c1383392fcb18273f20dcff3ba1701` |
| output files | `1,790` |
| runtime | Node `v24.19.0`, npm `11.17.0` |

Both profiles collected all **16/16 governed URLs** with three runs per configuration: mobile wrote
48 reports and proved 3,999 first-party HTTP/2 responses; desktop wrote 48 reports and proved 4,617
first-party HTTP/2 responses. The run bound **290 report files** to the HEAD/tree/output identity.
The Lighthouse assertion ended with **"All Lighthouse medians within the doc 20 §1 thresholds."**
Accessibility, Best Practices and SEO were 100 throughout; Performance, device-scoped LCP, CLS and
Arabic-script font limits all passed, including the D20-16 and D20-17 mobile ceilings.

### Closure and next three actions

The FE4-U2 scope is closed. The earlier Docs bundle warning is resolved by `d6cbb84`, and no Docs
file changed during this final Web-only unit. The next work is FE-5, not another FE4 correction.

1. Begin the FE-5 coherence pass and review D20-32 without changing frozen budgets implicitly.
2. Continue release-readiness evidence from a new clean, provenance-stamped source build when the
   next governed change exists; do not reuse this measurement as future evidence.
3. Keep Web and Docs branches local-only until the owner explicitly authorizes push, merge or deploy.

---

## FE5-U1 — Dashboard Operational Overview · COMPLETE · 2026-08-27

Starting committed Web HEAD: `3e05b4634a56c64017e28a25457ea919225ead3a`.

Implementation commit **`b0aa869da304be2a7f1bdfd06551c6507c860feb`** replaces the retired
`/dashboard` placeholder with the approved operational Overview: Article and Project metadata
snapshots, unread-message attention, navigation-only Skills/Testimonials cards, and the approved
common actions. It changes no API contract, route topology, backend source, analytics, or budget.
The nested card model deliberately carries `total`, `pending`, `failed`, and `forbidden` as refs
with a `load` retry function. Vue only auto-unwraps top-level template refs, so the `v-for` card
object previously interpolated Ref objects. The template now explicitly reads the four nested
`.value` fields; a focused structural regression test and browser assertion prohibit Ref-object
text from reaching the rendered card.

### Verification

| Check | Result |
| --- | --- |
| FE5-U1 source equivalence | 9/9 source/test/fixture files SHA-256 byte-identical between campaign worktree and writable verifier |
| Regression negative control | Removing `snapshot.state.total.value` made the new focused assertion fail; restoration passed |
| `npm test -- app/pages/dashboard/index.spec.ts` | 6/6, exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:e2e` | exit 0 |
| `npm run lint` | exit 0 |
| `npx playwright test --project=dashboard-overview` | 3/3, exit 0 — EN/AR RTL, real totals, no Ref leakage, exact three overview requests, isolated failure/retry, actual module and quick-action navigation, 380px overflow, axe |
| Clean committed build | exit 0; `assert-exact-build` verified `b0aa869da304be2a7f1bdfd06551c6507c860feb` (tree `6239f9455ea2`) |
| `npm run size:routes` | exit 0; budgets satisfied (the existing 15 D20-24 quality warnings remain non-blocking) |

The focused fixture trace is exactly:

1. `GET /api/v1/admin/articles?page=1&perPage=1`
2. `GET /api/v1/admin/projects?page=1&perPage=1`
3. `GET /api/v1/admin/messages?isRead=false&isArchived=false&perPage=1`

Fresh size evidence from the committed build: dashboard shared floor **263,497 B gz** against
the **268,288 B (262.0 KB)** cap; `/dashboard` **266,631 B gz (260.4 KB)**, increment **3,134 B**
against the **86,016 B (84.0 KB)** cap, app-owned **77,015 B** against **103,424 B**. The D20-24
reporting baseline is **229,657 B gz**, so the reported route delta is **+36,974 B (+36.1 KB)**.

Private Docs IA decision commit **`b4c22bd360e5d13bf5ecb23d888e5c759d949dab`** adds D04-7 and
updates the Dashboard map; `npm run docs:group:check` exited 0. No commits were pushed, no PR was
opened, and nothing was deployed.

**Next three actions.**

1. Treat FE5-U1 as closed; do not begin FE5-U2 without separate authorization.
2. Keep the private Web and Docs branches local-only until the owner authorizes a push, merge, or deploy.
3. Reuse this verification only as U1 evidence; any product change requires a fresh source-equivalence,
   build, browser, and route-size run.

---

## FE5-U2 — Dashboard Profile dirty-navigation protection · COMPLETE · 2026-08-27

Starting committed Web HEAD: `6c3b33e5d11b022be5409ade4dafbee5f3704758`.

Implementation commit **`3a5c6e3a1f316dbe6645639094b48cc061b412fe`** reuses the canonical
`useUnsavedChangesGuard` with Profile's combined condition
`portraitDirty || resumeDirty`. Portrait dirtiness remains the existing
`isPortraitFormDirty(form, initial)` comparison; résumé dirtiness remains the selected PDF asset id
against `resumeInitial`. No Profile API, save, upload, budget, backend, or route contract changed.

Each successful section save advances only that section's baseline. Thus a saved portrait leaves an
unsaved résumé guarded, and vice versa; failed portrait and résumé PATCHes retain their respective
dirty state. Initial hydration adopts both server baselines, so the loaded page is clean. The existing
`dashboard-media` fixture was extended only to persist the already-contractual `resumeAssetId`, making
the browser proof exercise the real Profile résumé flow rather than a fabricated product path.

### Verification

| Check | Result |
| --- | --- |
| `npm test -- app/pages/dashboard/profile.spec.ts` | 28/28, exit 0 |
| Focused dirty-guard unit rerun | 3/3, exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:e2e` | exit 0 |
| `npm run lint` | exit 0 |
| Fresh verifier production build | exit 0 (required by the production browser lane; no route-size measurement run) |
| `npx playwright test e2e/dashboard-media/media-profile.spec.ts --project=dashboard-media --grep 'Profile dirty navigation protection'` | 3/3, exit 0 — clean navigation, portrait-only cancel/accept + unload, résumé-only failure retention, both-dirty single confirmation, save-one preservation, final-save clearance |
| Negative control | changing the combined condition to `false` made the 3 focused dirty-guard tests fail; restored source SHA-256 `6f2a1e81315b6691fc458dd308df1627119c4586913e6311805da7fda5329823` and tracked diff SHA-256 `036ef6813aacf4175e6b620bd195f11e041a458c7f9aeadb4c9c80e67abc01e5` matched the pre-control values |

EN is covered through the shared existing localized confirmation; no application-rendered dialog
exists, so the browser-owned confirmation adds no separate AR dialog surface. Existing Profile RTL
coverage remains in the same serial lane. No private Docs decision was required because this is a
mechanical reuse of the established Dashboard guard. Nothing was pushed or deployed.

**Next three actions.**

1. Treat FE5-U2 as closed; do not begin FE5-U3 without separate authorization.
2. Keep the private Web and Docs branches local-only until the owner authorizes a push, merge, or deploy.
3. Begin FE5-U3 only from a clean committed checkpoint and with fresh scoped verification.

### Administrative closure update

**FE5-U1 COMPLETE.** The next unit is **FE5-U2 — Profile dirty-navigation protection**. It is
recorded as next work only; no FE5-U2 source, test, budget, Backend/API, deployment, or remote
action was started by this administrative closure.

---

## FE5-U3 — Dashboard collection request-state coherence · COMPLETE · 2026-08-27

Starting committed Web HEAD: `d8ef7d9b734f2bb556993e7fd938334c6cdf71cc`.

Implementation commit **`d6e6586fc508ea4292fb42aded814a867d4e17f9`** brings the Messages and
Projects collections onto the existing Articles request-state contract. Each surface derives
initial pending, refreshing, no-data failure, stale-data failure, and empty conditions through
`useRequestState`: first load remains a skeleton; a later page/filter refresh overlays the retained
rows; and a failed refresh retains those rows with a compact localized retry. The existing
action-local `busyId` mutation behavior in Messages is preserved. No ProjectEditor, Profile,
Overview, production Backend/API contract, route topology, or budget changed. The only server edit
is a fixture-only Dashboard test-control delay to make the Messages refresh state observable.

### Verification

| Check | Result |
| --- | --- |
| Focused Projects + Messages + locale-parity units | 48/48, exit 0 — initial/loading/error/empty, retained refresh data, stale retry, and EN/AR key parity |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:e2e` | exit 0 |
| `npm run lint` | exit 0 |
| Fresh verifier production build | exit 0 (required for the focused production browser lanes; no route-size measurement required by this unit) |
| `npx playwright test --project=dashboard-projects --grep 'filter refresh preserves held rows'` | 1/1, exit 0 — filter refresh retained rows, stale error retained rows, retry recovered, 380px overflow ≤ 1px |
| `npx playwright test --project=dashboard --grep 'page refresh keeps the current list'` | 1/1, exit 0 — page refresh retained messages, stale retry recovered, detail opened, 380px overflow ≤ 1px |
| Projects negative control | deliberately treated refresh as initial pending; focused retained-row unit failed as expected |
| Messages negative control | deliberately treated refresh as initial pending; focused retained-row browser test failed as expected |

Both controls were reverted byte-identically. Final committed SHA-256 values are
`73a3fb17e339dbd0d64a5410f20166fed0612708ec6012cd55c4d709bc824844` for the Projects page and
`0e63dbe1bd51d1366bd543931209fd81b9c745e0d72c2c0709ea14313513100a` for the Messages page; each
matches the committed source blob. No Docs decision was required, no private Docs file changed, and
nothing was pushed or deployed.

**Next three actions.**

1. Treat FE5-U3 as closed; do not begin FE5-U4 without separate authorization.
2. Keep the private Web and Docs branches local-only until the owner authorizes a push, merge, or deploy.
3. Begin FE5-U4 — Project editor coherence — only from a clean committed checkpoint and with fresh scoped verification.

---

## FE5-U4 — Dashboard Project editor coherence · COMPLETE · 2026-08-27

Starting committed Web HEAD: `9e1dc7934b7da45e430a4ede4c092059590910f7`.

Implementation commit **`5395c11`** moves only the Dashboard Project create/edit editor onto the
already-approved translatable-entity model. It reuses `DashboardTranslationTabs`,
`useTranslatableForm`, `dashboard-translation-errors`, `DashboardEntityFormActions`,
`DashboardEntityEditorSkeleton`, and `useUnsavedChangesGuard`; no new generic editor, tab, action,
or validation abstraction was created. EN and AR remain the only supported translations. The
Dashboard locale seeds the tab once; the operator thereafter owns entity-local tab selection.

Project-specific publication and featured switches, ordering/year/URLs, technology ids, gallery and
media behavior, SEO null/omission payload behavior, slug warning, create/update payloads, retryable
read failure, and dirty semantics are preserved. The only fixture change is a one-shot local 422
control used to exercise the existing sent-locale error contract; no product Backend/API code or
contract changed. Projects collection/list code, Messages, Profile, Overview, budgets, route
topology, and FE5-U5+ remain untouched.

### Verification

| Check | Result |
| --- | --- |
| Focused Project editor + affected form/error units | **109/109**, exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:e2e` | exit 0 |
| `npm run lint` | exit 0 |
| Fresh verifier production build | exit 0; final source byte-identical in all eight changed files |
| Focused Projects browser lane | **29/29**, exit 0 in three serial bounded slices: collection/create+tabs **10/10**, request states+technology **7/7**, SEO/mobile/axe/public isolation **12/12** |
| Browser proof | create POST and edit PATCH, EN/AR tab persistence and direction, shell-locale tab seed, clean/dirty/saved action states, cancel/accept dirty guard, EN and AR indexed 422 routing, non-locale error surface, gallery/technology/SEO preservation, 380px overflow ≤ 1px, axe EN/AR/loading zero violations |
| Route size | not required for this editor-only coherence unit; not measured; no budget changed |
| Negative controls | A tabs removal, B shared-action removal, and C sent-locale routing disable each failed its discriminating focused assertion; restored source/test SHA-256 values matched byte-for-byte |

No private Docs decision was required: this unit mechanically reuses established Dashboard editor
architecture. The separate Docs worktree's pre-existing owner CV/OG dirt was not touched. No commit
was pushed, no PR was opened, and nothing was deployed.

**Next three actions.**

1. Treat FE5-U4 as closed; do not begin FE5-U5 without separate authorization.
2. Keep the private Web and Docs branches local-only until the owner authorizes a push, merge, or deploy.
3. Start FE5-U5 — tiny stale cleanup — only from this clean committed checkpoint with fresh scoped verification.

---

## FE5-U5 — stale Frontend-v1 cleanup · COMPLETE · 2026-08-27

Starting committed Web HEAD: `b0ca73e4286c81d2b4e978b4ed8682b43b12c08d`.

Implementation commit **`2bdd12f0a6f8e2a9da16da4a559363d862ea125b`** removes two objectively stale
Dashboard navigation comments from `app/composables/useDashboardNav.ts`: the completed
Testimonials editor routes were no longer future work, and the completed in-route Taxonomy editor
was no longer a later-unit surface. The bounded Dashboard/frontend-v1 production-source scan found
no other objectively stale artifact; current route-existence, active-prefix, intentional-absence,
and native input-placeholder references were retained. No navigation item, route, label,
permission behavior, localization, ordering, feature, budget, Backend/API contract, or product
behavior changed.

### Verification

| Check | Result |
| --- | --- |
| `npm test -- --run app/composables/useDashboardNav.spec.ts` | 15/15, exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |

The primary worktree's shared `node_modules` is read-only to Vite, so the focused test was run in
the existing writable verifier with the exact deletion-only source applied; typecheck and lint ran
there as well. No production build, browser E2E, route-size, Lighthouse, Backend/API, Docs, remote,
or deployment action ran. The separate Docs worktree's owner CV/OG dirt remains untouched.

**Next three actions.**

1. Treat FE5-U5 as closed; do not begin FE5-U6 without separate authorization.
2. Keep the private Web and Docs branches local-only until the owner authorizes a push, merge, or deploy.
3. FE5-U6 is final D20-32 recalibration from the completed FE5 baseline only; it has not started.

---

## PR #75 — CSP Lighthouse remediation · COMPLETE · 2026-08-29

Starting committed Web HEAD: `975f8aeecf39d952f78f83f33458b37a40b87462`.

Implementation commit **`b1ee6e011ab52375e36b637af074ae7bb20b6e56`** replaces `NuxtImg` with native responsive images at the only two
proven public render sites: the optional testimonial avatar in `QuoteBlock.vue` and project-gallery
media in `Gallery.vue`. This removes Nuxt Image's server-rendered inline `onerror` handler while
preserving the exact URL, `srcset`, responsive `sizes`, dimensions, alternate text, lazy loading,
async decoding where it previously existed, classes, blurhash background, and layout. Gallery's
native media-query `sizes` strings are the exact expansion Nuxt Image 2.1.0 previously produced from
its shorthand. No CSP policy, image source policy, budget, Backend/API, database, R2, route, or
deployment configuration changed.

### Verification

| Check | Result |
| --- | --- |
| Focused QuoteBlock + Gallery units | 28/28, exit 0 |
| Negative control | temporarily restoring `NuxtImg` made the discriminating avatar assertion fail on the stubbed inline `onerror`; restored and byte-compared source |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| Production build | exit 0 with the standard production public-site/API environment |
| Built SSR HTML | `/`, `/ar`, `/projects/content-platform-api`, and `/ar/projects/content-platform-api` contain no inline event attributes; the two affected image surfaces remain semantically equivalent |
| CSP header | strict policy retained: `script-src-attr 'none'`; no `unsafe-inline` or `unsafe-eval` added to `script-src` |
| Focused Lighthouse desktop | 3 HTTP/2 runs each for the four affected public routes; all configured medians passed; Best Practices and `errors-in-console` were 100/clean |
| Focused Lighthouse mobile | 3 HTTP/2 runs each for the same four routes; all configured medians passed; Best Practices and `errors-in-console` were 100/clean |

The independent `/ar/about` LCP investigation remains open. Existing browser-E2E infrastructure
blockers and the frozen Messages cap remain open. FE5-U6 and FE5-U7 were not started. The separate
Docs worktree's pre-existing owner dirt was not touched. The normal campaign branch push is authorized
for this PR-only remediation; it does not authorize merging or deployment.

**Next three actions.**

1. Keep PR #75 unmerged while its normal remote checks complete.
2. Resume the independent `/ar/about` LCP investigation separately; do not fold it into this CSP fix.
3. Leave FE5-U6 and FE5-U7 untouched pending explicit authorization.

---

## PR #75 — advisory hosted Lighthouse governance · APPROVED · 2026-08-30

Owner decision: GitHub-hosted PR Lighthouse continues to collect the unchanged governed matrix,
thresholds, medians, HTTP/2 proof, Prism fixtures, and artifacts, but a completed metric-threshold
breach is advisory because hosted runner capacity is not a comparable performance reference. Build,
preview, Prism, Chrome launch, collection, route coverage, HTTP/2/provenance proof, missing or
malformed reports, and script/runtime failures remain hard failures.

The default local `npm run lighthouse:ci` contract remains hard. FE5-U7 release acceptance must run
the same governed Lighthouse gate in the stable reference environment. This decision approves no
benchmarkIndex scaling, no rerun-until-green behavior, no threshold change, and no product
optimization: `/ar/about` has not been established as a product regression. Future CI-runner
normalization is post-v1 work. The temporary hosted-runner diagnostics at `b085d0b` are no longer
needed once this governance change is implemented.

---

## PR #75 — Dashboard Messages acceptance-budget bridge · OWNER APPROVED · 2026-08-31

The owner explicitly approved an **interim acceptance bridge** for the sole remaining PR blocker.
Current-HEAD CI run `33336673888` measured `/dashboard/messages` at **104,858 B** against its prior
frozen **103,424 B** cap: **1,434 B (1.39%)** over. The bridge cap is exactly **120,832 B (118 KiB)**,
derived with the existing campaign formula
`ceil(measured × 115 / 102400) × 1024`.

All other PR gates were green before this decision. This is not FE5-U6, a D20-32 recalibration, or a
final Frontend-v1 budget certification; it changes no other route, CSS, public, warning, measurement,
Lighthouse, E2E, or product policy. **FE5-U6 remains solely responsible for final post-feedback
recalibration from a clean baseline. This bridge MUST NOT be treated as the final D20-32 value.**

---

## Acceptance Feedback U1 — Translation-panel direction ownership · COMPLETE · 2026-08-31

Starting committed HEAD: `c2d479ceab0dd06a60f6bbd7a5baa3640db01941`.

Owner acceptance found that `DashboardTranslationTabs` applied the selected translation locale's
`dir` to its complete panel. An Arabic tab could therefore reverse English Dashboard UI labels,
technical values, slugs, controls, and metadata. The shared primitive now leaves panel direction to
the Dashboard shell and exposes `contentDir` only through its translation-field slot. Authored
Article, Experience, Skill, Testimonial, and Category/Tag fields bind that value explicitly; Project
translation fields and Page SEO were already correctly locale-bound. Slugs and canonical URLs remain
explicitly LTR.

### Verification

| Check | Result |
| --- | --- |
| Shared direction contract | 3/3, exit 0 — English shell/Arabic content, Arabic shell/English content, technical UI inheritance, and tab switching |
| Directly affected Project editor | included in focused run; 53/53 total, exit 0 |
| Negative control | Restoring panel-wide `dir` made all three shared assertions fail (`rtl`/`ltr` panel attributes where absence was required); restored immediately |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `git diff --check` | exit 0 |

No API, Backend, navigation, CRUD, application-locale persistence, translation-state semantics, or
budget changed. Focused browser E2E was deliberately not run; its stale panel-direction assertions
were migrated to assert explicit field direction instead. **FE5-U6 remains blocked pending the
remaining acceptance feedback; FE5-U7 was not started.**

---

## Acceptance Feedback U2 — Dashboard header action grouping · COMPLETE · 2026-08-31

Starting committed HEAD: `bdc9be4e2765fe7ec73b4c9ff276f72e93041c5b`.

The Dashboard header now uses two local, non-generic groups: workspace controls (View site, locale,
and theme) and account controls (operator identity and sign out). A logical inline-end divider
separates the groups, so it follows shell direction in both English and Arabic. Existing control
components, destinations, new-tab protection, persistence behavior, no-dropdown bundle decision,
email truncation, and mobile visibility breakpoints remain unchanged.

### Verification

| Check | Result |
| --- | --- |
| Focused Dashboard layout/header tests | 7/7, exit 0 — grouping membership, View site new-tab contract, identity/sign-out, RTL shell, and mobile trigger/identity behavior |
| Negative control | Replacing the workspace wrapper with a transparent template removed the grouping relationship; both focused assertions failed as expected. Restored immediately. |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `git diff --check` | exit 0 |

No routes, auth semantics, overview or CRUD behavior, API/backend contracts, budgets, dropdowns, or
browser E2E changed. `typecheck:e2e` was not applicable because no E2E test or fixture type changed.
**FE5-U6 remains blocked pending the remaining acceptance feedback; FE5-U7 was not started.**

---

## Acceptance Feedback U3 — Dashboard Overview hierarchy · COMPLETE · 2026-08-31

Starting committed HEAD: `cb2e32cc5f4651387972631d6ee4e65932193979`.

The owner found the Overview functional but visually fragmented by four independent content cards
and a separate Messages card. The page now uses a single Content summary surface: Articles and
Projects retain the only real totals; Skills and Testimonials remain explicit navigation-only rows,
with no fabricated counts. Messages is a compact warning alert only when unread work exists, a
neutral compact row at zero, and a local error/retry alert when unavailable. Existing quick actions
remain together below. No analytics, historical data, derived metrics, or additional API reads were
added.

Articles, Projects, and Messages retain separate loading, error, 403 (where already applicable),
and retry ownership. The layout stacks source-labelled rows on narrow viewports and aligns them from
`sm`; it uses no physical direction assumptions, while Dashboard's existing EN/AR shell and
unprefixed route behavior remain intact.

### Verification

| Check | Result |
| --- | --- |
| Focused Overview behavior tests | 6/6, exit 0 — totals, navigation-only modules, attention/zero state, source-local loading/errors/retries/403, quick actions, and Arabic rendering |
| Negative control | Replacing the Skills/Testimonials action with inert text made the navigation contract fail; restored immediately. |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `git diff --check` | exit 0 |

No header, navigation ownership, collection CRUD, backend/API contract, E2E fixture, or budget
changed; `typecheck:e2e` was therefore not applicable. **FE5-U6 remains blocked by remaining
acceptance feedback; FE5-U7 was not started.**

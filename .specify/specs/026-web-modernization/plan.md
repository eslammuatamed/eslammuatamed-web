# Campaign 026 — Plan

**Spec:** [`spec.md`](spec.md) · **Tasks:** [`tasks.md`](tasks.md)
**Ledger:** Docs `docs/research/web-modernization-ledger.md` on `docs/web-modernization-campaign`.

---

## 1. Phase order — retained, and why

The owner's phase order is **retained unchanged**. Phase-0 evidence *reinforces* it rather than
challenging it, so **no reorder is proposed and no owner reorder-decision is raised.**

> ⚠ **CHALLENGED BY PHASE-2 EVIDENCE (ledger §12.6/§12.9, 2026-08-16).** This paragraph states the
> position as of Phase 0. Phase 2 then measured the premise underneath the Phase 2 → Phase 3
> ordering and found it **false**: dead-code removal can supply **0 B**, against a **257 B**
> requirement. A reorder *is* now on the table as **OD-26-4 option C** (Phase 5 before Phase 3).
> **The order is not changed here** — that is the owner's decision, not this plan's.

The order is not arbitrary sequencing; three real dependencies hold it together:

```
Phase 1 (CI)  ──▶ every later phase generates many CI runs, so efficiency compounds first
Phase 2 (CSS) ──▶ MUST free ≥257 B before Phase 3 can pass the unchanged 30,000 B cap  [was 253 B]
Phase 3 (Nuxt)──▶ pins vite/lightningcss/postcss, so Phase 4's batches resolve against it
Phase 4 (deps)──▶ platform stable, so Phase 5 refactors against final APIs, not moving ones
```

**Phase 2 → Phase 3 is arithmetic, not preference.** CSS headroom is ~10 B; the probe needed
253 B; 62 B of that is Nuxt-independent. Doing Phase 3 first would force the exact failure the
probe already recorded.

> ⚠ **CORRECTED BY MEASUREMENT (ledger §12.3).** The arithmetic holds; two of its three inputs do
> not. Headroom is exactly **9 B**. The requirement is **257 B**, from a measured Nuxt 4.5.2 floor of
> +266 B. And the "62 B is Nuxt-independent" clause is **false**: the cost is `cssnano`'s, it
> measures **71 B**, it is **Nuxt-coupled** (a `@nuxt/vite-builder` dependency), and it is
> **avoidable by pinning**. `postcss` alone costs **0 B**. The conclusion — do not do Phase 3 before
> the headroom exists — is **unchanged and now stronger**.

## 2. Phase definitions and exit criteria

### Phase 0 — Recovery, SpecKit and baseline

Zero-trust recovery (done, ledger §1), the 31-alert security baseline (§2), recovered historical
evidence (§3), the Phase-1 scope correction (§4), this SpecKit, and a **measured** baseline of
every gate at `ced8490`.

**Exit:** ledger §1–§6 committed; SpecKit committed; every baseline number recorded with the SHA
it came from; checkpoint report returned.

### Phase 1 — CI cleanup & efficiency

**Scope is materially smaller than the authorization's candidate list**, because recovery shows
most of it already shipped. Stating that is the finding, not a scope reduction.

- **Already COMPLETE** (backend ledger §14, Stage 2B, 2026-08-13): CI wall-clock
  **1,513 s → 696 s = −54.0 %**, reproduced at 706 s; runner work +1.1 %; Lighthouse semantics
  preserved (16 URLs, 3 runs, 96 audits, 64 configurations, thresholds untouched); **no gate
  weakened — two guards added**; negative-controlled; 4 required checks live. Artifact bytes
  regressed +32.7 %, reported not hidden.
- **Settled, do not re-propose:** four candidates measured and deliberately rejected **with
  reasons** in ledger §14j. Phase 1 reads §14j **first**; re-proposing them without new evidence
  is re-litigation.
- **The actual work — the sized §14k remainder:**
  1. **`deploy.yml` builds twice** — `npm run build` at `deploy.yml:201` (`verify`) and again at
     `:256` (`deploy`). VERIFIED present at `origin/main`. Doc 24 assigns this to *"RB-1 / the
     Frontend campaign"* — i.e. here.
  2. **Lighthouse artifact duplication ≈12 MB/run** (≈24 MB of 49 MB), blocked on the
     `provenance.json` walk binding root duplicates.
  3. **`e2e` 70 s duplication** — revisit **only if** `e2e` becomes the critical path.

**Method.** For every proposed removal or reorder, answer in writing: *"What unique guarantee does
this step currently provide?"* If the answer names a real guarantee, it is retained unless a
rigorous replacement exists. Measure **before/after on real hosted runs**; label MEASURED /
PROJECTED / EVIDENCE-DEFERRED. Too risky to remove ⇒ keep it and document why.

**Hard constraints:** no weakening of required checks, performance gates, security checks, branch
policy, Production verification, exact-SHA guarantees, or EN/AR/RTL coverage; no hiding
regressions behind caching or skipped execution.

**Exit:** the §14k remainder taken or EVIDENCE-DEFERRED with a reopen condition; before/after
measured on hosted runs; the 4 required checks still live; a negative control proving the
remaining guards still fail on a real defect.

### Phase 2 — Fast dead-code / dead-file / CSS cleanup

Narrow, evidence-only removal. **Not** deep refactoring.

**Exit criterion is numeric, and it is this phase's whole point:**

> **≥ 253 B gz freed on the `size` gate (all sheets); target ≥ 400 B for margin.**
> MEASURED in the primary worktree against a clean build, with the SHA recorded.

The 253 B floor is **provisional** — it comes from the 4.5.1 probe. Phase 2 opens by re-measuring
the **4.5.2** byte cost (task T2.1) and re-derives the floor from that number.

> ✅ **RE-DERIVED, AS THIS SECTION REQUIRED (T2.1 DONE, ledger §12.3.6):** the floor is **≥ 257 B**
> (margin ≥ 300 B; ≥ 400 B to also absorb the ~81 B unattributed residual).
>
> ⛔ **AND NOT MET.** Phase 2 closed on the exit criterion's *other* branch — **precise blocker
> identified** (§12.6). Available safe dead CSS measured **0 B**: 0 of 47 components unreferenced
> (positive- and negative-controlled), and every CSS-bearing candidate was governed, asserted by a
> test, or generated at runtime. **Zero deletions were made.** The cap was not raised and no budget
> was moved. Resolution is **OD-26-4**.

**Evidence standard.** Framework-aware only. A text search that finds no import is **not**
evidence. Be conservative around: dynamic imports · Nuxt auto-imports · file-system routing ·
plugin discovery · module discovery · CSS class generation · Tailwind/utility generation ·
runtime configuration · locale resources · SEO/meta assets · test-only files.

⚠ **Tailwind scans comments** — naming a class inside a comment emits its CSS rule. A previous
budget fix was cancelled out by exactly this. Any comment mentioning a class name is in scope.

**Exit:** byte target met and MEASURED; CSS, JS/bundles, build output, build time, tests,
Lighthouse and dependency surface re-measured; this becomes the new pre-Nuxt baseline.

### Phase 3 — Nuxt core / RB-1 security compatibility

Do **not** assume 4.5.1 is still the target. Re-derive from current official sources: latest
stable `nuxt`, compatible `vue`, Nitro, TypeScript, coupled module compatibility, Node,
migration requirements, security fixes.

**Reproduce the historical blockers where still relevant** and fix **root causes**:

- **18/12 TypeScript errors** in two families — (a) `VueSchemaOrgDefinerInput` /
  `DeepResolvableProperties<…>` not assignable to `Input`; (b) auto-imported globals missing from
  the component type (`CONTACT_LIMITS`, `formatFileSize`, `$router`). The 18-vs-12 spread is a
  **type-generation-method difference**, not flakiness.
- **CSS regression**, with **provenance established per byte**: project CSS · module CSS ·
  generated CSS · duplicate imports · framework output changes · dead styles surviving Phase 2 ·
  theme/config changes.

**Forbidden resolutions:** raising the CSS budget · suppressing legitimate TypeScript errors ·
deleting useful styles to cheat the budget · weakening accessibility or RTL · hiding hydration
errors · silently dropping modules or features · `any`.

**One open question to resolve early (T3.1):** does a newer Nuxt/vite chain, or a defensible
browser-targets change, stop `lightningcss` downleveling `:dir()`? If so the 191 B dissolves at
the root. **Changing browser support is an owner decision** — surface it as one, do not take it.

**Exit (RB-1 closure):** seven `nuxt` advisories cleared or each justified by **runtime**
evidence; `typecheck` 0 errors; CSS green at the **unchanged 30,000 B gz cap**; **and** alert #25
(critical) dispositioned per **F-1**. Checkpoint report at closure.

### Phase 4 — Full dependency modernization

Every direct dependency and devDependency on latest stable compatible, or an evidence-backed
documented exception. **No single uncontrolled `npm update`** — coherent compatibility batches,
derived from actual repository contents. Candidate batches: Nuxt ecosystem modules · Vue ecosystem
· UI/styling · i18n · state · forms/validation · SEO/content/image · API/data utilities · testing
· lint/format · TypeScript/toolchain · build tooling · dev tooling.

**Per dependency record:** current version · latest stable · target · source/compatibility
evidence · upgrade result · tests/gates · exception reason if not latest stable.

Remove dependencies proven unused. Do not keep one merely because it existed historically. Do not
force incompatible majors through peer-dependency bypasses. If latest stable cannot be adopted
safely, classify **EVIDENCE-DEFERRED** with the exact blocker and reopen condition.

**Must be handled explicitly here, not silently:**
- **F-2** — `extract-zip` #34 and `image-size` #32/#33 have **no patched version**. They will not
  clear. Each needs a stated disposition (reachability / replacement / accepted risk).
- **#19 `postcss`** — coupling to the CSS budget is **assumed, not yet proven at the version that
  matters**. Installed `postcss` is **8.5.19**; the alert clears at **8.5.23**; doc 24 attributes
  the +62 B to `cssnano` 8.0.5 arriving via `postcss` **8.5.26**. **If 8.5.23 clears the advisory
  without pulling `cssnano` 8.0.5, the 62 B leaves the required headroom entirely** and #19 becomes
  takeable independently of Phase 2 — which changes both Phase 2's floor and Phase 4's sequencing.
  This is a lockfile-resolution question, answerable **without applying anything**, and it is
  resolved in **T2.1** alongside the 4.5.2 measurement. ⚠ If the coupling does hold, `cssnano`
  **cannot be reverted piecemeal** — it rides in with `postcss`.

**Exit:** fresh dependency inventory · `npm audit` · GitHub alerts readback · compatibility
verification.

### Phase 5 — Deep frontend cleanup & modernization

Only after the platform is stable. Every meaningful refactor carries a concrete reason:
duplication · complexity · correctness · maintainability · performance · type safety ·
accessibility · framework modernization · removal of obsolete compatibility code.

Candidates: duplicated components/composables/state · unnecessary abstractions · stale
compatibility wrappers · old Nuxt workarounds · inconsistent API access · repeated data-fetching ·
weak loading/error patterns · stale TODOs · weak type boundaries · avoidable client-only execution
· unnecessary watchers/effects · component ownership · CSS architecture duplication ·
**physical-direction CSS where logical properties are required** (guarded by `check:logical`) ·
RTL inconsistencies · accessibility issues · performance hotspots · bundle isolation ·
public/dashboard coupling · patterns superseded by the final stack.

**Not** a product redesign. **Not** a visual-identity change. **Not** a stylistic rewrite of
working code.

Known target: `/dashboard/messages` at **305.6 KB gz** sits above the 300.0 KB gz D20-24 quality
target (hard ceiling 320.0). Improving it is in scope; raising the target is not.

### Phase 6 — Full verification, security & performance closure

Run the project's **actual** authoritative gates and report them under separated headings —
**TEST FAMILIES** · **CI GUARDS** · **PERFORMANCE GATES** · **SECURITY GATES** ·
**PRODUCTION SMOKES**. Do not call every mechanism a test.

Produce the milestone comparison:
`BASELINE → AFTER CI → AFTER FAST CLEANUP → AFTER NUXT → AFTER DEPENDENCIES → FINAL`,
recording **both improvements and regressions**, honestly.

### Phase 7 — Integration, promotion & Production verification

**D17-4 governance.** Campaign work integrates through `dev` by the correct feature/fix merge
method. Production promotion `dev`→`main` uses the **governed true merge-commit path** — never
squash, never rebase.

Before Production mutation, all of these are proven: exact SHA · final diff · CI · security ·
performance · merge shape · Production target.

**STOP at the `production` environment approval.** Campaign authorization is **not** authorization
for irreversible Production mutation. The merge parks the workflow; the approval is the
irreversible act.

Production verification covers the real product where applicable: public routes · dashboard/auth
routes · EN · AR · RTL · SSR output · hydration · console errors · key API-backed journeys ·
security headers · cache/SWR behaviour · asset delivery · performance-sensitive routes.

After a successful promotion, perform the required **D17-4 `dev` synchronization**.

### Phase 8 — Final documentation & Arabic study closure

Hard Definition-of-Done gate. Written against the **final shipped** code, using the ledger and
SpecKit maintained throughout — not reconstructed from memory.

Arabic documentation is **study material**, not a changelog, directory inventory, command dump or
implementation diary. It must teach the final system. **Technical identifiers stay English;
explanation is Arabic.**

**Mandatory study maps**, each answering: where do I start · why there · what to understand first ·
what to read next · how it connects · what to postpone · which real flow proves understanding.
Progression labelled **FOUNDATION / INTERMEDIATE / ADVANCED**.

- **A. Web/Nuxt Application Study Map** — derived from the **final** structure, plus
  `Follow one real feature` tracing a real product flow end-to-end.
- **B. Testing Study Map** — the **actual** taxonomy derived from the final repo (no invented
  categories), plus `Learning order` and `Follow one real test journey`. Separates TEST TYPES from
  CI GUARDS from PERFORMANCE/LIGHTHOUSE GATES from ACCESSIBILITY GATES from PRODUCTION SMOKES.
- **C. Additional maps where justified** — State & Data Flow · API Integration · Styling/CSS/RTL ·
  CI/CD · Performance · Security · Dependency architecture. **No files created merely to raise the
  count.**

**Quality gate:** a map fails if it is only a directory tree, file inventory, list of links, or
list of commands.

**Historical lessons preserved** where pedagogically useful — the failed Nuxt upgrade, why blind
upgrading failed, the CSS budget investigation, compatibility lessons, CI evidence, dependency
choices. **Do not teach historical failures as current architecture.**

**Docs verification:** verify paths against the final repo · verify anchors · **Arabic
combining-mark handling** in any automated anchor check · negative-control the link/anchor
validator · run source-driven `docs/group` generation where affected (predict blast radius →
pre-check → regenerate → postcheck → negative control → exact restore → deterministic second
generation → byte-identical → record hashes). **Never hand-edit generated bundles.**

**Docs remain PRIVATE / local-only** unless the owner explicitly authorizes publication.

## 2b. Branch strategy

**One branch per phase, each merged to `dev`.** Not one long-lived campaign branch.

- Naming: `026-web-modernization` (this branch, carrying the SpecKit) then `026-p1-ci`,
  `026-p2-cleanup`, `026-p3-nuxt`, `026-p4-deps`, `026-p5-frontend`.
- Each branch is cut from current `dev`, opened as a PR, proven by hosted CI, and merged by the
  D17-4 feature/fix method.
- Rationale: it matches the clean-boundary checkpoint policy (a phase ends where a branch merges),
  keeps each phase independently revertible, and keeps Phase 7's "prove the merge shape" honest —
  an eight-phase mega-branch would make both the promotion diff and any rollback unreadable.

⚠ **Phase 1 begins by pushing to a PUBLIC repository.** T1.2 requires real hosted runs, which
requires a push and a PR. This is precedented (Web #62 and API #70 were published draft campaign
probes) and is **not** raised as an owner gate — but it is stated up front rather than discovered
mid-phase.

## 3. Session and checkpoint policy

Mode 1 phased execution. At most **2 completed phases per session**, or **1** if it involved heavy
implementation; stop earlier on any context warning. Every phase ends at a **clean boundary** and
writes a ledger checkpoint (SHAs, open PRs + head SHAs, phase status, next 3 actions) that is
**committed**, never left in a scratchpad.

## 4. Delegation policy

Bounded investigation, implementation, testing, review or verification work may be delegated to
Codex. Claude retains: reviewing delegated output · integrating it · running authoritative gates ·
validating evidence · recording decisions in the ledger. **Codex makes no owner decisions and
crosses no Production or destructive boundary.**

## 5. Standing measurement rules

Single build directory — the primary worktree. Cross-worktree comparison is **invalid** (separate
`node_modules` cascades chunk-hash renames into a false diff) · `nvm use 24`, `.nvmrc` = 24 ·
build env must match CI: `NUXT_PUBLIC_SITE_URL=https://example.com`,
`NUXT_PUBLIC_API_BASE=https://example.com/api/v1` · **rebuild between any source change and a
Playwright run** (Playwright serves a prebuilt `.output`) · `size:routes` requires
`ANALYZE_BUNDLE=1 npm run build`, and **exit 2 means measurement failure, not a budget breach** ·
`size` (30,000 B, all sheets) and `size:routes` (30×1024, entry only) are **different gates over
different files** — always name which one a number came from · **never pipe a gate into `tail`
without `set -o pipefail`** — a pipe masks the real exit code, which already produced one false
"build succeeded" this session · web build output is non-deterministic, so exclude the 4 build-id
files + `.provenance.json` from any build comparison and run the negative control first.

**Known-red, do not chase or suppress:** `test:e2e:repeat` — a pre-existing hydration defect owned
by issue **#30**, explicitly out of scope.

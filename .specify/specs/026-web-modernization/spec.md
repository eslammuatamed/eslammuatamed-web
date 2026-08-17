# Campaign 026 — Web Modernization, Security & Cleanup

**Type:** campaign (multi-phase), not a feature slice.
**Scope:** the `eslammuatamed-web` repository only.
**Authorization:** owner campaign-level authorization, 2026-08-15.
**Baseline:** `origin/dev` **`ced84902a57006eea886dac221f94a720df603d5`**.
**Ledger:** Docs repo, branch `docs/web-modernization-campaign`,
`docs/research/web-modernization-ledger.md` (opened at `d5199e9`).
**Governed by:** doc 24 §2b (**RB-1**), doc 20 (performance budgets), doc 17 / **D17-4**
(integration & promotion), doc 18 (testing strategy), doc 19 (security), doc 23 (operations).

**Explicitly closed and not reopened:** all Backend campaigns. No Backend ESM, no PostgreSQL
SCRAM, no M5, no unrelated roadmap work.

> ## ✅ OUTCOME — LIVE IN PRODUCTION (2026-08-17)
>
> **Phases 0–7 CLOSED · Phase 8 IN PROGRESS (rescoped 2026-08-17).** Promoted via PR #67 as a true 2-parent merge commit
> **`648aa467cd8bc7157cbcad2fd7c0e8981ee1f16c`** and deployed as release **`20260817T175534Z-648aa46`**
> (serving tree `7deef81c…`, 15/15 cutover steps `success`, **no rollback**). `origin/dev` was
> fast-forwarded to `origin/main` afterwards per D17-4. Full Production smoke green; two smoke groups
> remain **access-limited, not failing**.
>
> ⚠ **This banner records the OUTCOME, not campaign closure** — Phase 8 is in progress. ⚠ **Phase 8
> was RESCOPED by owner directive on 2026-08-17** to *campaign documentation, handoff and truth
> reconciliation only*; the comprehensive Web learnability / study-map work was **transferred out** to
> a separate `Web Learnability & Maintainability Pass` that runs **after Frontend v1**. Its deferral
> **does not keep Campaign 026 open**. Open items: `tasks.md` §Phase 8 and §Remaining follow-ups.
>
> ⚠ **§1 below is the campaign's ORIGIN narrative** and is preserved as written. Its `nuxt` **4.4.8**,
> its **31 open Dependabot alerts** and its *"RB-1 blocks the next Web Production promotion"* describe
> the **starting condition of 2026-08-15**, which the campaign has since resolved — **RB-1 is closed
> and the modernized stack is deployed**. ⚠ **Do not read any alert count in this document as current
> security truth**; a fresh authoritative recount is required (`tasks.md` R-4).

---

## 1. Why this campaign exists

Web ships `nuxt` **4.4.8** with **31 open Dependabot alerts** — 1 critical, 21 high, 7 medium,
2 low. Seven are `nuxt` advisories deferred (not dismissed) under **OD-20-1**, and three of those
are severe at runtime: server-side **RCE** via runtime template injection in server-island props
(`GHSA-9473-5f9j-94wq`), a runtime payload cache that **discloses another user's SSR data**
(`GHSA-wm8w-6qjm-cv43`), and route rules silently dropped for mixed-case paths that **bypass
`appMiddleware` auth gates** (`GHSA-hxvh-4h3w-prp9`).

**RB-1 blocks the next Web Production promotion.** It has been attempted once and failed.

> ⚠ **OD-26-4 status language (2026-08-16).** Phase 3 may establish
> **`NUXT SECURITY/COMPATIBILITY IMPLEMENTATION COMPLETE`**. **RB-1 is not called release-closed**
> while the unchanged performance gates are red. Final RB-1 closure requires the modernized Nuxt
> stack **and** the Phase 5 cleanup to satisfy all original release gates together.

The campaign's target is not "upgrade Nuxt." It is to leave the Web repository **modern, secure,
smaller, cleaner and fully verified** — with the security debt closed, every direct dependency on
a justified version, the dead surface removed, and the whole state proven through authoritative CI
and Production.

## 2. What the previous attempt established

The `nuxt` 4.5.1 experiment is preserved as tag `probe/nuxt-4.5.1-experiment` (`8fee07c`). It
cleared five of the seven `nuxt` advisories and **broke two governed gates**:

| Gate | Baseline (4.4.8) | Probe (4.5.1) |
|---|---|---|
| `typecheck` | 0 errors | **18** under `nuxt prepare`, **12** under a full `nuxt build` |
| CSS, all sheets, cap **30,000 B gz** | **29.99 kB — PASS** | **30.25 kB — RED, +253 B** |

This campaign treats that as **historical evidence, not an instruction to retry**. In particular
the target is re-derived: `nuxt` latest stable is now **4.5.2**, and all seven advisories report
`first_patched_version: 4.5.1`, so 4.5.2 clears them too. The 4.5.2 byte and type cost is
**unmeasured** and is not assumed equal to the probe's.

## 3. The three findings that shape the plan

**F-1 — RB-1 does not cover the one critical alert.** Alert **#25**, `@nuxt/devtools`
`GHSA-279x-mwfv-vcqv` (**critical**, first patched **3.3.1**), is absent from doc 24 §2b's table.
RB-1's exit criteria, read literally, can be satisfied with a critical alert still open. This
campaign closes that hole: **#25 gets a disposition before RB-1 is declared closed.**
`@nuxt/devtools` is a development-time transitive dependency, but per the RB-1 precedent
*configuration-level non-use is not sufficient evidence to waive* — reachability must be
established from the **built artifact**, the same standard doc 24 set for `__nuxt_island`.

**F-2 — three alerts cannot be fixed by upgrading at all.** `extract-zip` (#34) and `image-size`
(#32, #33) report `first_patched_version: none`. No dependency sweep will clear them. They need a
disposition of a different kind — reachability, replacement, or an evidence-backed accepted risk.
Planning them as ordinary upgrades would guarantee a false "all alerts cleared" claim at closure.

**F-3 — Phase 2 is arithmetically load-bearing for Phase 3.** CSS sits at **29.99 / 30.00 kB gz**,
about **10 B of headroom**. The probe needed **253 B**, and **62 B of that is Nuxt-independent**
(`cssnano` 8.0.5 via `postcss` 8.5.26 stops stripping whitespace after commas). That same 62 B
separately blocks the `postcss` advisory (#19). So a *security* fix is gated by a *performance*
budget, and no choice of Nuxt version dissolves it.

**Consequence:** Phase 2 stops being "tidy up" and becomes a **numeric precondition** for Phase 3.
Its exit criterion is a measured byte target on the `size` gate, not a count of deleted files.

> ⚠ **F-3 SUPERSEDED TWICE — read this before using any number above.**
>
> **(a) By measurement, 2026-08-16 (ledger §12.3).** Headroom is exactly **9 B** (29,991 B / 30,000 B).
> The Nuxt 4.5.2 floor is **+266 B**, so the requirement is **257 B**, not 253 B. The
> "62 B is Nuxt-independent" clause is **false**: the cost is `cssnano`'s, measures **71 B**, and is
> **Nuxt-coupled** (a `@nuxt/vite-builder` dependency). `postcss@8.5.23` clears advisory **#19** at
> **+0 B** — byte-identical output — so the security fix is **not** gated by the performance budget.
> `cssnano` drags `postcss`, not the reverse.
>
> **(b) By owner decision OD-26-4, 2026-08-16 (ledger §13).** Phase 2 is **no longer a numeric
> precondition for Phase 3**. Phase 2 closed as *precise blocker identified* — safe dead CSS
> available measured **0 B** across four controlled candidate pools — and the owner resolved that the
> campaign **tolerates a clearly identified temporary CSS-budget regression on the isolated campaign
> branch** through Phases 3–4, with **one** cleanup pass in Phase 5 against the modernized stack
> under a hard exit gate restoring every original budget. The **30,000 B cap is unchanged and is not
> raised**. See plan §1/§1a.

## 4. Scope

**In:** CI efficiency (the sized §14k remainder) · proven dead code, files, styles, assets,
scripts and dependencies · RB-1 / Nuxt security compatibility · a full direct-dependency review to
latest stable compatible · deeper frontend cleanup and modernization once the platform is stable ·
full verification closure · governed integration, promotion and Production verification · final
campaign documentation, handoff and truth reconciliation (Phase 8, as rescoped 2026-08-17).

⚠ **Removed from scope 2026-08-17 (owner directive), after Production:** *the final Arabic study
documentation rebuilt as a guided curriculum*. It was in this campaign's original scope; it is now
**transferred whole** to the `Web Learnability & Maintainability Pass`, to run **after Frontend v1**.
This is a **transfer, not an abandonment, and not incomplete Campaign 026 work** — see `tasks.md`
§Phase 8 → DEFERRED.

**Out (explicitly):** any Backend work · product or visual redesign · new product features · API
contract changes · landing PR #46 (`024-violet-glass`) · issue **#30** (the known-red
`test:e2e:repeat` hydration defect) · docs publication · raising any budget · weakening any gate.

## 5. Non-negotiable principles

CI remains authoritative · no gate weakened to make an upgrade pass · **no CSS/JS budget raised**
to accept a dependency · TypeScript stays strict · **no `any` as an escape hatch** · EN/AR + RTL
preserved · accessibility preserved · SSR/hydration correctness preserved · the `useApi` boundary
preserved · public/dashboard isolation preserved · **no `--legacy-peer-deps`**, arbitrary
`overrides`, or compatibility hacks as a final solution · primary sources for dependency decisions
· "latest published" is not automatically "correct" · no silent expansion into a product redesign.

## 6. Evidence vocabulary

Every claim carries **MEASURED** (command run, output recorded, SHA named), **PROJECTED**
(derivation stated), or **EVIDENCE-DEFERRED** (exact blocker + reopen condition).

Verification mechanisms are never collectively called "tests". The campaign separates
**TEST FAMILIES** · **CI GUARDS** · **PERFORMANCE GATES** · **SECURITY GATES** ·
**PRODUCTION SMOKES**.

## 7. Exit criteria (campaign Definition of Done)

1. Safe CI efficiency work complete or EVIDENCE-DEFERRED with a reopen condition.
2. Fast dead-code / dead-file / CSS cleanup complete, with the byte delta MEASURED.
3. **RB-1 closed** on doc 24 §2b's own terms: `nuxt` patched with the seven advisories cleared or
   each individually justified by **runtime** evidence; `typecheck` **0 errors**; CSS green at the
   **unchanged 30,000 B gz cap**. Raising the cap, weakening a gate, or re-baselining `size:routes`
   is not an acceptable resolution.
4. Alert **#25 (critical)** has an explicit disposition — patched, or waived on artifact-level
   reachability evidence. RB-1 is not declared closed while #25 is undispositioned (**F-1**).
5. Every direct dependency reviewed and on latest stable compatible, or carrying an
   evidence-backed documented exception with a reopen condition.
6. Unused dependencies removed; the three unpatchable alerts (**F-2**) each carry a stated
   disposition.
7. Deep frontend cleanup/modernization complete, every refactor tied to a concrete reason.
8. All authoritative gates green; budgets **not weakened**; EN/AR/RTL, accessibility and
   SSR/hydration correct.
9. Production verified against the real product.
10. Documentation reflects shipped reality; the Arabic Study Maps meet the guided-learning
    standard set by the Backend verification; roadmap/ledger/handoff synchronized.

## 8. Owner gates (campaign stops)

Production **approval** · destructive action · material architecture choice with multiple valid
options · breaking API contract · weakening any test/security/performance gate · **raising CSS/JS
budgets** · accepting a materially incompatible dependency path · disabling meaningful coverage ·
major visual/product redesign · docs publication · scope expansion beyond Web · an unresolved
security finding needing product/architecture policy.

**The irreversible boundary is the `production` environment approval, not the `dev`→`main` merge.**
Verified live this session: `deploy.yml` binds its `deploy` job to `environment: production`, which
carries `required_reviewers: eslammuatamed` and **`can_admins_bypass: false`**. A merge to `main`
starts the workflow and **parks** it. This supersedes the prior standing note that Web `dev`→`main`
auto-deploys with no gate — that was true before `b5e2d66`.

## 9. Open owner decision

**OD-26-1** — push tag `probe/nuxt-4.5.1-experiment` (`8fee07c`) to `origin`? It is the only
preserved artifact of the failed upgrade and exists in exactly one local `.git`. Pushing publishes
it to a **public** repository, so it is not taken unilaterally. **OPEN.**

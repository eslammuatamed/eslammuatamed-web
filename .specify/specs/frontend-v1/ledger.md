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
| **Branched from** | `origin/dev` `54cea28737c558767ccb24a34e2b437b62f7f058`, via `plan/frontend-v1`. ⚠ The branch **tracks `origin/dev`**, so `git status` reports an ahead-of-upstream count — that is expected, **not drift**. |
| **Remote state** | **NOT PUSHED.** `origin/dev` = `54cea287…`, `origin/main` = `648aa467…` — neither moved by this campaign |
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
| FE-2 — Articles Tracer Bullet + Dashboard Architecture | **STARTED — shell survey done; blocked on OD-11 for chrome only.** Content-side work is unblocked. |
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
| **OD-9** | The **active content locale seeds the initial** translation tab; tab selection is thereafter independent per entity. (Stated without presuming a Dashboard *chrome* locale — holds under both OD-11 options.) |
| ~~**OD-10**~~ | ~~Dashboard shell is fully localized EN/AR.~~ ⚠ **SUPERSEDED BY OD-11 — see §9.** This was inferred from the owner's "locale control in the header" before doc 02 §9 / doc 04 §1 were found. It is **Option B of OD-11**, i.e. an open decision, **not settled authority**. Do not build a localized shell on this row. |
| **UX** | Multilingual authoring: shared fields once + locale tabs; preserved unsaved state; validation visible across inactive tabs; correct RTL/LTR; 380px. |
| **UX** | Dashboard shell needs a locale control, appearance control, obvious **View/Open Portfolio**, contextual **View-on-site** where a real public destination exists. ⚠ What the locale control *switches* — chrome language vs content locale — is **OD-11**, open. |
| **UX** | `/dashboard/login` gets a full product-quality redesign — Nuxt UI + standard Zod, obvious way back to the public site. |
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

## 9. DECISIONS NEEDED — owner

### OD-11 — Dashboard chrome language: English-only, or fully localized EN/AR?

**BLOCKING FE-2's form architecture and the Dashboard string budget for FE-3/FE-4.**

**The exact decision.** The owner's UX input asks for a "locale switcher adjacent to the
appearance/theme control" in the Dashboard header, and for the active translation tab to "default
coherently from the current Dashboard/application locale". Both presuppose a **Dashboard application
locale**. Two governing documents say there is none:

- **doc 02 §9 (Assumptions):** *"The dashboard UI chrome ships in **English only in v1**; all
  content remains bilingual. **Confirm at doc 11 review.** Rationale: single operator, principle 2 —
  localizing an interface only Eslam sees serves no persona; the i18n architecture does not preclude
  it."*
- **doc 04 §1:** *"Dashboard routes are English-only chrome (doc 02 §9) and carry no locale prefix."*

**Why existing principles do not settle it.** The assumption is explicitly provisional — it carries
its own review trigger, *"Confirm at doc 11 review"* — so it was always meant to be revisited, and
the owner's UX input is plausibly that revisit. But it is still a **governed** decision recorded in
two documents and **encoded in shipped code**, and reversing it materially changes v1 scope. Under
the owner's own escalation list ("materially change Dashboard information architecture", "a governed
architecture decision must change"), that is an owner call, not an implementation choice.

**Evidence it is encoded, not merely documented.** `app/layouts/dashboard.vue:86-87` deliberately
uses a **physical `left`** for the mobile drawer, with the comment: *"Physical `left` rather than a
logical property: the dashboard is English-only LTR by owner decision 10, and the RTL
logical-properties gate governs the public chrome."*

**Note on ambiguity.** A narrower reading of the owner's request is possible and would **not**
conflict: the header control switches the **content locale being edited** (and/or the locale the
"View site" action opens), while the chrome stays English. That reading satisfies "default the
active tab coherently" without reversing anything.

| Option | Product impact | Technical / maintenance impact |
| --- | --- | --- |
| **A — Keep English-only chrome; the header control switches the *content* locale** (recommended) | Owner gets the requested control and the coherent tab default; chrome stays English | **Small.** No new translation surface. Drawer `left` stays valid. FE-3 modules carry no extra string cost. Honours doc 02 §9 as written. |
| **B — Fully localize the Dashboard EN/AR** | An Arabic-first operator gets an Arabic admin UI — a real benefit, and the owner is Arabic-speaking | **Large.** Every Dashboard string across ~12 modules becomes translatable; RTL admin layouts incl. tables; the logical-properties gate must extend to dashboard chrome; the drawer side and all physical properties must flip; doc 02 §9 and doc 04 §1 must be amended. Materially enlarges FE-2/FE-3/FE-4. |

**Recommendation: Option A.** It satisfies every concrete behaviour the owner asked for — a locale
control in the header, a coherent default for the active translation tab, and locale-correct
`View site` — without reversing a governed decision or multiplying the FE-3 string budget. If the
owner actually wants an Arabic admin UI, that is Option B and should be chosen deliberately, with
its cost visible, rather than arrived at sideways through a header control.

**What remains unblocked meanwhile:** everything content-related. Content is bilingual under **both**
options, so the translation-tab pattern, the shared-vs-translatable field split, validation
discoverability, RTL/LTR *field* rendering, and the whole Articles tracer bullet proceed unchanged.
Only the **chrome** language and the drawer/physical-property question wait on this.

**What specifically cannot proceed:** the final Dashboard shell header composition, the decision to
extend the logical-properties gate to dashboard chrome, and the FE-3 per-module string budget.

---

## 8. Exact next action

**FE-1 is closed.** Commits on `campaign/frontend-v1`:

| SHA | What |
| --- | --- |
| `3be8be7` | Frontend v1 plan (audit, product definition, phases) |
| `19e3a05` | **atomic contract adoption** — contract + generated types + fixture adaptation |
| `6fd38d3` | owner UX requirements, resolved decisions, FE-1 record |

**Next, in order:**

1. **Answer OD-11 (§9)** — Dashboard chrome language. Blocks only the shell header composition and
   the physical-vs-logical property question; **not** the content work.
2. **Proceed with the Articles tracer bullet** — unblocked under either OD-11 option, because
   content is bilingual either way. Build the real flow first; extract
   `useTranslatableForm` / `TranslationTabs` / `EntityFormLayout` **only after it demonstrates the
   boundary**, never as an up-front framework.
3. **Write the discriminating test early** — a validation error in an **inactive** locale tab must be
   surfaced and the tab marked invalid. Without it the tabbed pattern can ship broken and look fine.
4. **Then** the Dashboard reply flow (`POST /admin/messages/{id}/replies`), reusing FE-2's form,
   validation and save-feedback patterns. Contract facts are captured in `plan.md` §15.4 — note
   especially that **2xx does not mean the mail was sent**; the outcome is in `status`.

**Push discipline:** nothing is pushed. `origin/dev` and `origin/main` are untouched. No merge to
`main`, no deploy, no Docs publication.

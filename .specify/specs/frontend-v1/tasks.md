# Tasks: FE5-U7 — Frontend v1 Release Acceptance Evidence

**Input:** `spec.md`, `plan.md`, Central Docs `5001ae62573ae488a16a552b1de9d7d1d03f72ab`

**Status:** Definition tasks complete when this PR merges; acceptance tasks unstarted

**Rule:** A failed gate stops that gate and opens/authorizes separate remediation. Never prescribe or
silently implement a fix inside acceptance.

## Phase 0 — Definition (this documentation task)

- [x] **U7-DEF-001** Verify live Web/Docs refs, exact dev CI, open dev PRs, U7 absence, and campaign structure.
- [x] **U7-DEF-002** Merge the focused Central Docs F-D2/D16-8 alignment before finalizing this definition.
- [x] **U7-DEF-003** Define SP-1…SP-5, CP-1…CP-5, U7-G1…U7-G8, evidence schemas, and exact closure boundary in `spec.md`.
- [x] **U7-DEF-004** Record the executable prerequisite/acceptance sequence and consistency checklist.
- [ ] **U7-DEF-005** Merge this documentation PR to `dev`, record the merge/integration evidence append-only, and leave U7 acceptance unstarted.

## Phase PRE — Separately authorized pre-U7 prerequisite work

These tasks are not U7 acceptance execution and require their own authorization, branches, tests,
reviews, and D16-8 closeout.

- [ ] **U7-PRE-001** Provision/identify the governed non-production Lighthouse reference environment satisfying `spec.md` §5.1; retain capacity and protocol proof.
- [ ] **U7-PRE-002** Remediate the Web **CI SECURITY GATE DEFECT** so the D19-11 high+ audit blocks PR/integration CI; do not infer a `deploy.yml` requirement.
- [ ] **U7-PRE-003** Certify prerequisite outputs independently and record their merged SHAs/evidence locations in the append-only ledger.
- [ ] **U7-PRE-004** Reconcile the current Lighthouse summarizer's `0.05`-passes comparator with authoritative D20 `CLS < 0.05`; prove the strict boundary with a negative control in a separately authorized instrumentation fix.

**Start checkpoint:** do not run U7-A01 until SP-1 and SP-3…SP-5 pass. U7-A01 is the controlled
start that freezes the candidate and discharges SP-2 before any downstream evidence collection.
Until U7-PRE-001 is complete, status is **DEFINED — NOT READY TO START GOVERNED ACCEPTANCE**.

## Phase A — Controlled start: freeze and certify the candidate

- [ ] **U7-A01 [U7-G1]** Select the candidate from the then-current governed integration state; record commit SHA, tree SHA, lockfile hash, branch/base, clean-tree proof, operator, and freeze timestamp.
- [ ] **U7-A02 [U7-G2]** Certify every required PR/integration CI job against the exact candidate or prove the tested synthetic-merge tree equals it; retain run/job URLs and conclusions.
- [ ] **U7-A03 [U7-G1]** Recheck candidate identity immediately before downstream evidence collection; if it changed, invalidate stale evidence and refreeze.

## Phase B — Governed performance evidence

- [ ] **U7-A04 [U7-G3]** Certify reference-host identity/capacity, production build mode, deterministic upstream/data mode, Node/npm/Lighthouse/Chrome versions, and HTTP protocol before measurement.
- [ ] **U7-A05 [U7-G3]** Execute the 16-path × 2-profile × 3-run governed matrix (96 audits) with individual reports retained.
- [ ] **U7-A06 [U7-G3]** Validate comparable-run medians, category/LCP/strict-`<0.05`-CLS/font thresholds, artifact hashes, and infrastructure-failure rules; stop and open remediation for any real threshold failure.

## Phase C — Accessibility evidence

- [ ] **U7-A07 [U7-G4]** Certify exact-candidate Playwright/axe, locale-parity, RTL, and Lighthouse Accessibility results.
- [ ] **U7-A08 [U7-G5]** Conduct keyboard-only EN and AR journeys against the shipped Markdown + explicit-save editorial flow.
- [ ] **U7-A09 [U7-G5]** Conduct NVDA+Firefox and VoiceOver+Safari journeys with versioned environments.
- [ ] **U7-A10 [U7-G5]** Verify 200% zoom, reduced motion, and Arabic screen-reader/voice behavior; record every finding, WCAG reference, disposition, and retest.

## Phase D — Security and canonical content

- [ ] **U7-A11 [U7-G6]** Run fresh full and production-only audits against the candidate lockfile; retain raw evidence and disposition for every HIGH/CRITICAL chain.
- [ ] **U7-A12 [U7-G6]** Certify the repaired blocking high+ PR/integration CI gate is green on the exact final candidate; non-reachability is not a waiver.
- [ ] **U7-A13 [U7-G7]** Record deployed API SHA, verify a restorable backup and required migrations, then run and review `content:sync:plan -- --json`.
- [ ] **U7-A14 [U7-G7]** Obtain explicit owner authorization before any non-empty apply and retain apply evidence when one occurs; in every case run and retain a second plan proving zero changes.
- [ ] **U7-A15 [U7-G7]** Verify governed canonical EN/AR slugs and protected operational counts; never substitute Lighthouse fixture slugs.

## Phase FINAL — Documentation, evidence, and handoff gate

- [ ] **U7-A16 [U7-G1…G8]** Reconfirm every artifact names the same final candidate SHA/tree/lockfile; invalidate mixed-candidate evidence.
- [ ] **U7-A17 [U7-G8]** Update `spec.md`, `plan.md`, `tasks.md`, and append-only `ledger.md` to actual execution; check only verified tasks and link every artifact/remediation.
- [ ] **U7-A18 [U7-G8]** Complete source-of-truth synchronization and independent consistency review; prove no production action, remediation implementation, deferred feature, stale Tiptap/autosave requirement, fixture production route, waiver, or threshold drift entered U7.
- [ ] **U7-A19 [U7-G8]** Write the standalone handoff with exact repos/branches/SHAs/PRs/CI, evidence index/hashes, migrations/content state, limitations, gate matrix, next actions, and READY FOR PROMOTION verdict.
- [ ] **U7-A20 [U7-G8] Documentation & Handoff Gate sign-off (D16-8/D16-13)** — all gates and closure prerequisites pass; module docs are N/A only if U7/remediations changed no application module; record the exact completion condition and close U7 without promotion or deployment.

## Dependencies

1. Definition Phase 0 precedes separately authorized PRE work.
2. PRE work discharges SP-3, SP-4's instrument consistency, and the security-gate prerequisite; SP-1 and SP-3…SP-5 precede Phase A.
3. U7-A01 opens Phase A and discharges SP-2; only then may Phases B–D collect evidence.
4. B, C, and audit classification may proceed independently against the same frozen candidate;
   owner-operated content work keeps its authorization boundary.
5. Any remediation that changes the candidate returns execution to U7-A01 and reruns every affected gate.
6. Phase FINAL is last and cannot pass until CP-1…CP-5 are discharged.

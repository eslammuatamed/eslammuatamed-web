# FE5-U7 — Frontend v1 Release Acceptance Evidence

**Parent:** FE-5 — Coherence, D20-32 Review, M4 Closure

**Type:** release-acceptance evidence unit; no product implementation

**Definition branch:** `docs/frontend-v1-u7-definition`

**Created:** 2026-09-13

**Definition status:** Authoritative when merged to `dev`; acceptance not started

**Authoritative Docs baseline:** Central Docs `eb8d25cdca1885b3601dc7b36d8a38172b0ccdcd`; D20-43 is
authoritative through PR #66 (source commit `8c6d269afb6795993db09ca695b130da5d2dcd04`)

**Definition base:** Web `e79d24beca25704c4643579c5e3a25c7f482f46d`

## 1. Purpose and release boundary

FE5-U7 binds all Frontend v1 release-readiness evidence to one exact candidate commit, tree, and
lockfile and determines whether that candidate is **CLOSED / READY FOR PROMOTION**. It implements no
product feature and never repairs a failed gate silently. A failed gate stops that gate and opens a
separately authorized remediation unit; acceptance resumes only against a newly frozen final
candidate.

U7 does **not** promote `dev` to `main`, deploy production, run production smoke as part of closure,
mutate production data merely to obtain evidence, or start FE5-U8. Promotion and deployment remain
separate owner-governed lifecycle actions after U7.

## 2. Current prerequisite status

| Item | Current status |
| --- | --- |
| U7 definition | Complete on Web `dev` |
| Candidate SHA/tree | Not frozen for U7 |
| Governed reference execution | **BLOCKED — GITHUB-HOSTED CALIBRATION INFRASTRUCTURE AND CERTIFICATION REQUIRED** |
| Security remediation | **Complete — blocking full-graph HIGH+ PR/integration gate certified** |
| Manual accessibility | Outstanding |
| Canonical content reconciliation | Outstanding |
| Production deployment | Not part of U7 |

These conditions do not mean U7 acceptance failed: acceptance has not started. The missing governed
reference execution prerequisite prevents governed Lighthouse execution and therefore prevents the acceptance
unit from being ready to start.

## 3. Prerequisites

### 3.1 Start prerequisites

| ID | Requirement | Present state |
| --- | --- | --- |
| SP-1 | Authoritative U7 definition merged to Web `dev` | Satisfied |
| SP-2 | One exact candidate commit SHA, tree SHA, lockfile hash, branch/base, and relevant CI run selected and frozen by controlled start task U7-A01 before downstream evidence collection | Outstanding |
| SP-3 | Governed GitHub-hosted Lighthouse reference execution implemented and calibrated: one attempt is one Actions job, one allocated runner, one manifest, and one complete comparable measurement set | **Blocked — calibration infrastructure and certification required outside U7** |
| SP-4 | Evidence locations, schemas, checklists, retention rules, operators, and D20-conformant measurement semantics are assigned | Schemas defined and strict CLS comparator reconciled; remaining evidence locations/operators stay outstanding |
| SP-5 | Manual accessibility target matches shipped v1: Markdown textarea and explicit save, not Tiptap/autosave | Satisfied in Central Docs D05-5 via PR #65 |

SP-1, SP-3, SP-4, and SP-5 must pass before the controlled U7 start. U7-A01 is the sole start-control
task and immediately discharges SP-2; no downstream acceptance evidence may be collected until all
five SP items pass. SP-3 reference-execution certification and security-gate repair are pre-U7 prerequisite work, not
acceptance tasks.

### 3.2 Closure prerequisites

| ID | Requirement |
| --- | --- |
| CP-1 | U7-G1 through U7-G8 all have passing evidence bound to the exact final candidate |
| CP-2 | The separate security/CI remediation is complete and the final candidate passes the full blocking high+ gate |
| CP-3 | Owner-operated canonical content reconciliation is accepted, with plan/apply-if-authorized/no-op evidence retained |
| CP-4 | The complete automated and manual accessibility matrix is accepted with no unresolved WCAG 2.2 AA failure |
| CP-5 | D16-8 evidence, source synchronization, consistency verification, and standalone handoff are complete |

## 4. Stable acceptance gates

| Gate | Requirement and source | Owner / mode | Environment and prerequisites | Pass condition | Required evidence | Blocking semantics |
| --- | --- | --- | --- | --- | --- | --- |
| **U7-G1 Exact candidate identity** | Freeze one immutable candidate; this spec §7.1, D16-8 | Release operator / automated + review | Clean checkout; SP-1 and SP-3…SP-5; U7-A01 discharges SP-2 | SHA, tree, lockfile hash, branch/base, and CI head agree; tree stays unchanged through all gates | Candidate manifest and hashes | Any mismatch or mutation invalidates downstream evidence; refreeze and rerun affected gates |
| **U7-G2 Exact-SHA CI** | Required Web PR/integration gates; docs 17, 18, 19, 20 | Web CI + release operator / automated | GitHub PR/integration CI; U7-G1 | All required jobs pass on the exact candidate or a synthetic merge whose tree is proven equal to the final candidate tree | Run URLs/IDs, job conclusions, tested SHA/tree comparison | Failure blocks closure and requires separate remediation |
| **U7-G3 Governed Lighthouse reference** | D20 current `main`; this spec §§5, 7.2 | Performance operator / automated with reviewed provenance | Governed non-production reference; SP-3, U7-G1 | Complete 96-audit matrix; every median and font/provenance rule passes; no infrastructure failure | Individual reports, summary, manifest, protocol proof, artifact hashes | Threshold failure blocks; missing/duplicate/corrupt/mixed-version evidence is infrastructure failure, not a result |
| **U7-G4 Automated accessibility** | docs 18, 21; WCAG 2.2 AA | Web CI + accessibility reviewer / automated | Exact candidate test/CI environments; U7-G1 | Playwright/axe, locale parity, RTL assertions, and Lighthouse Accessibility results all pass | Run IDs, reports, route/locale coverage | Any unresolved AA failure blocks and opens remediation |
| **U7-G5 Manual accessibility** | doc 21 and Central Docs D05-5 | Accessibility operator / manual | Version-recorded browser/AT/device environments; U7-G1, shipped-v1 journey reconciled | Keyboard EN/AR, NVDA+Firefox, VoiceOver+Safari, 200% zoom, reduced motion, and Arabic screen-reader/voice path accepted | Completed records using §7.3 schema | Automation cannot substitute; unresolved AA failure blocks |
| **U7-G6 Security policy compliance** | doc 19 D19-11; no waiver | Security operator + Web CI / automated + review | Exact lockfile/candidate; separate CI-gate remediation complete | Fresh full and production-only audits classified; every HIGH/CRITICAL chain disposed; required `npm audit --audit-level=high` PR/integration gate green | Commands/tool versions, raw reports, counts, dependency chains, dispositions, CI result | No reachability-based waiver; any required high+ failure blocks |
| **U7-G7 Canonical content reconciliation/readiness** | Owner-operated content contract in §6.3 | Owner + release operator / manual + automated plan | Governed deployed API/content environment; backup and authorization controls | Backup/migrations verified; plan reviewed; apply only if non-empty and explicitly authorized; second plan is zero; canonical EN/AR routes and protected counts verified | API SHA, backup proof, plan/no-op artifacts, canonical slugs, counts; authorization/apply artifacts when applicable | Missing authorization/evidence or non-zero second plan blocks; fixture slugs are never production acceptance routes |
| **U7-G8 Documentation/evidence/handoff consistency** | D16-8 as clarified by D16-13; this spec §§7.5, 9 | Release operator + independent reviewer / manual | All prior gates and closure prerequisites | Spec/tasks/ledger/evidence agree on one final candidate; remediation links and source synchronization are complete; handoff stands alone | Gate matrix, ledger closeout, artifact index, independent review, handoff | Any inconsistency or missing mandatory evidence blocks closure |

## 5. Governed Lighthouse contract

### 5.1 Reference environment

The hard reference uses **Governed GitHub-Hosted Reference Execution** on a standard GitHub-hosted
Linux runner. One acceptance attempt is one workflow job, one allocated runner, one captured
environment manifest and one complete comparable measurement set. Mobile and desktop execute
sequentially on that runner. Measurements from different jobs or runner allocations are never mixed;
runner or orchestration loss invalidates the partial attempt and restarts the whole attempt.

The job checks out the exact SHA, performs `npm ci`, builds production Nuxt/Nitro output, uses the
committed deterministic Prism/OpenAPI fixtures, starts the Nitro production server behind an
ephemeral local TLS/HTTP2 proxy, and proves document plus representative first-party assets negotiated
`h2` from Chrome's recorded network evidence. It retains raw reports, manifest, provenance, protocol
proof, summaries and SHA-256 checksums. Runner capacity is observed per attempt — OS/image, architecture,
CPU, logical cores, RAM, kernel, filesystem/disk and tool versions where available — and is never
described as dedicated or hardware-identical across runs. Public production remains diagnostic only;
an arbitrary developer workstation remains non-authoritative.

**Current status:** `GITHUB-HOSTED CALIBRATION INFRASTRUCTURE REQUIRED`. A bounded calibration may
characterize repeatability and one-job feasibility but is labelled `CALIBRATION ONLY — NOT FE5-U7
ACCEPTANCE EVIDENCE`; it does not freeze a candidate, run the 96-audit matrix or pass U7-G3.

### 5.2 Matrix and thresholds

The governed URL inventory contains 16 localized paths:

1. `/`
2. `/ar`
3. `/blog/test-article`
4. `/ar/blog/test-article`
5. `/projects`
6. `/ar/projects`
7. `/projects/content-platform-api`
8. `/ar/projects/content-platform-api`
9. `/experience`
10. `/ar/experience`
11. `/about`
12. `/ar/about`
13. `/resume`
14. `/ar/resume`
15. `/contact`
16. `/ar/contact`

The two `content-platform-api` paths are deterministic Prism/test fixtures for Lighthouse only, not
production content-acceptance routes. Each path runs desktop and mobile exactly three comparable
times: 16 × 2 × 3 = **96 audits**. The true median of three comparable reports is authoritative;
there is no invented worst-run blocker.

| Metric | Desktop | Mobile |
| --- | ---: | ---: |
| Performance | ≥ 95 | ≥ 60 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | ≤ 1,200 ms | ≤ 4,000 ms normally; `/ar` ≤ 5,000 ms; `/ar/projects` ≤ 5,500 ms |
| CLS | **< 0.05** | **< 0.05** |
| Arabic-script fonts | N/A on non-Arabic paths | ≤ 130 KiB (133,120 B) on Arabic paths |

The Arabic LCP exceptions are regression ceilings; 4,000 ms remains their quality target. Missing,
duplicate, corrupt, incomplete, or mixed-Lighthouse-version reports are infrastructure failures.
Central Docs defines strict `CLS < 0.05`, while the current Web summarizer compares every numeric
metric with `value <= limit` and its test explicitly accepts `0.05`. D20 is authoritative: an exact
0.05 median fails U7. Before governed execution, separately reconcile the instrument to the strict
policy and prove it with the required negative control; this definition changes neither threshold
nor implementation.

### 5.3 Provenance

Retain candidate SHA and tree, lockfile identity/hash, Node/npm/Lighthouse/Chrome versions,
reference-host identity, relevant CPU/capacity identity, build mode, upstream/data mode, HTTP
protocol proof, every individual report, summary artifact, and hashes for all retained artifacts.

## 6. Accessibility, security, and content contracts

### 6.1 Accessibility

Automated evidence includes Playwright/axe, locale-parity assertions, RTL assertions, and relevant
Lighthouse Accessibility results. Manual evidence includes keyboard-only EN and AR, NVDA+Firefox,
VoiceOver+Safari, 200% zoom, reduced-motion behavior, and an Arabic screen-reader/voice path. The
editorial journey under test is the shipped Markdown textarea flow:

`author → translate → preview → explicit save → publish/schedule`

Tiptap, timed/blur autosave, and autosave-survival assertions are deferred and must not be
reintroduced. Each manual record names environment versions, journey/route, locale, result,
applicable finding, WCAG reference, and disposition. Automation never substitutes for manual
evidence. Any unresolved WCAG 2.2 AA failure blocks closure.

### 6.2 Security

There is no U7 vulnerability waiver. Run a fresh full audit and a production-only audit against the
exact lockfile, classify every HIGH/CRITICAL chain, and require the full approved high+ PR/integration
CI gate to pass on the final candidate. Reachability is useful classification evidence, not an
automatic waiver. The missing Web enforcement is a separate **CI SECURITY GATE DEFECT** remediation
prerequisite. This definition changes neither CI nor packages, and current governance does not add a
`deploy.yml` audit requirement.

### 6.3 Canonical content reconciliation

This is a closure prerequisite, not a prerequisite to define U7. The owner-operated sequence is:

1. record exact deployed API SHA;
2. verify a restorable backup;
3. apply required migrations;
4. run `content:sync:plan -- --json`;
5. review the complete plan;
6. obtain explicit owner authorization before apply;
7. apply only if the plan is non-empty and authorized;
8. prove a second plan returns zero changes;
9. verify canonical EN/AR routes from the governed dataset;
10. prove protected operational counts are unchanged;
11. retain plan, apply, no-op, route, and count evidence.

No `content:sync` runs during this definition task.

## 7. Evidence schemas

### 7.1 Candidate manifest

Record commit SHA; tree SHA; `package-lock.json` hash; branch and base SHA; relevant PR and CI run;
freeze timestamp; operator; and a statement that the checkout/build was clean.

### 7.2 Lighthouse record

Record all §5.3 provenance; profile; requested/final URL; run ordinal; category scores; LCP; CLS;
Arabic-script font bytes where applicable; report hash/path; median selection; threshold verdict;
infrastructure verdict; and summary hash/path.

### 7.3 Manual accessibility record

Record candidate SHA/tree; date/operator; OS/device; browser/version; AT/version; viewport/zoom;
reduced-motion setting; route or journey; locale; expected behavior; result; finding ID and severity;
WCAG 2.2 reference; evidence location; disposition/remediation link; and retest result.

### 7.4 Security record

Record candidate and lockfile hash; audit command/tool/npm version; full versus production-only
scope; raw artifact path/hash; severity counts; every HIGH/CRITICAL dependency chain; fix/reachability
analysis; disposition/remediation reference; and final blocking CI gate run/result.

### 7.5 Content and closeout records

Content evidence records deployed API SHA, backup identity/restorability proof, migration state,
plan and no-op commands/artifact hashes; when the first plan is non-empty and an authorized apply
occurs, also record the owner authorization reference plus apply command/artifact hash. Record
canonical EN/AR slugs, route results, and before/after protected counts. Closeout records the final candidate SHA/tree,
U7-G1…G8 status matrix, artifact index and hashes, all remediation references, closure-prerequisite
status, source-consistency review, D16-8 sign-off, operator/reviewer, and final verdict.

## 8. Explicit out of scope

- Product feature implementation or unrelated refactors.
- Dependency, lockfile, security, or CI-workflow remediation itself.
- Purchasing or provisioning a dedicated reference VPS/VM; D20-43 explicitly requires neither.
- Tiptap, autosave, `/uses`, RSS, generated-OG feature work, command palette, or ordering controls.
- Issue #30, private Docs publication, API CJS→ESM migration, or FE5-U8/later implementation.
- `content:sync` execution in this definition task.
- `dev → main`, production deployment, production smoke as U7 closure, or production mutation.

## 9. D16-8 closeout for U7

Module-level implementation documentation is N/A while U7 changes no application module. U7-G8
still cannot pass until its authoritative SpecKit definition and executable tasks match actual
execution; the append-only ledger names the exact candidate; CI, Lighthouse, accessibility,
security, and content artifacts are referenced; failures/remediations are traceable; manual evidence
is retained; Central Docs and Web sources are consistent; and a standalone handoff is sufficient to
continue without chat history. If a remediation changes an application module, that remediation owns
its applicable Arabic module documentation before U7 resumes.

## 10. Exact completion condition

> **FE5-U7 becomes CLOSED / READY FOR PROMOTION only when every approved U7 acceptance gate has passing evidence bound to the exact final candidate SHA/tree, every closure prerequisite is discharged, and the D16-8 evidence/handoff closeout is complete. FE5-U7 does not promote `dev → main` and does not deploy production.**

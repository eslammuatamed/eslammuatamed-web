# FE5-U7 release-acceptance consistency checklist

**Use:** complete during U7 execution; unchecked at definition. Evidence belongs in governed retained
artifacts and the append-only ledger, not in chat history.

## Start control

- [ ] SP-1 and SP-3…SP-5 are evidenced before controlled start; the governed reference environment exists.
- [ ] U7-A01 discharges SP-2 before downstream evidence: the candidate manifest contains SHA, tree, lockfile hash, base, CI run, clean-tree proof, and freeze time.
- [ ] Evidence paths/schemas, operators, reviewers, and retention location are assigned.

## Boundary control

- [ ] No production promotion, deployment, smoke-as-closure, or data mutation leaked into U7.
- [ ] No failed gate was repaired inside acceptance; every remediation has separate authorization and traceability.
- [ ] No Tiptap/autosave, `/uses`, RSS, generated OG, command palette, ordering control, issue #30, API CJS→ESM, FE5-U8, or unrelated refactor entered scope.

## Evidence control

- [ ] U7-G1…U7-G8 each reference passing evidence for one exact final SHA/tree.
- [ ] Lighthouse has 96 valid audits, true medians of three, D20 thresholds including strict `CLS < 0.05`, full provenance, individual reports, summary, protocol proof, and hashes.
- [ ] Missing/duplicate/corrupt/mixed-version Lighthouse evidence is classified as infrastructure failure.
- [ ] Automated accessibility and every manual matrix row are retained separately; no automation substitutes for manual evidence.
- [ ] No unresolved WCAG 2.2 AA finding remains.
- [ ] Security includes full + production-only audit, exact lockfile, HIGH/CRITICAL dispositions, and a green blocking high+ PR/integration gate; no waiver exists.
- [ ] Content evidence includes API SHA, restorable backup, migrations, reviewed plan, zero second plan, canonical EN/AR slugs, and unchanged protected counts; owner authorization and apply artifacts exist only when the first plan was non-empty and an apply occurred.
- [ ] Fixture `content-platform-api` slugs appear only in deterministic test/Lighthouse context, never as production content evidence.

## Closeout control

- [ ] Start and closure prerequisites remain distinct.
- [ ] Spec, plan, tasks, ledger, artifact index, remediation links, and standalone handoff agree.
- [ ] Module documentation is N/A only if no application module changed; otherwise the responsible remediation supplied it.
- [ ] An independent read-only review found no unresolved consistency defect.
- [ ] The exact completion condition in `spec.md` §10 is reproduced without loosening.

# Contributing — branching & deployment (Web)

## Branches
- **`main`** — production, and the GitHub default branch. Every commit on `main` is deployed automatically (see below). Protected **by project policy**, not by GitHub (see the Free-plan note).
- **`dev`** — development / integration. Feature work lands here first, then promotes to `main`.

## Release freeze (fulfilled — lifted for this repository)
The Web release freeze was **fulfilled and lifted on 2026-07-27**, after Feature 007 closed — canonical rule **doc 17 §4 / D17-5**, deployment hold **doc 23 §3 / D23-18**. This is a lifecycle update to those decisions, not a new one: no threshold, budget, or release rule changed. The full rule and its lift record live in doc 17 / doc 23 and are **not restated here**.

Web changes therefore flow `feature → dev → main` exactly as described below. `main` still deploys automatically, but a commit only reaches `main` through an **explicitly approved promotion** — promoting `dev → main` remains an owner decision, never an automatic consequence of a green `dev`.

**This section describes this repository only.** `eslammuatamed-api` has an independent release state that must not be inferred from Web policy — consult doc 17 / doc 23 for the API.

## Normal flow
```
feature/<slug>   (branch from dev)
  → PR to dev → CI green → merge to dev
  → integration verification on dev
  → PR dev → main → owner merge
  → CI re-verifies the exact main SHA → automatic production deployment
```
- Source branches for `dev` PRs: `feature/*`, `fix/*`, `chore/*` (bots: `dependabot/*`, `renovate/*`).
- **Opening or updating a PR never deploys** and never sees production secrets.

## Hotfix flow
```
hotfix/<slug>   (branch from main)
  → PR to main → CI → owner merge → automatic production deployment
  → merge the hotfix back into dev
```

## Merge strategy & branch synchronization
- **Feature / fix / chore → `dev`:** **squash merge** (preferred) — keeps `dev` one complete commit per PR.
- **Promotion `dev` → `main`:** **merge commit** — never squash or rebase a `dev → main` promotion. A squash gives `main` a fresh commit with no shared ancestry to `dev`, leaving the branches content-identical but historically divergent.
- **After a successful `main` deployment** (and, for a `server-verification-required` promotion, after the predefined server checks pass): **fast-forward `dev` to the new `main` merge commit**, so `dev` and `main` share history at their tips.
- **Hotfixes** merged into `main` must be **merged back into `dev`** (a merge, not a squash) to keep the branches synchronized.
- **Never reset or force-push the shared `dev` branch**, and never recreate it.
- **A zero-file content diff is not sufficient** — `dev` and `main` must also share ancestry (`git merge-base --is-ancestor origin/main origin/dev` is true after a sync). This synchronization rule applies **independently per repository**; coordinated API/Web releases still go **API first, then Web**.

## Performance verification — governed Lighthouse (doc 20 §5.1, D20-25)

**One command, everywhere — and it is the only setup you need:**

```bash
npm ci
npm run lighthouse:ci  # THE canonical entry point — local, PR CI, dev push and dev→main promotion
```

That single command owns the whole lifecycle: it **builds the exact current head** (or reuses
`.output` when it already matches, so CI does not build twice), starts the Nitro preview and the
Prism contract mock, generates an ephemeral localhost certificate, brings up a local
**HTTPS/HTTP/2** frontend, **asserts the browser-facing protocol before** the expensive matrix runs,
collects the unchanged mobile and desktop matrices, **proves from Lighthouse's own artifacts that
Chrome measured over `h2`**, asserts the unchanged medians, then tears down every process, port and
key — on success, on failure and on Ctrl-C.

**Two protocol checks, because neither alone is enough.** The *preflight* asks the TLS layer what it
negotiated, before minutes of collection are spent — but it only proves what a Node client saw. The
*measured-session proof* reads `audits['network-requests']` out of every report and fails the run
unless Chrome negotiated `h2` for the document, the `/_nuxt/` JavaScript, and any first-party CSS or
fonts. That second check is load-bearing: the frontend deliberately still accepts HTTP/1.1 at the
socket (refusing it made Nitro's chunked responses hang), so only the measurement's own record can
prove the numbers came over `h2`. Third-party and `data:` requests are classified and reported
separately, never gated.

**Governed measurement requires a completely clean tree.** Before it builds anything,
`npm run lighthouse:ci` refuses if `git status --porcelain=v1 -z --untracked-files=all` reports
*anything*: staged changes, unstaged changes, untracked non-ignored files, conflicts, or dirty
submodules. This is a whole-tree rule rather than a list of watched directories on purpose — Nuxt
discovers sources by scanning (`app/components/`, `app/composables/`, `app/middleware/`,
`app/layouts/`, `app/pages/`, `server/`, …), so a file that was never `git add`-ed is compiled into
the build while HEAD does not contain it. A directory allowlist would be outflanked by the next
auto-discovery location; "the tree is clean" cannot be. Exclusions come from `.gitignore` alone,
never from provenance-specific exceptions.

**Builds carry a provenance marker.** `.output/.provenance.json` records the HEAD sha, the Git
**tree** sha, the `package-lock.json` hash, Node and npm versions, the governed build-mode
identifier, a hash of the allowlisted build-affecting environment, and a fingerprint of the built
output. The build timestamp is metadata only and is never compared. Before collection — and again
after it — the governed command re-verifies all seven properties. A build that fails is
**quarantined to `.output.quarantined-<sha>/`** and rebuilt, never silently relabelled. Every report
file is then bound by content hash in `.lighthouseci/provenance.json`, so a downloaded artifact is
traceable to an exact commit.

**Secrets never reach the marker.** Only allowlisted variable *names* and each one's presence
(`set` / `empty` / `absent` — a distinction that matters, since an empty `NUXT_PUBLIC_SITE_URL` is a
misconfiguration, not an unset one) are recorded. Values are hashed and never written or logged, and
anything outside the allowlist is not hashed at all.

**Why HTTP/2.** Production serves HTTP/2 (Cloudflare → Caddy → Nitro). The gate used to point
Lighthouse straight at Nitro over HTTP/1.1, whose six-connection limit serialises requests HTTP/2
multiplexes. Measured at Web `9876279` with byte-identical assets, that alone moved `/ar` from a
4441 ms LCP median to 3389 ms. **Nitro may stay HTTP/1.1 behind the frontend** — only what the
browser negotiates is governed.

**Requirements:** Node per `.nvmrc`/`package.json` engines, an installed Chrome/Chromium (CI's
`ubuntu-latest` ships one), and `openssl` on `PATH` for the ephemeral certificate. No production
credentials and no VPS access are needed.

**Ports and reports.** The preview uses `CI_PREVIEW_PORT`/`CI_MOCK_PORT` (default 3000/3001); the
HTTP/2 frontend takes an OS-assigned free port by default, overridable with `LH_H2_PORT`, so
parallel runs do not collide. Reports land in `.lighthouseci/mobile` and `.lighthouseci/desktop`.

**Certificates are never committed.** They are generated per run into the OS temp directory,
localhost-scoped, removed on exit, and `.gitignore` carries `*.pem` as a backstop. Chrome is given
`--ignore-certificate-errors-spki-list=<that key>` — trust for exactly this certificate, never a
blanket certificate-error bypass.

**Non-governed escape hatches.** `lhci:collect:*-nongoverned` and `lhci:assert-nongoverned` exist for
low-level debugging only. They are **not** the gate and CI never calls them. Two guards keep them
from quietly becoming a second methodology: `lighthouserc.cjs` throws unless `LH_BASE_URL` is set, so
running `lhci` by hand cannot reintroduce HTTP/1.1 measurement; and they refuse to run at all unless
`.output/` was built from the current head — unlike the governed command, they never build for you,
they just decline to measure the wrong commit.

**Diagnostic only:** Lighthouse against the public production domain. Real RTT and edge-cache state
make it non-deterministic, so it never gates a PR.

## Documentation & Handoff Gate (required before delivery)
Every feature's **final task** is the mandatory **Documentation & Handoff Gate** — canonical rule **doc 16 §5.1 / D16-8** ([`16-development-conventions.md`](../eslammuatamed-docs/docs/16-development-conventions.md)). Until it passes, the feature must **not** be pushed, PR'd, merged to `dev`, promoted to `main`, or deployed — "not requested" is never a reason to skip it. The Arabic module docs and SpecKit closeout are always required; other doc changes may be justified. The full rule lives in doc 16 and is **not restated here**.

## Development/demo seed data (required for data-backed flows)
Every feature that adds or changes a data-backed flow ships **deterministic development/demo seed data** before it is complete — canonical rule **doc 16 §5.2 / D16-9**, mechanics in **doc 09 §6 / D09-15**. For the web, the feature's backend + frontend integration is verified against the API development/demo seed (`npm run db:seed:dev` in `eslammuatamed-api`, run on top of `npm run db:seed`), on a **throwaway development/test database with an external temporary environment** — the real local `.env` is **never** read, overwritten, deleted, printed, or regenerated. Seed content is bilingual (`en` + `ar`), idempotent, and invents no facts or metrics. The full rule lives in doc 16 and is **not restated here**.

## Promotion cases — when `dev` → `main` is allowed
Code may be promoted from `dev` to `main` in **exactly two cases**:

**Case 1 — completed and verified work (the normal case).** The agreed scope is complete; all applicable unit/integration/E2E/contract/typecheck/lint/build checks pass; `dev` integration is green; documentation and configuration are accurate; no known blocker remains; the owner makes the final promotion decision.

**Case 2 — controlled server-environment verification.** Allowed only when the remaining behavior **genuinely cannot be validated outside the real server environment** (systemd/service behavior; Caddy/TLS/DNS/proxy/cookie/CORS integration; production filesystem permissions; production-compatible native binaries; real R2/S3 or other external integration; release symlink/cutover/rollback behavior; production build/runtime differences not reproducible locally or in CI). This is a controlled production verification, **not** permission to publish unfinished work. Before such a promotion: complete every test that can run locally or in CI; explain exactly why server validation is necessary; define the expected result, health/smoke checks, and rollback procedure; confirm the change is minimal, reversible, and involves no destructive database/storage operation (additive/fix-forward migrations only); hide or disable incomplete user-facing behavior where practical; and **mark the `dev → main` PR as a `server-verification-required` promotion** — the owner merging it is the authorization. After deployment: run the predefined checks immediately, monitor service/proxy logs, verify the exact deployed SHA; on failure use the documented rollback and fix on a branch from `dev` (never patch production directly); sync the result back through `dev`; record the outcome in the PR or ops documentation.

**Production is not a general testing environment.** Do not promote incomplete work because local testing is inconvenient. Stop and require a staging environment instead when server testing could damage or expose real data, require a destructive migration/reset/drop, interrupt production materially, expose incomplete or insecure functionality, send real external messages/transactions, alter existing R2 objects or user content unsafely, make rollback uncertain, or require experimenting with secrets/authentication.

## Automatic deployment (from green `main`)
- **Triggers (three, converging on one exact-SHA path):**
  - `push` to `main` — the **happy path** (a merged promotion or authorized push).
  - **Merged-PR fallback** — `deploy-fallback.yml` fires on `pull_request: closed` into `main` (merged only), validates the exact merge SHA against the current `main` tip, and dispatches `deploy.yml` with `target_sha`. It exists because the `push` event is **empirically dropped by GitHub at times** (proven in the trigger audit); the merged-PR event is delivered independently, so both events missing is far less likely than one. The dispatcher holds **no production secrets** and never runs PR-branch code.
  - `workflow_dispatch` — **manual recovery** / redeploy.
  - **No tags. No scheduled reconciliation** (Actions-minute cost on the Free plan, and schedules can themselves be delayed/dropped).
- **Idempotent duplicates:** when both the push and the fallback fire for the same SHA, the shared production concurrency group serializes them and a `preflight` job reads the live release SHA — one path **releases**, the other exits **already-current** with no server mutation. A stale SHA exits **superseded**. Main-tip lookups use the **git backend** (`ls-remote` + retries), not the REST API, which can lag or 503 during GitHub incidents.
- The `deploy` job cannot start unless the **same workflow run** re-verifies the **exact `github.sha`** — it does **not** rely only on the pre-merge PR checks (`needs: verify`). Before any server mutation it asserts `github.ref == refs/heads/main` **and** `HEAD == github.sha`.
- No manual approval gate (see Free-plan note).
- **Verification:** lint · typecheck · unit (Vitest) · production build · API-types idempotence (`api:types` over the committed `openapi/openapi.json`) · bundle-isolation · RTL logical-properties.
- **API-before-Web:** the deploy first checks the production API origin (`https://api.eslammuatamed.com/api/v1/health`) is healthy before cutting over.
- One deployment at a time (`concurrency: deploy-web-production`, never cancelled).

## Rollback
Each release is a self-contained `releases/<ts>` behind the `current` symlink. If the post-cutover health gate on **`/` and `/ar`** fails, the deploy **automatically rolls back** (repoints `current` to the previous release + `systemctl restart`). Manual form is in `.github/workflows/deploy.yml`.

## Coordinated API + Web releases
The repos deploy **independently**. For a cross-repo contract change: **deploy API `main` first**, verify its health + backward compatibility, **then** promote Web `main` — Web regenerates `app/types/api.d.ts` from the committed `openapi/openapi.json` (one atomic contract-adoption commit, doc 16 §3). Do not merge coordinated API + Web promotions simultaneously.

## ⚠️ Free-plan reality — branch policy is procedural, not GitHub-enforced
This is a **private repo on GitHub Free**: **branch protection, rulesets, and environment required-reviewers are unavailable**. Therefore:
- **Direct pushes to `main` are prohibited by policy, but GitHub will not block them** — always go through a PR.
- The CI **branch-policy guard is advisory**: it reports an unexpected promotion path but cannot block a merge.
- **Red PRs must not be merged** (procedural discipline).
- **Adding a second write collaborator requires upgrading to GitHub Pro/rulesets (for real branch protection) or a policy redesign first.** The current model assumes **`eslammuatamed` is the sole writer** — verified: sole admin, no other collaborators, no deploy keys, no webhooks, read-only default `GITHUB_TOKEN`.
- Do **not** use `[skip ci]` on a commit that reaches `main` — GitHub would skip the deploy workflow; recover with a `workflow_dispatch` run on `main`.

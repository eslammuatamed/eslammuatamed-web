# Feature Map — eslammuatamed-web (planning levels)

**L1 — Product & architecture:** `../eslammuatamed-docs/` (docs 00–24, all Approved).
**L2 — Features (this file):** numbered SpecKit features mapped to roadmap milestones
(doc 24). **L3 — Execution:** each feature's `spec.md` / `plan.md` / `tasks.md` under
`.specify/specs/NNN-*/`, implemented by Opus.

| # | Feature | Milestone | Scope (docs) | Status |
| --- | --- | --- | --- | --- |
| 001 | m1-foundation | M1 | Tokens + fonts (14), i18n/RTL shell, useApi + generated types, layouts + error page, home hero + blog slice via API, dashboard login (client-only), lint boundaries, CI | Planned |
| 002 | dashboard-cms | M3 | Shell + all content modules, Tiptap editor (Markdown-capped, D11-3), translation tabs, media library UI, SEO module incl. FR-DSH-052 global tags, messages inbox, roles & permissions management UI (FR-DSH-090) — docs 11/13 | Not started |
| 003 | public-site | M4 | All public pages (02 §3), full design implementation (03/13), SEO wiring (22: JSON-LD, hreflang, sitemap, RSS, OG), contact flow | Not started |
| 004 | launch-hardening | M5 | Budgets in CI (size-limit, forbidden-module, Lighthouse CI), a11y matrix fixes, field analytics wiring — docs 20/21/23 | Not started |

Rules: features execute in order; a feature is done when tasks are checked, tests green,
and both locales verified. Contract updates land only via the doc 16 §3 adoption flow.

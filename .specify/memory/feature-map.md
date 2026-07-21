# Feature Map — eslammuatamed-web (planning levels)

**L1 — Product & architecture:** `../eslammuatamed-docs/` (docs 00–24, all Approved).
**L2 — Features (this file):** numbered SpecKit features mapped to roadmap milestones
(doc 24). **L3 — Execution:** each feature's `spec.md` / `plan.md` / `tasks.md` under
`.specify/specs/NNN-*/`, implemented by Opus.

| # | Feature | Milestone | Scope (docs) | Status |
| --- | --- | --- | --- | --- |
| 001 | m1-foundation | M1 | Tokens + fonts (14), i18n/RTL shell, useApi + generated types, layouts + error page, home hero + blog slice via API, dashboard login (client-only), lint boundaries, CI | ✅ Shipped (M1 live 2026-07-15) |
| 002 | dashboard-cms | M3 | Shell + all content modules, Tiptap editor (Markdown-capped, D11-3), translation tabs, media library UI, SEO module incl. FR-DSH-052 global tags, messages inbox, roles & permissions management UI (FR-DSH-090) — docs 11/13 | Not started |
| 003 | public-home | M4 | **Home page** (FR-PUB-010…017): hero, tech stack, featured projects, experience summary, latest articles, testimonials, contact CTA + footer social/résumé/availability wiring; SEO (Person+WebSite JSON-LD via useSchemaOrg, standalone title, hreflang); both locales/RTL, WCAG 2.2 AA, graceful per-section degradation. Consumes the already-live F002 contract (no API change). Philosophy FR-PUB-015 deferred (D24-6). — docs 03/13/14/20/21/22 | 🧪 Implemented on `dev` (feature `003-public-home`) — pending Website/Homepage production release (Release Freeze D17-5). Doc-first: doc 24 v1.2.0 (D24-5/D24-6). |
| 004 | launch-hardening | M5 | Budgets in CI (size-limit, forbidden-module, Lighthouse CI), a11y matrix fixes, field analytics wiring — docs 20/21/23 | Not started |
| 005 | public-pages | M4 | Remaining public pages (02 §3, split from the original "public-site" per D24-5): `/projects` index + `/projects/{slug}` case study, `/experience`, `/about`, `/uses`, `/resume` (HTML + PDF), `/contact` form (FR-PUB-050 + anti-spam), full design (03/13), SEO wiring (22: JSON-LD, sitemap, RSS, OG). Unblocks home deep-links + production promotion (D24-5). | Not started |

Rules: features execute in order; a feature is done when tasks are checked, tests green,
and both locales verified. Contract updates land only via the doc 16 §3 adoption flow.

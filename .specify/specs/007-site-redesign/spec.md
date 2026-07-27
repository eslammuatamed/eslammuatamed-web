# Feature Specification: Site-wide Public Redesign (from first principles)

**Feature Branch**: `007-site-redesign` (off Web `dev` `fcb5500`)

**SpecKit ID**: `007-site-redesign` · **Milestone**: M4 (Public Site) · **Repo**: `eslammuatamed-web` (+ cross-repo: `eslammuatamed-docs` design decisions)

**Created**: 2026-07-21

**Status**: Implemented on `dev` (pending owner review; Release Freeze remains active)

**Input**: Owner directive — the Web-006 "Mirror" home was rejected as *not a genuinely new design*: it
improved the previous UI but remained an evolution of the same layout, not a portfolio built from first
principles. Treat 006 (Home, Mirror direction, Monolith mark, datum rules, section wrappers, header,
footer) as **rejected baseline**. Redesign the complete public-site visual system and the Home from
scratch; keep the real API integration and seeded data; keep both locales/RTL first-class; keep API/Web
main frozen; do not deploy.

---

## Context & Scope Boundary

The 006 home shipped the full section set wired to the live F002 + M1 contract, but its **composition**
was the problem: seven near-identical `eyebrow + title + hairline datum rule` blocks on one flat surface,
left-aligned throughout, a tiny Monolith glyph — a refined hairline-broadsheet reading as a generic
dev-portfolio template (fails doc 01 Pillar 4). Decision **D03-8** records the rejection.

This feature **rewrites the public visual layer from scratch**; that visual implementation is
**Web-only** and consumes the same contract as its frontend interface. The owner acceptance pass
also records the companion API availability-localization change (schema/migration/seed) in the API and
Docs repositories. It preserves the F016 §5.2 / D09-15 dev-seed governance rule. It redesigns the
**site-wide shell** (global frame, header, mobile nav,
active states, language + theme switchers, primary CTA, footer) and the **Home** from first principles,
and establishes **reusable primitives** for future public pages (web-005). The blog index is migrated to
the new primitives for site-wide coherence.

**Carried limitations (unchanged):** `/projects`, `/experience`, `/about`, `/contact`, `/resume` ship in
web-005 — links there 404 until then (accepted, as in 006). Availability is now localized by the
companion API change (D10-12); the Web continues to render the API value verbatim. FR-PUB-015
philosophy stays deferred (D24-6).

## Design Direction (the new visual concept)

**Type-led bilingual system whose art direction is the mirror.** The subject is a senior frontend engineer
whose own published thesis is *"RTL as Architecture, Not Translation"*; the design embodies it.

- **Type as hero** (no hero images in the data): a monumental bilingual **nameplate** — Latin display
  **Space Grotesk** + first-class Arabic display **Cairo** (`--text-mega`), over a Geist/Plex body register
  (D03-9, D14-6).
- **Ink/paper spread rhythm** (D03-10, D14-7): the page is a sequence of full-bleed spreads alternating a
  light "paper" ground with dark "ink" feature spreads and a subtle "lift" — real surface hierarchy, not a
  flat stack. Theme-aware via `.on-ink`.
- **Accent as plane/marker** (violet), not a hairline tick. Violet + zinc DNA **kept** (changing the hue
  would be the superficial move the owner ruled out — D03-8).
- **Mirror composition**: authored in logical properties so EN (LTR) and AR (RTL) are true mirror
  compositions. `.kicker` keeps the mono label register RTL-correct in one place.
- **Varied section compositions**: nameplate hero · ink capability grid · editorial work index · vertical
  timeline (the one place numbering/sequence is real) · reading list · pull quotes · closing ink contact
  plate. Numbering is **not** used as decoration.

## User Scenarios & Testing *(mandatory)*

1. **Identity in one view** — A visitor lands on `/` and, above the fold, sees who (monumental name), what
   level (role + value proposition), and availability (violet plane). Primary CTA = View work; secondary =
   Get in touch.
2. **A distinctive, senior read** — The page reads as a deliberate art-directed portfolio (type + surface
   rhythm + one accent), not a dashboard/SaaS template/AI-generated portfolio.
3. **Arabic is first-class** — `/ar` renders a true RTL mirror with the Cairo display nameplate; no
   letter-spacing on connected script; the layout inverts meaningfully (not a translated LTR layout).
4. **Graceful degradation** — Each section isolates its own fetch error (inline retry) and omits itself
   when empty; a settings failure shows the designed API-unavailable state without blanking the page.
5. **Both themes** — Light and dark both render the ink/paper hierarchy with AA contrast.
6. **Shell everywhere** — Header (with violet active nav + Contact plate), mobile overlay nav, and the
   colophon footer are consistent across Home and Blog.

## Requirements *(mandatory)*

- **FR-PUB-003** (shell): global frame, header (wordmark, nav w/ active state, résumé link, Contact CTA,
  language + theme switchers), considered mobile overlay nav, colophon footer (nav, social, availability,
  résumé, switchers, copyright). Reusable across public pages.
- **FR-PUB-010–017** (home): nameplate hero, capabilities, selected work, experience timeline, writing,
  endorsements, contact — all **data-driven** from the live contract; loading/empty/error states preserved.
- **Data**: keep the real API integration and seeded data (profile/settings, skills, experiences, projects,
  articles, testimonials, social/contact). No hardcoded UI arrays or decorative placeholders. Null-safe
  media (NuxtImg where a cover/avatar exists; typographic fallback otherwise).
- **NFR (release-blocking)**: WCAG 2.2 AA (semantic HTML, keyboard nav, visible focus, tap targets,
  contrast); full Arabic RTL; logical CSS properties only; light/dark; SSR correctness with **no hydration
  mismatch** and **no console errors**; standalone home title + canonical/hreflang + Person/WebSite JSON-LD;
  NuxtImg for images; CSS-first subtle motion with reduced-motion support; performance-conscious loading.

## Hard Rules & Decisions

- **HR-1** — The visual redesign is Web-owned and consumes the versioned contract; the companion API
  availability-localization change is tracked and verified in the API/Docs repositories.
- **HR-2** — 006 visual direction is **rejected** (D03-8); Monolith mark, datum rules, `UiSection`,
  `UiSectionHeader`, `UiBrandMark`, `UiDatumLabel`, `UiTechBadge`, and all 006 home/card components are
  **removed**, not restyled.
- **HR-3** — Violet + zinc DNA kept; composition/type/surface/signature re-conceived (D03-8).
- **HR-4** — `availabilityStatus` is resolved per locale by the companion API implementation (D10-12);
  Web renders the localized value without a frontend fallback.
- **HR-5** — Production Release Freeze holds: no promotion/deploy/dispatch or production config/DB/R2
  mutation; the owner-classified staging host may be reset/redeployed for seed-only verification.
- **HR-6** — Seed governance (D16-9 §5.2 / D09-15) preserved; verified against the existing dev seed.
- **HR-7** — Component tests rewritten to the new components (not deleted to green).

## Non-Goals

- Building `/projects`, `/experience`, `/about`, `/contact`, `/resume` (that is web-005).
- Building the remaining public routes. Any production promotion or deploy.
- Reimplementing API locale resolution in the Web client.

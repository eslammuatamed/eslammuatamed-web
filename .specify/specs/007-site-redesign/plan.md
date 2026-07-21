# Implementation Plan: Site-wide Public Redesign (007)

**Branch**: `007-site-redesign` (off Web `dev` `fcb5500`) · **Spec**: `./spec.md` · **Status**: Implemented on `dev`

## Approach

Prove the signature in pixels first (nameplate hero + one ink section, EN + AR, light + dark), critique it
against "could this be any dev portfolio?", then scale to the full system. Own the art direction directly;
delegate only mechanical work (tests, Arabic doc translation). Rewrite, don't patch — remove the 006
components rather than restyle them.

## Token layer (`app/assets/css/main.css`, `app.config.ts`) — D14-6/D14-7

- **Display register**: import Space Grotesk + Cairo (variable, self-hosted); `--font-display` /
  `--font-display-arabic` (generate `.font-display`); Arabic swap in one `@layer base` rule.
- **Scale**: add `--text-mega` (nameplate) with per-token line-height/weight/tracking; Latin tracking reset
  for Arabic on `.text-mega`.
- **Surfaces**: `.on-ink` re-points `--ui-*` for its subtree; theme-aware (light 50/elevated/950; dark
  950/900/800). Depth from borders + surface steps (D03-3), full-bleed spreads.
- **`.kicker`** utility: mono/uppercase/tracked in Latin; Plex/normal-case/normal-tracking under
  `html[lang="ar"]` (unlayered, beats the utilities layer). Plus a defensive `html[lang="ar"]
  [class*="tracking-"] { letter-spacing: normal }`.
- Keep violet + zinc (`app.config.ts` unchanged), prose surface, reduced-motion rule, `animate-rise`.

## Primitives (reusable for web-005)

- `ui/Spread.vue` — the page-frame primitive: `tone="paper|lift|ink"`, `ruled`, `as`; wraps
  `<section>` + `<UContainer>`; one vertical-rhythm token.
- `ui/SectionHead.vue` — kicker eyebrow + display title + optional `#action` slot (`accent` prop).
- Keep `ui/StateError.vue`, `ui/SectionSkeleton.vue`.
- Content entries: `content/WorkEntry.vue` (index row), `content/TimelineEntry.vue` (timeline + markdown
  impact bullets), `content/ArticleRow.vue` (reading-list row), `content/QuoteBlock.vue` (pull quote,
  null-safe avatar → monogram / NuxtImg). Keep `content/Prose.vue`.

## Home sections (`app/pages/index.vue` + `home/*`) — data-driven, state-isolated

Order and surface rhythm: Nameplate (paper) → Capabilities (**ink**) → SelectedWork (paper) → Timeline
(lift) → Writing (paper) → Voices (lift) → Contact (**ink**) → Footer (paper).

- `home/Nameplate.vue` — monumental name (`mega`), role kicker, value prop, CTAs, violet availability
  plane, baseline register (since-year datum + tech identity line). Name/tagline fall back to i18n.
- `home/Capabilities.vue` — ink spread; skills grouped by kind; brand-colour datum dots (the only tech
  colours).
- `home/SelectedWork.vue` — featured projects (cap 3) as `WorkEntry` index rows.
- `home/Timeline.vue` — current-first sort; `TimelineEntry` with impact bullets; violet current marker.
- `home/Writing.vue` — latest 3 articles as `ArticleRow` reading list (links live to `/blog/{slug}`).
- `home/Voices.vue` — testimonials as `QuoteBlock` pull quotes.
- `home/Contact.vue` — closing ink plate (verso of the hero): invitation + form CTA + mailto + scheme-safe
  social + availability echo.
- Redesigned API-unavailable fallback (kicker + display title + retry).

## Shell

- `layout/Header.vue` — display-font wordmark; custom nav with violet active marker (`aria-current`);
  résumé link + violet Contact plate; locale + theme switchers; considered full-panel mobile overlay
  (large display-font links) opening from the trailing edge in both directions (D15-3).
- `layout/Footer.vue` — colophon (honest build line) + repeated nav + scheme-safe social + availability +
  résumé + switchers + copyright. Degrades to nav shell when settings unavailable.
- Blog index migrated to `SectionHead` + `ArticleRow` for site-wide coherence.
- Install `@iconify-json/simple-icons` (the seed's social icon names resolve locally).

## Verification

- Visual matrix via browser: EN/AR × light/dark × desktop/tablet/mobile; header states; mobile nav
  (both locales); footer; all sections. Judge against "genuinely new, portfolio-quality" bar.
- Gates: `typecheck` (0 errors), `lint`, `test` (rewritten specs green), `build`, `check:bundle`,
  `check:logical`. SSR: no hydration mismatch, 0 console errors.

## Risks / carried

- `/projects` `/experience` `/about` `/contact` `/resume` 404 until web-005 (accepted).
- `availabilityStatus` English in `/ar` (schema decision, carried).
- No CSP (carried from prior features).

# Implementation Plan: Home Redesign, Seed Governance & Article Collection

**Feature**: `006-home-redesign` · **Repo**: `eslammuatamed-web` (+ api dev seed, docs governance)
**Base**: Web `dev` `d505f47` · **Status**: Draft → in progress · Release Freeze active (dev only)

---

## 1. Design approach — "Mirror" executed as an architectural technical-drawing

The brief is **brand-pinned** (brand-identity.md v2.0.2 + doc 03). We execute that language at a
higher compositional standard; we do not invent a new aesthetic. The thesis: the subject's rarest
proof is real bilingual/RTL engineering (owner Pillar 3), which the **Monolith mark** literally
encodes ("a form that stays itself when the world flips"). So the page reads like a precise
technical drawing — hairline datum rules, generous whitespace as material, one violet accent.

**Signature elements (used with restraint, one memorable idea):**
- **Monolith mark** (`UiBrandMark`) at architectural scale in the hero as a quiet, single-fill,
  monochrome structural anchor (brand §10 permits mark forms at architectural scale). Never
  gradient/glow/outline; low-contrast so it never competes with the name.
- **Datum hairline rules** (1 px `--ui-border`) that frame section joins and the hero — the Datum
  grid device (brand §5). This is a brand mandate, not the generic "broadsheet" default: it pairs
  with radius-bearing cards, generous whitespace (not dense columns), and the violet accent.
- **Locale-robust datum labels** (`UiDatumLabel`): a short mono coordinate/index (numerals + Latin
  only — mono has no Arabic glyphs, HR-3) beside a Plex/Geist eyebrow word, so the "technical
  drawing" register survives in both scripts.

**Rhythm (the core fix):** replace 7 identical blocks with a composed sequence —
1. **Hero** — full identity block: datum frame + mark + availability pill + display name + role
   ladder (JS→TS→Vue→Nuxt→Architecture→Node→Nest as a structural strip, honest ladder from
   owner-profile §2) + primary/secondary CTA. LCP = text + inline SVG.
2. **TechStack** — grouped, on the base surface, with datum group labels; brand-colour dots only.
3. **FeaturedProjects** — asymmetric: a lead datum header + a 3-card grid with index coordinates,
   year meta in mono, hover = border/surface-step elevation (no shadow-jump).
4. **ExperienceSummary** — a single subtle **elevated band** (`--ui-bg-elevated` via a section
   variant) for pacing, timeline with mono periods.
5. **LatestArticles** — redesigned cards (meta row mono date/reading-time, category, title,
   excerpt), 3 newest.
6. **Testimonials** — bounded linear grid, quote-rail cards.
7. **ContactCta** — closing datum frame + mark echo, form link + mailto fallback.
8. **Footer** — unchanged behaviour; light visual alignment to the datum system.

**Motion:** CSS-first only. Hero entrance = one opacity/translate reveal (≤320 ms, once), reduced-
motion → ≤120 ms opacity. Card hover = 120 ms border/bg. Loading = the brand mark opacity-pulse for
the API-unavailable/skeleton state (no geometry animation). No scroll-triggered/looping decoration.

## 2. New / changed primitives (components/ui — imports Nuxt UI only)

- **`UiBrandMark.vue`** (NEW): inline SVG of the Monolith (`viewBox="0 0 16 16"`, path
  `M2,6 H6 V2 H14 V10 H10 V14 H2 Z`), `currentColor` fill, `aria-hidden`, size prop. Single source of
  the mark for hero + contact + footer + loading state. (Encodes brand semantics → justified wrap,
  D12-2.)
- **`UiDatumLabel.vue`** (NEW): the locale-robust section eyebrow — optional mono index/coordinate
  (numerals/Latin) + eyebrow word (script-appropriate face) + optional trailing "view all" action +
  a hairline rule. Replaces the ad-hoc eyebrow markup repeated across sections; `as` prop keeps the
  heading level caller-controlled (a11y outline).
- **`UiSection.vue`** (NEW, thin): wraps `<section>` + `<UContainer>` and applies the rhythm —
  `variant: 'base' | 'elevated'` (surface step) and consistent `--space-section` block padding + an
  optional top datum rule. Keeps every section on one rhythm system while allowing pacing. Semantic
  wrap (encodes the page's section contract), not a restyle.
- **`UiSectionHeader.vue`** (KEEP or fold into `UiDatumLabel`): retain for compatibility; sections
  migrate to `UiDatumLabel`.
- `UiTechBadge`, `UiStateError`, `UiSectionSkeleton`: keep; `UiSectionSkeleton`/error may render the
  brand-mark pulse.

## 3. Section component changes (components/home + components/content)

Each `Home*` section keeps its **props-only presentational contract, three-state handling, and
NFR-DEGRADE isolation** (do not regress 003's data architecture). Only the template/composition and
supporting primitives change:
- `Hero.vue` — rebuilt identity composition (mark + ladder + availability + CTAs); still fed by
  `settings`; nullable siteName/tagline fall back to brand i18n.
- `TechStack.vue`, `FeaturedProjects.vue`, `ExperienceSummary.vue`, `LatestArticles.vue`,
  `Testimonials.vue`, `ContactCta.vue` — migrate to `UiSection` + `UiDatumLabel`, refined internal
  layout per §1. `ExperienceSummary` gets the elevated variant.
- `content/ProjectCard.vue`, `ArticleCard.vue`, `ExperienceItem.vue`, `TestimonialCard.vue` —
  restyle within the datum system; **preserve the single-accessible-link a11y pattern** and logical
  properties. Add a mono index/coordinate to project/article cards only if it encodes order.
- `index.vue` — orchestration unchanged (settings hard dep; useHomeData parallel); may add the
  positioning-ladder strip if kept in Hero.

## 4. Tokens / CSS (app/assets/css/main.css — semantic, no raw hex in components)

- Add at most: a `.section-elevated` surface helper (or drive via `UiSection` classes using existing
  `--ui-bg-elevated`), a `--rule` hairline helper if needed. Prefer existing tokens
  (`--ui-border`, `--ui-bg`, `--ui-bg-elevated`, `--space-section`, `--radius-card`, type scale).
- No new colour tokens (brand introduces none). Tech dots stay the sanctioned per-skill data colour
  (WD-4 carve-out). Keep CSS ≤30 KB gz.

## 5. i18n (i18n/locales/{en,ar}.json)

- Add/adjust keys for the ladder strip, datum eyebrows, any new labels. Arabic authored natively
  (register parity, doc 03 §7) — no machine translationese. Keep `seo.home.*` standalone title.

## 6. Cross-repo tracks

- **API dev seed** (`chore/006-home-seed`): §Requirements — owner-grounded identity (HR-8) + ≥12
  bilingual articles + tags; idempotent; dev-only; verified via clean-DB integration (external temp
  env; real `.env` untouched).
- **Docs governance**: D16-9 (doc 16 §5.x DoD + decision log + review note), D09-15 (doc 09 §6
  overlay documentation), CONTRIBUTING ×2 refs, tasks-template ×2 seed task.

## 7. Verification

- Web: `npm run typecheck && lint && test && build && check:bundle && check:logical`; `git diff
  --check`. Update the ~21 spec files to the new DOM (behaviour assertions, not brittle snapshots).
- API: `typecheck && lint && test && contract:export`; e2e if time permits (data-only change —
  contract unaffected).
- Integration: throwaway `eslammuatamed_test` DB + external temp `.env` (backup/restore trap or an
  env pointing at the test DB — never mutate the real `.env`); `db:seed` → `db:seed:dev` twice
  (idempotent); run web dev against it; browser check both locales × 3 breakpoints; screenshots;
  assert SSR content-complete, JSON-LD present, standalone title, hreflang, zero console/hydration
  errors, RTL mirrored, sections from seeded data, article order/localization.

## 8. Risks / mitigations

- **Perf budget** (no new deps, CSS-first) — mark is inline SVG (tiny); no motion lib. ✔
- **Test churn** — budget explicit tasks to update section/card specs. ✔
- **Arabic-in-mono trap** — HR-3 label device. ✔
- **`.env` safety** — external temp env only; never print/overwrite (feedback-never-touch-real-env).
- **Edit race with seed agent** — agent owns ARTICLES/TAGS; owner-identity edits (HR-8) applied
  after it finishes. ✔

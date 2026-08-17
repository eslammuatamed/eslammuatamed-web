// Pure formatting helpers via Intl — no date library (doc 12 §5). Western Arabic digits in both
// locales (D03-4), so the numbering system is pinned to `latn` even for `ar`.
export function formatDate(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', numberingSystem: 'latn' }).format(date)
}

// Month + year, for experience periods (FR-PUB-013). `latn` keeps digits Western in both locales.
export function formatMonthYear(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', numberingSystem: 'latn' }).format(date)
}

// Experience period "start – end" (or "start – <present>" for a current role). The dash renders in
// visual order via logical layout; the caller supplies the localized present label so this stays pure.
export function formatExperiencePeriod(
  start: string | Date,
  end: string | Date | null,
  locale: string,
  presentLabel: string
): string {
  const from = formatMonthYear(start, locale)
  const to = end ? formatMonthYear(end, locale) : presentLabel
  return `${from} – ${to}`
}

/**
 * Splits the contract's Markdown `impact` string into plain bullet lines.
 *
 * Lives here, beside `formatExperiencePeriod`, because BOTH experience presentations consume it —
 * `ContentTimelineEntry` (home + `/experience`) and `ResumeEntry` (`/resume`) — and they must never
 * disagree about what a bullet is. It was previously in `utils/resume.ts`, which made the timeline
 * pull the whole résumé helper module (skill grouping, résumé links, file sizes) into the home
 * page's closure for this one function; `format.ts` is already in every one of those closures, so
 * the shared definition costs nothing. A short list is split here rather than pulled through the
 * full prose renderer.
 */
export function impactBullets(impact: string | null | undefined): readonly string[] {
  return (impact ?? '')
    .split('\n')
    .map(line => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
}

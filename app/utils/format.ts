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

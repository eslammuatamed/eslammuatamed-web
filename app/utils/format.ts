// Pure formatting helpers via Intl — no date library (doc 12 §5). Western Arabic digits in both
// locales (D03-4), so the numbering system is pinned to `latn` even for `ar`.
export function formatDate(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', numberingSystem: 'latn' }).format(date)
}

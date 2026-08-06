import type { ProfileLink, SiteSettings, Skill } from '~/types/models'

/**
 * Pure résumé-composition helpers (FR-PUB-023/024). No component, no i18n, no fetch — every
 * localized string is passed in, so each of these is directly unit-testable and none of them
 * can invent content.
 */

/**
 * One skill group, in the API's group order, holding its skills in the API's `order`.
 *
 * `group` is the contract's ENUM (`LANGUAGE | FRONTEND | BACKEND | DELIVERY`), required and
 * never null — not free text. It is a token, not a label: rendering it directly would print
 * "FRONTEND" on both locales. The localized labels already exist at
 * `home.techStack.group.{GROUP}` and are reused rather than duplicated.
 */
export interface SkillGroup {
  readonly group: Skill['group']
  readonly skills: readonly Skill[]
}

/**
 * Groups skills for display **without reordering anything**.
 *
 * The API returns skills already sorted by `Skill.order` and drops any skill untranslated in
 * the requested locale (D10-6), so the sequence that arrives is the owner's curated one.
 * Group order is therefore taken from FIRST APPEARANCE in that sequence — not alphabetically,
 * not by the enum's declaration order — because sorting groups here would silently reimpose a
 * Web-side order on top of the registry order the owner controls in the CMS.
 */
export function groupSkills(skills: readonly Skill[]): readonly SkillGroup[] {
  const groups = new Map<Skill['group'], Skill[]>()
  for (const skill of skills) {
    const bucket = groups.get(skill.group)
    if (bucket) bucket.push(skill)
    else groups.set(skill.group, [skill])
  }
  return [...groups].map(([group, list]) => ({ group, skills: list }))
}

/**
 * The address a résumé prints.
 *
 * `professionalEmail` is documented in the contract as the CV/résumé/outreach address and
 * `contactEmail` as the website contact address. A résumé is outreach, so it takes the
 * professional one and **never falls back to `contactEmail`**: quietly printing the website's
 * general inbox on a CV would publish a different address than the one the owner governs for
 * hiring, and the fallback would be invisible. Null means the row is omitted (the 009 honest
 * -state philosophy: show nothing rather than something untrue).
 */
export function resumeEmail(settings: Pick<SiteSettings, 'professionalEmail'>): string | null {
  return settings.professionalEmail ?? null
}

/**
 * Public profile links, verbatim and in API order.
 *
 * Filters nothing by label and rewrites no URL — the owner's set is what prints. Entries
 * without a usable absolute URL are dropped rather than rendered as dead anchors.
 */
export function resumeLinks(links: readonly ProfileLink[] | undefined): readonly ProfileLink[] {
  return (links ?? []).filter(link => typeof link.url === 'string' && /^https?:\/\//i.test(link.url))
}

/**
 * Human-readable file size for the download action.
 *
 * Decimal units (kB/MB, powers of 1000), which is what file managers and browsers show for a
 * download. `latn` pins Western digits in both locales (D03-4), matching every other number on
 * the site. The unit strings are passed in already localized — this helper never guesses at
 * translation.
 *
 * Returns `null` for a non-finite or negative size so a malformed descriptor prints no size
 * rather than "NaN kB"; the download action itself still renders.
 */
export function formatFileSize(
  bytes: number,
  locale: string,
  units: { readonly kb: string, readonly mb: string }
): string | null {
  if (!Number.isFinite(bytes) || bytes < 0) return null
  const useMb = bytes >= 1_000_000
  const value = useMb ? bytes / 1_000_000 : bytes / 1000
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: useMb ? 1 : 0,
    numberingSystem: 'latn'
  }).format(value)
  return `${formatted} ${useMb ? units.mb : units.kb}`
}

/**
 * Splits the contract's Markdown bullet string into plain lines.
 *
 * Mirrors `ContentTimelineEntry` exactly rather than pulling the full prose renderer in for a
 * short list. Shared here so the résumé and the timeline can never disagree about what a
 * bullet is — the same impact string yields the same bullets on both pages.
 */
export function impactBullets(impact: string | null | undefined): readonly string[] {
  return (impact ?? '')
    .split('\n')
    .map(line => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
}

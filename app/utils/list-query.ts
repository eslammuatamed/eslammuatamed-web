import type { LocationQuery } from 'vue-router'

/**
 * Query rules shared by every paginated public listing (D13-4).
 *
 * `readPage` lives here rather than in `projects-query.ts` or `blog-query.ts` because BOTH need it and
 * Nuxt auto-imports the whole of `app/utils`. Defining it twice made Nuxt pick one and silently ignore
 * the other ("Duplicated imports 'readPage' … has been ignored"); the two copies happened to be
 * identical, so the behaviour was accidentally correct and would have stayed correct only until one of
 * them changed. One definition removes the ambiguity instead of relying on the copies staying in step.
 *
 * The FILTER rules are deliberately NOT shared: a Skill slug is locale-independent and a Category slug
 * is per-locale (D04-2), which is a real behavioural difference at exactly the point a shared
 * abstraction would hide it.
 */

/**
 * Read the current page, defaulting to 1 for absent, malformed, or out-of-range values.
 *
 * A malformed page is corrected rather than rejected: `?page=abc` and `?page=-2` are addresses a
 * visitor can reach by editing a URL, and answering them with the first page is more useful than an
 * error page — while `page=1` is still never EMITTED, so one page of content keeps one URL.
 */
export function readPage(query: LocationQuery): number {
  const value = Number(query.page)
  return Number.isInteger(value) && value > 0 ? value : 1
}

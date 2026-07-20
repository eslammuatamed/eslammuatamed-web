/**
 * Preview routes carry locale in the i18n path (`/preview/**` = en, `/ar/preview/**` = ar), like the
 * rest of the site. The preview contract also allows an OPTIONAL `?locale=` query on the minted link
 * (D10-11); honour it by normalising it into the path exactly once, so the route locale stays the
 * single source of truth for chrome, `<html dir>`, and the API `?locale=`. The token is preserved;
 * the now-redundant `locale` query is dropped.
 *
 * The `/ar` prefix is fixed by the i18n config (`defaultLocale: 'en'`, `strategy: prefix_except_default`),
 * so the target is derived from the path alone — no router/i18n runtime state, no redirect loop.
 */
export default defineNuxtRouteMiddleware((to) => {
  const raw = to.query.locale
  const requested = Array.isArray(raw) ? raw[0] : raw
  if (requested !== 'en' && requested !== 'ar') return

  const isArPath = /^\/ar(?=\/|$)/.test(to.path)
  if (requested === 'ar' && isArPath) return
  if (requested === 'en' && !isArPath) return

  const bare = to.path.replace(/^\/ar(?=\/|$)/, '')
  const target = requested === 'ar' ? `/ar${bare}` : (bare || '/')

  const { locale: _omit, ...keep } = to.query
  return navigateTo({ path: target, query: keep })
})

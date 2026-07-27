import type {
  ArticleListItem,
  Envelope,
  Experience,
  Paginated,
  ProjectListItem,
  Skill,
  Testimonial
} from '~/types/models'

// Home page section data (FR-PUB-011…016). Each section is its own `useAsyncData` keyed by locale:
// they load in parallel, and — critically — each captures its own failure into `.error` instead of
// rejecting the page, so one dead endpoint degrades only its section (NFR-DEGRADE, doc 13 §2). Nuxt
// awaits every in-flight asyncData promise before serializing the SSR payload, so first paint stays
// content-complete without any manual `await` here (doc 20 §2). Locale is injected by `useApi` (D10-6).
export function useHomeData() {
  const api = useApi()
  const { locale } = useI18n()

  // Reactive per-locale keys + `watch:[locale]` re-run each fetch on a client-side locale switch,
  // matching the blog/index idiom (code-review WD-6). The home page already remounts per locale, so
  // this is belt-and-suspenders here, but it keeps the sections robust if the page ever becomes
  // persistent and consistent with useSiteSettings.

  // perPage 6 gives headroom to pick the top 3 featured from the featured-first order (D09-8);
  // the section filters `featured` and slices client-side.
  const projects = useAsyncData(
    () => `home:projects:${locale.value}`,
    () => api<Paginated<ProjectListItem>>('/projects', { query: { perPage: 6 } }).then(r => r.data),
    { watch: [locale] }
  )

  const skills = useAsyncData(
    () => `home:skills:${locale.value}`,
    () => api<Envelope<Skill[]>>('/skills').then(r => r.data),
    { watch: [locale] }
  )

  const experiences = useAsyncData(
    () => `home:experiences:${locale.value}`,
    () => api<Envelope<Experience[]>>('/experiences').then(r => r.data),
    { watch: [locale] }
  )

  const articles = useAsyncData(
    () => `home:articles:${locale.value}`,
    () => api<Paginated<ArticleListItem>>('/articles', { query: { perPage: 3 } }).then(r => r.data),
    { watch: [locale] }
  )

  const testimonials = useAsyncData(
    () => `home:testimonials:${locale.value}`,
    () => api<Envelope<Testimonial[]>>('/testimonials').then(r => r.data),
    { watch: [locale] }
  )

  return { projects, skills, experiences, articles, testimonials }
}

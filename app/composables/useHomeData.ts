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
  const suffix = locale.value

  // perPage 6 gives headroom to pick the top 3 featured from the featured-first order (D09-8);
  // the section filters `featured` and slices client-side.
  const projects = useAsyncData(
    `home:projects:${suffix}`,
    () => api<Paginated<ProjectListItem>>('/projects', { query: { perPage: 6 } }).then(r => r.data)
  )

  const skills = useAsyncData(
    `home:skills:${suffix}`,
    () => api<Envelope<Skill[]>>('/skills').then(r => r.data)
  )

  const experiences = useAsyncData(
    `home:experiences:${suffix}`,
    () => api<Envelope<Experience[]>>('/experiences').then(r => r.data)
  )

  const articles = useAsyncData(
    `home:articles:${suffix}`,
    () => api<Paginated<ArticleListItem>>('/articles', { query: { perPage: 3 } }).then(r => r.data)
  )

  const testimonials = useAsyncData(
    `home:testimonials:${suffix}`,
    () => api<Envelope<Testimonial[]>>('/testimonials').then(r => r.data)
  )

  return { projects, skills, experiences, articles, testimonials }
}

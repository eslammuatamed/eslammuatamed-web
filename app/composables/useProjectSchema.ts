import type { ProjectDetail } from '~/types/models'
import type { Crumb } from '~/components/ui/Breadcrumbs.vue'

/**
 * Structured data for a case study (doc 22 §4): `CreativeWork` + `BreadcrumbList`.
 *
 * Emitted through `useSchemaOrg` like `useSiteSchema`, so the whole graph has one source of truth and
 * the page cannot drift from it. `CreativeWork` has no `define*` helper in @unhead/schema-org (unlike
 * Article/WebPage), so the node is declared literally — the composable accepts raw nodes and still
 * resolves `@id`/`@context` and links them into the graph.
 *
 * The breadcrumb list mirrors the VISIBLE trail exactly: both are built from the same `crumbs` array, so
 * the markup and the structured data cannot disagree — which is the failure mode search engines
 * penalise.
 *
 * Each NODE is a `computed`, so the graph re-resolves as the async project data lands. (It is not
 * "every field is a getter" — that reading was already inaccurate, and the schema-org typing rejects
 * a getter for the array-valued fields outright.)
 */
export function useProjectSchema(
  project: Ref<ProjectDetail | null | undefined>,
  crumbs: Ref<readonly Crumb[]>
) {
  // `locale` is captured HERE, in setup. Calling useI18n() inside the reactive getter below would run
  // outside a setup context and throw MUST_BE_CALL_SETUP_TOP, which silently drops the whole node —
  // the page rendered with zero JSON-LD until this was caught in the rendered output.
  const { t, locale } = useI18n()
  const siteConfig = useSiteConfig()
  const localePath = useLocalePath()

  const absolute = (path: string) => `${siteConfig.url}${localePath(path)}`

  // One computed per NODE — see `useSiteSchema` for why neither a whole-list getter nor a whole-list
  // `computed()` is correct. `CreativeWork` has no `define*` helper, so it stays a plain object
  // inside its computed; the composable accepts raw nodes either way.
  useSchemaOrg([
    computed(() => ({
      '@type': 'CreativeWork',
      'name': project.value?.title,
      'headline': project.value?.title,
      'description': project.value?.metaDescription || project.value?.summary,
      // `about` is the technology set — the subject matter of the case study, drawn from the Skills
      // registry rather than free text (doc 04 §5).
      'about': (project.value?.technologies ?? []).map(technology => technology.label),
      'author': { '@type': 'Person', 'name': t('brand.name') },
      // `year` is the only date the contract carries; it is not a publication timestamp, so it is
      // expressed as the copyright year rather than invented into a full `datePublished`.
      'copyrightYear': project.value?.year ?? undefined,
      'inLanguage': locale.value,
      'url': project.value ? absolute(`/projects/${project.value.slug}`) : undefined
    })),
    computed(() => defineBreadcrumb({
      itemListElement: crumbs.value.map(crumb => ({
        name: crumb.label,
        // The current page has no `to`; schema-org omits `item` for the last entry, which is correct.
        item: crumb.to ? absolute(crumb.to) : undefined
      }))
    }))
  ])
}

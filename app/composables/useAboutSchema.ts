import type { SiteSettings } from '~/types/models'
import type { Crumb } from '~/components/ui/Breadcrumbs.vue'

/**
 * Structured data for `/about` — the primary `ProfilePage` (D22-8, doc 22 §4).
 *
 * D22-8 is explicit that the page's `mainEntity` is **the existing site-wide `Person` identity, not a
 * second, parallel person**, and that duplicate `Person` entities with contradictory job titles or
 * emails are never emitted. Two consequences shape this composable:
 *
 * 1. `Person` is declared here with the SAME data source as `useSiteSchema()` — the Site Settings
 *    tagline drives `jobTitle`, so a positioning change propagates as data with no code edit (D22-8).
 *    Because schema-org keys every `Person` to `{host}#identity`, this resolves to the one identity
 *    node rather than a second one; the graph for this page contains exactly one `Person`.
 * 2. `ProfilePage.mainEntity` points at that node by `@id` instead of nesting a person object, which
 *    is what keeps it a reference rather than a duplicate.
 *
 * `email` and `image` are attached only when the API actually carries them. An unpublished portrait
 * must not become an `image` pointing nowhere — the same reason no `ogImage` is emitted.
 *
 * `knowsAbout` is deliberately absent. D22-8 names the portrait, the tagline (→ `jobTitle`), the
 * professional email and the profile links as this schema's data sources; the skill registry is not
 * among them, and fetching `/skills` here purely to enrich the graph would add a request and route
 * weight to About for no stated requirement. `jobTitle` and `email` — the two fields D22-8 forbids
 * contradicting — come from the same Site Settings source the home identity uses, so they agree.
 *
 * Canonical, hreflang/x-default, `og:locale` and `og:url` are NOT written here: `@nuxtjs/i18n` owns
 * every locale-derived head tag under strict SEO (D22-7), and a second writer is how finding F-3
 * happened.
 */
export function useAboutSchema(
  settings: Ref<SiteSettings | null | undefined>,
  crumbs: Ref<readonly Crumb[]>
) {
  // Captured in setup, never inside the reactive getter below: calling useI18n() there runs outside a
  // setup context and throws MUST_BE_CALL_SETUP_TOP, which silently drops the whole node — the
  // failure mode already documented on useProjectSchema.
  const { t } = useI18n()
  const siteConfig = useSiteConfig()
  const localePath = useLocalePath()

  const absolute = (path: string) => `${siteConfig.url}${localePath(path)}`

  // schema-org keys Person to `{host}/#identity` — note the SLASH: it resolves the host with a
  // trailing slash before appending its `IdentityId` fragment. Concatenating `${siteConfig.url}` and
  // `#identity` directly yields `https://host#identity`, which is a DIFFERENT IRI and leaves
  // `mainEntity` dangling — a reference to nothing, which is worse than the duplicate Person D22-8
  // forbids, because it looks correct. The e2e graph assertion is what catches this.
  const identityId = computed(() => `${siteConfig.url.replace(/\/+$/, '')}/#identity`)

  useSchemaOrg(() => [
    definePerson({
      name: settings.value?.siteName ?? t('brand.name'),
      jobTitle: settings.value?.tagline ?? t('brand.role'),
      sameAs: (settings.value?.profileLinks ?? []).map(link => link.url),
      email: settings.value?.professionalEmail ?? undefined,
      image: settings.value?.portrait?.url ?? undefined
    }),
    defineWebPage({
      '@type': 'ProfilePage',
      'name': t('about.title'),
      'description': t('seo.about.description'),
      'mainEntity': { '@id': identityId.value }
    }),
    defineBreadcrumb({
      itemListElement: crumbs.value.map(crumb => ({
        name: crumb.label,
        // The current page carries no `to`; schema-org omits `item` for the last entry, correctly.
        item: crumb.to ? absolute(crumb.to) : undefined
      }))
    })
  ])
}

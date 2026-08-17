import type { SiteSettings, Skill } from '~/types/models'

// Person + WebSite structured data for the home page (doc 22 §4). Built from API data through
// `useSchemaOrg` (@nuxtjs/seo) so the graph has one source of truth and cannot drift from the page.
// `sameAs` = the settings profile links; `knowsAbout` = the skill labels. Person is the branded-search
// payload (D22-1). Field getters keep it reactive as the async settings/skills resolve.
export function useSiteSchema(
  settings: Ref<SiteSettings | null | undefined>,
  skills: Ref<Skill[] | null | undefined>
) {
  const { t } = useI18n()

  // ONE COMPUTED PER NODE, not one getter around the whole list, and not one ref around it either.
  // `UseSchemaOrgInput` is `Arrayable<MaybeRef<…>>`: the ARRAY may hold refs, but is not itself one.
  // That distinction is load-bearing, and is why the two shorter forms are both wrong here:
  //
  //   `useSchemaOrg(() => [ … ])`  — the old form. A bare function is not `MaybeRef`, and it only
  //     ever typechecked because the unhead-v2 vendor's `Record<string, any>` admitted a function.
  //     The v3 vendor tightened that to `Record<string, unknown>`, closing the hole.
  //   `useSchemaOrg(computed(() => [ … ]))` — types fine, and is SILENTLY WRONG on the server: the
  //     Nuxt wrapper does `isRef(input) && import.meta.server ? toValue(input) : …`, snapshotting the
  //     whole list during setup. MEASURED, not assumed: it emits `knowsAbout: []` on `/`, because
  //     `useHomeData()` deliberately does not await `skills` (NFR-DEGRADE, parallel fetch).
  //
  // Per-node computeds keep the array a plain array, so the wrapper passes it through untouched and
  // unhead resolves each node at head-render time — after the async data lands. Field-level getters
  // are NOT an option: `DeepResolvableProperties` maps object-valued fields to
  // `DeepResolvableProperties<T[K]>` rather than `ResolvableValue<T[K]>`, so it rejects a getter for
  // exactly the array fields that need one (`sameAs`, `knowsAbout`).
  useSchemaOrg([
    computed(() => defineWebSite({
      name: settings.value?.siteName ?? t('brand.name')
    })),
    computed(() => definePerson({
      name: settings.value?.siteName ?? t('brand.name'),
      jobTitle: singleLineTitle(settings.value?.tagline ?? t('brand.role')),
      sameAs: (settings.value?.profileLinks ?? []).map(link => link.url),
      knowsAbout: (skills.value ?? []).map(skill => skill.label)
    }))
  ])
}

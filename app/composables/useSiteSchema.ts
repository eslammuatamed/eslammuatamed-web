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

  // The whole node list is a reactive getter (like `useHead(() => …)`), so it re-resolves as the async
  // `settings`/`skills` land and on a locale change. Inside the getter every field is a plain resolved
  // value — schema-org's DeepResolvable typing rejects a getter/Ref for array-valued fields (`sameAs`,
  // `knowsAbout`) but accepts a plain `string[]`, which this form supplies.
  useSchemaOrg(() => [
    defineWebSite({
      name: settings.value?.siteName ?? t('brand.name')
    }),
    definePerson({
      name: settings.value?.siteName ?? t('brand.name'),
      jobTitle: singleLineTitle(settings.value?.tagline ?? t('brand.role')),
      sameAs: (settings.value?.profileLinks ?? []).map(link => link.url),
      knowsAbout: (skills.value ?? []).map(skill => skill.label)
    })
  ])
}

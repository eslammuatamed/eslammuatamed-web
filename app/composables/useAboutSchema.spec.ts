// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { SiteSettings, Skill } from '~/types/models'
import { useAboutSchema } from './useAboutSchema'
import { useSiteSchema } from './useSiteSchema'

/**
 * D22-8's binding constraint is a NEGATIVE one: `/about` must not emit a second `Person` whose job
 * title or email contradicts the site-wide identity. Both composables happen to read the same
 * expression today, so reading them proves nothing — the guard has to be an assertion that fails the
 * moment one of them starts building its own title.
 *
 * The tagline fed in below carries the APPROVED LINE BREAK (positioning-strategy v2.0.0 §2). That is
 * the case where the two could silently diverge: one consumer flattening it and the other not still
 * looks correct in isolation, and `Person.jobTitle` is read by machines as plain text.
 */
const captured = vi.hoisted(() => ({ nodes: [] as Record<string, unknown>[] }))

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => `t:${key}`,
  locale: ref('en')
}))
mockNuxtImport('useSiteConfig', () => () => ({ url: 'https://example.com' }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)
mockNuxtImport('useSchemaOrg', () => (input: unknown) => {
  const nodes = typeof input === 'function' ? (input as () => unknown[])() : (input as unknown[])
  captured.nodes.push(...(nodes as Record<string, unknown>[]))
})
mockNuxtImport('definePerson', () => (input: unknown) => ({ '@type': 'Person', ...(input as object) }))
mockNuxtImport('defineWebSite', () => (input: unknown) => ({ '@type': 'WebSite', ...(input as object) }))
mockNuxtImport('defineWebPage', () => (input: unknown) => input)
mockNuxtImport('defineBreadcrumb', () => (input: unknown) => ({ '@type': 'BreadcrumbList', ...(input as object) }))

// The approved value, break included — this is what the CMS actually stores (§2).
const TAGLINE = 'Full-Stack JavaScript\nProduct Engineer'

const SETTINGS = {
  siteName: 'Eslam Muatamed',
  tagline: TAGLINE,
  professionalEmail: 'hello@eslammuatamed.com',
  profileLinks: [{ label: 'GitHub', url: 'https://github.com/eslammuatamed', icon: 'i-simple-icons-github' }],
  portrait: null
} as unknown as SiteSettings

async function run(fn: () => void) {
  await mountSuspended(defineComponent({ setup: () => (fn(), () => h('div')) }))
}

function people() {
  return captured.nodes.filter(node => node['@type'] === 'Person')
}

beforeEach(() => {
  captured.nodes = []
})

describe('Person.jobTitle across / and /about (D22-8)', () => {
  it('resolves to the same single-line governed title on both routes', async () => {
    const settings = ref<SiteSettings | null>(SETTINGS)

    await run(() => useSiteSchema(settings, ref<Skill[]>([])))
    await run(() => useAboutSchema(settings, computed(() => [{ label: 'Home', to: '/' }, { label: 'About' }])))

    const titles = people().map(person => person.jobTitle)

    expect(titles).toHaveLength(2)
    expect(titles[0]).toBe('Full-Stack JavaScript Product Engineer')
    // Agreement, asserted rather than assumed: a surface that hard-codes its own title fails here.
    expect(titles[1]).toBe(titles[0])
    expect(String(titles[1])).not.toContain('\n')
  })

  it('falls back to the committed brand role on both routes when settings are absent', async () => {
    const settings = ref<SiteSettings | null>(null)

    await run(() => useSiteSchema(settings, ref<Skill[]>([])))
    await run(() => useAboutSchema(settings, computed(() => [{ label: 'About' }])))

    const titles = people().map(person => person.jobTitle)

    // Same fallback key on both — a Settings outage must not make the two identities disagree.
    expect(titles).toEqual(['t:brand.role', 't:brand.role'])
  })
})

describe('useAboutSchema — ProfilePage references the one identity', () => {
  it('emits exactly one Person and points mainEntity at it by @id', async () => {
    const settings = ref<SiteSettings | null>(SETTINGS)

    await run(() => useAboutSchema(settings, computed(() => [{ label: 'Home', to: '/' }, { label: 'About' }])))

    expect(people()).toHaveLength(1)

    const profile = captured.nodes.find(node => node['@type'] === 'ProfilePage')
    expect(profile).toBeDefined()
    // The trailing-slash trap documented on the composable: schema-org keys Person to `{host}/#identity`,
    // so a reference built without the slash is a DIFFERENT IRI and leaves mainEntity dangling.
    expect(profile!.mainEntity).toEqual({ '@id': 'https://example.com/#identity' })
  })

  it('describes the page with the governed About description, not a hard-coded string', async () => {
    const settings = ref<SiteSettings | null>(SETTINGS)

    await run(() => useAboutSchema(settings, computed(() => [{ label: 'About' }])))

    const profile = captured.nodes.find(node => node['@type'] === 'ProfilePage')
    expect(profile!.description).toBe('t:seo.about.description')
  })
})

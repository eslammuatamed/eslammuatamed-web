// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import type { Experience, MediaPdf, SiteSettings, Skill } from '~/types/models'
import ResumePage from './resume.vue'

/**
 * Page-level coverage for the state × locale combinations the browser lanes cannot reach.
 *
 * `t` resolves against the REAL locale files, so an assertion fails if a string is missing,
 * empty, or accidentally English on the Arabic route — key parity proves the keys exist, not
 * that the Arabic copy reaches the DOM, and the latter is the binding web-005 constraint.
 */
const holder = vi.hoisted(() => ({
  i18n: null as unknown,
  resumeData: null as unknown,
  localePath: null as unknown
}))

mockNuxtImport('useI18n', () => () => holder.i18n)
mockNuxtImport('useResumeData', () => () => holder.resumeData)
mockNuxtImport('useSiteConfig', () => () => ({ url: 'https://example.com' }))
mockNuxtImport('useLocalePath', () => () => holder.localePath)
mockNuxtImport('useSchemaOrg', () => () => undefined)
mockNuxtImport('defineBreadcrumb', () => (input: unknown) => input)
mockNuxtImport('useSeoMeta', () => () => undefined)

const localeFile = (code: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${code}.json`), 'utf8')) as Record<string, unknown>
const messages: Record<string, Record<string, unknown>> = { en: localeFile('en'), ar: localeFile('ar') }
const locale = ref<'en' | 'ar'>('en')

/** Namespaces this page owns. A miss inside one is a real defect and throws. */
const OWNED = ['resume.', 'seo.resume.', 'nav.', 'common.', 'brand.', 'home.experience.', 'home.techStack.group.', 'experience.technologiesLabel']

function translate(key: string, params: Record<string, unknown> = {}): string {
  const resolved = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages[locale.value])
  if (typeof resolved !== 'string') {
    if (OWNED.some(prefix => key.startsWith(prefix))) {
      throw new Error(`missing ${locale.value} message: ${key}`)
    }
    return key
  }
  return resolved.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}

const settingsState = { data: ref<SiteSettings | null>(null), error: ref<Error | null>(null), refresh: vi.fn() }
const experiencesState = { data: ref<Experience[] | null>([]), error: ref<Error | null>(null), refresh: vi.fn() }
const skillsState = { data: ref<Skill[] | null>([]), error: ref<Error | null>(null), refresh: vi.fn() }

holder.i18n = { t: translate, locale }
holder.resumeData = { settings: settingsState, experiences: experiencesState, skills: skillsState }
holder.localePath = (path: string) => (locale.value === 'ar' ? `/ar${path}` : path)

const stubs = {
  UContainer: { template: '<div class="resume-page"><slot /></div>' },
  // Mirrors the real UButton's polymorphism: an anchor when `to` is set, a button otherwise —
  // which is what distinguishes the PDF download from the print control.
  UButton: {
    template: '<a v-if="to" :href="to"><slot /></a><button v-else><slot /></button>',
    props: ['to', 'variant', 'color', 'icon', 'external', 'download']
  },
  UiBreadcrumbs: { template: '<nav />', props: ['items', 'label'] }
}

const pdf: MediaPdf = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  kind: 'PDF',
  url: 'https://media.eslammuatamed.com/media/8f0a/eslam-muatamed-resume.pdf',
  filename: 'eslam-muatamed-resume.pdf',
  sizeBytes: 97805
}

const settings = (overrides: Partial<SiteSettings> = {}): SiteSettings =>
  ({
    siteName: 'Eslam Muatamed',
    tagline: 'JavaScript Product Engineer — Frontend Engineer specializing in Vue.js & Nuxt.js',
    profileLinks: [{ label: 'GitHub', url: 'https://github.com/eslammuatamed' }],
    professionalEmail: 'hello@eslammuatamed.com',
    contactEmail: 'contact@eslammuatamed.com',
    contactPhone: '+201002785408',
    whatsappPhone: '+201002785408',
    resumeAsset: null,
    portraitAssetId: null,
    portrait: null,
    aboutBio: 'ABOUT BIO SHOULD NOT APPEAR',
    engineeringPhilosophy: 'PHILOSOPHY SHOULD NOT APPEAR',
    currentFocus: 'FOCUS SHOULD NOT APPEAR',
    availabilityStatus: 'AVAILABILITY SHOULD NOT APPEAR',
    ...overrides
  } as SiteSettings)

const role = (id: string, overrides: Partial<Experience> = {}): Experience => ({
  id,
  role: `Role ${id}`,
  company: 'Acme',
  location: 'Egypt',
  impact: '- Did the work',
  employmentType: 'FULL_TIME',
  isCurrent: false,
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2025-01-01T00:00:00.000Z',
  order: 0,
  technologies: [],
  availableLocales: ['en', 'ar'],
  ...overrides
})

const skill = (id: string, label: string, group: Skill['group']): Skill =>
  ({ id, label, group, order: 0, brandColor: null, availableLocales: ['en', 'ar'] } as Skill)

async function render(options: {
  locale?: 'en' | 'ar'
  settings?: SiteSettings | null
  experiences?: Experience[] | null
  skills?: Skill[] | null
  experiencesError?: Error | null
  skillsError?: Error | null
} = {}) {
  locale.value = options.locale ?? 'en'
  settingsState.data.value = options.settings === undefined ? settings() : options.settings
  experiencesState.data.value = options.experiences === undefined ? [role('e1')] : options.experiences
  skillsState.data.value = options.skills === undefined ? [skill('s1', 'Vue.js', 'FRONTEND')] : options.skills
  experiencesState.error.value = options.experiencesError ?? null
  skillsState.error.value = options.skillsError ?? null
  return mountSuspended(ResumePage, { global: { stubs } })
}

describe('resume page — identity', () => {
  it('renders the governed name and tagline verbatim', async () => {
    const wrapper = await render()
    expect(wrapper.find('h1').text()).toBe('Eslam Muatamed')
    expect(wrapper.text()).toContain('JavaScript Product Engineer — Frontend Engineer specializing in Vue.js & Nuxt.js')
  })

  // The professional address, never the website contact inbox.
  it('prints the professional email and never the contact email', async () => {
    const wrapper = await render()
    expect(wrapper.text()).toContain('hello@eslammuatamed.com')
    expect(wrapper.text()).not.toContain('contact@eslammuatamed.com')
  })

  it('omits the email entirely when the professional address is absent', async () => {
    const wrapper = await render({ settings: settings({ professionalEmail: null }) })
    expect(wrapper.html()).not.toContain('mailto:')
    expect(wrapper.text()).not.toContain('contact@eslammuatamed.com')
  })

  /**
   * The résumé is scoped to Experience + Skills (FR-PUB-024). About prose, philosophy, current
   * focus and availability all exist on the SAME settings payload, so nothing but discipline
   * keeps them off this page — which is exactly why it is asserted.
   */
  it('renders no About bio, philosophy, current focus or availability', async () => {
    const wrapper = await render()
    const text = wrapper.text()
    for (const leak of ['ABOUT BIO', 'PHILOSOPHY', 'FOCUS', 'AVAILABILITY']) {
      expect(text).not.toContain(leak)
    }
  })

  it('renders the profile links in API order', async () => {
    const wrapper = await render()
    expect(wrapper.text()).toContain('GitHub')
  })
})

describe('resume page — PDF states', () => {
  it('offers the download with the absolute media URL when a PDF exists', async () => {
    const wrapper = await render({ settings: settings({ resumeAsset: pdf }) })
    const anchor = wrapper.findAll('a').find(a => a.attributes('href')?.endsWith('.pdf'))
    expect(anchor?.attributes('href')).toBe(pdf.url)
  })

  it('renders the honest unavailable notice when resumeAsset is null', async () => {
    const wrapper = await render({ settings: settings({ resumeAsset: null }) })
    expect(wrapper.find('[data-testid="resume-pdf-unavailable"]').exists()).toBe(true)
  })

  // The whole point of the honest state: the résumé itself still renders.
  it('still renders the full résumé while the PDF is unavailable', async () => {
    const wrapper = await render({ settings: settings({ resumeAsset: null }) })
    expect(wrapper.find('h1').text()).toBe('Eslam Muatamed')
    expect(wrapper.text()).toContain('Role e1')
    expect(wrapper.text()).toContain('Vue.js')
  })

  it('renders the ARABIC unavailable copy — never an English fallback', async () => {
    const wrapper = await render({ locale: 'ar', settings: settings({ resumeAsset: null }) })
    const notice = wrapper.find('[data-testid="resume-pdf-unavailable"]').text()
    expect(notice).toContain('نسخة PDF غير متاحة بعد')
    expect(notice).not.toContain('not available yet')
  })
})

describe('resume page — section states', () => {
  it('renders the ENGLISH empty Experience copy without blanking the page', async () => {
    const wrapper = await render({ experiences: [] })
    expect(wrapper.text()).toContain('No roles are published yet.')
    expect(wrapper.text()).toContain('Vue.js')
  })

  it('renders the ARABIC empty Experience copy', async () => {
    const wrapper = await render({ locale: 'ar', experiences: [] })
    expect(wrapper.text()).toContain('لم تُنشر أي خبرات مهنية بعد.')
    expect(wrapper.text()).not.toContain('No roles are published yet.')
  })

  it('renders the ENGLISH empty Skills copy without blanking the page', async () => {
    const wrapper = await render({ skills: [] })
    expect(wrapper.text()).toContain('No skills are published yet.')
    expect(wrapper.text()).toContain('Role e1')
  })

  it('renders the ARABIC empty Skills copy', async () => {
    const wrapper = await render({ locale: 'ar', skills: [] })
    expect(wrapper.text()).toContain('لم تُنشر أي مهارات بعد.')
  })

  it('degrades one failed section without losing the other', async () => {
    const wrapper = await render({ skillsError: new Error('503 upstream') })
    expect(wrapper.text()).toContain('Skills could not be loaded')
    // Experience is untouched by the Skills failure.
    expect(wrapper.text()).toContain('Role e1')
  })

  it('leaks no technical detail from a failed request', async () => {
    const wrapper = await render({ experiencesError: new Error('503 upstream ECONNREFUSED') })
    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    for (const leak of ['503', 'upstream', 'ECONNREFUSED']) {
      expect(alert.text()).not.toContain(leak)
    }
  })

  it('renders the ARABIC error copy', async () => {
    const wrapper = await render({ locale: 'ar', experiencesError: new Error('boom') })
    expect(wrapper.find('[role="alert"]').text()).toContain('تعذّر تحميل الخبرة المهنية')
  })
})

describe('resume page — structure', () => {
  // Reverse-chronological order is meaningful, so entries live in an ordered list.
  it('wraps Experience entries in an ordered list', async () => {
    const wrapper = await render({ experiences: [role('e1'), role('e2')] })
    const ol = wrapper.find('ol')
    expect(ol.exists()).toBe(true)
    expect(ol.findAll('li').length).toBeGreaterThanOrEqual(2)
  })

  it('renders exactly one h1 and semantic section headings beneath it', async () => {
    const wrapper = await render()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    const h2s = wrapper.findAll('h2').map(h => h.text())
    expect(h2s).toContain('Experience')
    expect(h2s).toContain('Skills')
  })

  it('groups skills under their API group label', async () => {
    const wrapper = await render({
      skills: [skill('s1', 'Vue.js', 'FRONTEND'), skill('s2', 'TypeScript', 'LANGUAGE')]
    })
    const groups = wrapper.findAll('dt').map(dt => dt.text())
    expect(groups).toEqual(['Frontend Engineering', 'Languages'])
  })

  it('carries the resume-page hook the print stylesheet is gated on', async () => {
    const wrapper = await render()
    expect(wrapper.find('.resume-page').exists()).toBe(true)
  })
})

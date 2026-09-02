// @vitest-environment nuxt
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { ref, type Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
// The INSTALLED renderer (root `unhead` 3.3.2 — the same copy Nuxt's head instance uses), driven
// against the layout's REAL head entry state. A mock capturing useHead input would prove nothing
// about same-name survival; every assertion below reads final rendered output.
import { renderSSRHead } from 'unhead/server'
import DefaultLayout from './default.vue'

// ── harness ─────────────────────────────────────────────────────────────────────────────────
const uiLocale: Ref<string> = ref('en')
const apiCalls: Array<{ path: string, locale?: string }> = []
let settingsPayload: Record<string, unknown>

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: uiLocale,
  locales: ref([{ code: 'en', name: 'EN' }, { code: 'ar', name: 'AR', dir: 'rtl' }])
}))
mockNuxtImport('useLocalePath', () => () => (path?: string) => path ?? '/')
mockNuxtImport('useApi', () => () => (path: string, options?: { locale?: string }) => {
  apiCalls.push({ path, locale: options?.locale })
  return Promise.resolve({ data: settingsPayload })
})

/** Rich payload exercising EVERY rendering rule this unit pins. */
const EN_PAYLOAD = {
  siteName: null,
  tagline: null,
  availabilityStatus: 'Available',
  profileLinks: [],
  availableLocales: ['en', 'ar'],
  googleSiteVerification: 'g-token-123',
  bingSiteVerification: 'b-token-456',
  customMetas: [
    { name: 'example-token', content: 'one' },
    { name: 'example-token', content: 'two' },
    { name: 'google-site-verification', content: 'custom-owner' },
    { name: 'msvalidate.01', content: 'bing-impostor' },
    { name: 'some-vendor-thing.v2_beta', content: 'x-value' },
    { name: 'hostile-meta', content: '<script>alert("x&y")</script>' }
  ]
}

const AR_PAYLOAD = {
  ...EN_PAYLOAD,
  googleSiteVerification: 'g-token-ar',
  // Per-field omission must follow the data: ar simply has no Bing token.
  bingSiteVerification: null,
  customMetas: [{ name: 'example-token', content: 'ar-one' }]
}

const SETTINGS_NAMES = new Set([
  'google-site-verification',
  'msvalidate.01',
  'example-token',
  'some-vendor-thing.v2_beta',
  'hostile-meta'
])

let wrapper: Awaited<ReturnType<typeof mountSuspended>>
type HeadLike = Parameters<typeof renderSSRHead>[0]
let head: HeadLike
function headOf(vm: { $: { appContext: { config: { globalProperties: Record<string, unknown> } } } }): HeadLike {
  return vm.$.appContext.config.globalProperties.$unhead as HeadLike
}

function headTagsHtml(): string {
  return renderSSRHead(head).headTags
}

/** Our descriptors parsed out of the FINAL rendered HTML via a real HTML parser (attribute-level truth). */
function renderedSettingsMetas(): Array<{ name: string, content: string, attrNames: string[] }> {
  const template = document.createElement('template')
  template.innerHTML = `<html><head>${headTagsHtml()}</head></html>`
  const metas: Array<{ name: string, content: string, attrNames: string[] }> = []
  for (const el of template.content.querySelectorAll('meta')) {
    const name = el.getAttribute('name')
    if (name && SETTINGS_NAMES.has(name)) {
      metas.push({
        name,
        content: el.getAttribute('content') ?? '',
        attrNames: Array.from(el.attributes).map(a => a.name)
      })
    }
  }
  return metas
}

beforeAll(async () => {
  settingsPayload = EN_PAYLOAD
  wrapper = await mountSuspended(DefaultLayout)
  head = headOf(wrapper.vm)
})

describe('FE4-U2d2 — public Settings verification + custom metas in FINAL SSR head output', () => {
  it('renders the Google token as <meta name="google-site-verification"> with its exact content', () => {
    expect(renderedSettingsMetas()).toContainEqual({
      name: 'google-site-verification',
      content: 'g-token-123',
      attrNames: ['name', 'content']
    })
  })

  it('renders the Bing token as <meta name="msvalidate.01"> with its exact content (never the rejected alias)', () => {
    const html = headTagsHtml()
    expect(renderedSettingsMetas()).toContainEqual({
      name: 'msvalidate.01',
      content: 'b-token-456',
      attrNames: ['name', 'content']
    })
    expect(html).not.toContain('name="bing-site-verification"')
  })

  it('duplicate custom names BOTH survive final rendering and keep API order (one → two)', () => {
    const tokens = renderedSettingsMetas().filter(m => m.name === 'example-token').map(m => m.content)
    expect(tokens).toEqual(['one', 'two'])
  })

  it('a custom meta named google-site-verification does NOT erase the vendor descriptor (both survive)', () => {
    const gsv = renderedSettingsMetas().filter(m => m.name === 'google-site-verification').map(m => m.content)
    expect(gsv).toEqual(['g-token-123', 'custom-owner'])
  })

  it('a custom meta named msvalidate.01 does NOT erase the vendor descriptor (both survive)', () => {
    const bing = renderedSettingsMetas().filter(m => m.name === 'msvalidate.01').map(m => m.content)
    expect(bing).toEqual(['b-token-456', 'bing-impostor'])
  })

  it('an arbitrary custom name renders with name/content only — no key/tagPriority/extra attributes leak', () => {
    const all = renderedSettingsMetas()
    expect(all.filter(m => m.name === 'some-vendor-thing.v2_beta')).toHaveLength(1)
    for (const meta of all) {
      expect([...meta.attrNames].sort()).toEqual(['content', 'name'])
    }
  })

  it('all projected descriptors appear in exact API order in the rendered output', () => {
    expect(
      renderedSettingsMetas().map(m => [m.name, m.content] as const)
    ).toEqual([
      ['google-site-verification', 'g-token-123'],
      ['msvalidate.01', 'b-token-456'],
      ['example-token', 'one'],
      ['example-token', 'two'],
      ['google-site-verification', 'custom-owner'],
      ['msvalidate.01', 'bing-impostor'],
      ['some-vendor-thing.v2_beta', 'x-value'],
      ['hostile-meta', '<script>alert("x&y")</script>']
    ])
  })

  it('hostile-looking custom content stays inert attribute data — no script/noscript/iframe element is created', () => {
    const template = document.createElement('template')
    template.innerHTML = `<html><head>${headTagsHtml()}</head></html>`
    expect(template.content.querySelectorAll('script, noscript, iframe').length).toBe(0)
    const hostile = renderedSettingsMetas().find(m => m.name === 'hostile-meta')
    // The raw hostile string survives INTACT as attribute DATA — escaping is the renderer's job
    // (`"` → `&quot;`), and parsing proves no element boundary was crossed.
    expect(hostile?.content).toBe('<script>alert("x&y")</script>')
  })

  it('the existing baseline floor survives alongside the Settings tags (title/description/social)', () => {
    const template = document.createElement('template')
    template.innerHTML = `<html><head>${headTagsHtml()}</head><body></body></html>`
    const title = template.content.querySelector('title')?.textContent ?? ''
    expect(title).toContain('seo.defaultTitle')
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]'
    ]) {
      const el = template.content.querySelector(selector)
      expect(el?.getAttribute('content'), selector).toBeTruthy()
    }
  })

  it('reaches the head through ONE shared /settings/site read — no second request introduced', () => {
    // Layout + footer share the awaited `settings:site:{locale}` read; a second request by the new
    // wiring would show up here.
    const siteCalls = apiCalls.filter(c => c.path === '/settings/site')
    expect(siteCalls).toHaveLength(1)
    expect(siteCalls[0]?.locale).toBe('en')
  })

  it('follows normal Nuxt head reactivity when the shared Settings state changes (no imperative DOM work)', async () => {
    settingsPayload = AR_PAYLOAD
    uiLocale.value = 'ar'

    let metas: ReturnType<typeof renderedSettingsMetas> = []
    for (let attempt = 0; attempt < 50; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      metas = renderedSettingsMetas()
      if (metas.some(m => m.content === 'g-token-ar')) break
    }

    // Replaced, not duplicated: en values gone, ar values present, per-field omission honoured.
    expect(metas.map(m => [m.name, m.content] as const)).toEqual([
      ['google-site-verification', 'g-token-ar'],
      ['example-token', 'ar-one']
    ])
    const siteCalls = apiCalls.filter(c => c.path === '/settings/site')
    expect(siteCalls).toHaveLength(2)
    expect(siteCalls[1]?.locale).toBe('ar')
  })
})

describe('source-boundary scans — layouts/default.vue wiring', () => {
  const code = readFileSync('app/layouts/default.vue', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('registers the projection exactly once, from the single existing Settings read', () => {
    expect(code.match(/projectPublicSettingsMetas\(/g)).toHaveLength(1)
    expect(code.match(/useSiteSettings\(/g)).toHaveLength(1)
    expect(code).not.toMatch(/\$fetch|useFetch|useAsyncData|useNuxtData/)
  })

  it('hands the Settings container id to the lazy public GTM boundary and consumes no analytics machinery directly', () => {
    // FE4-U2e2.1: the public layout is the sole Settings owner. It passes only the published id to
    // Nuxt's lazy client boundary — no manual loader, dataLayer, third-party URL, or admin field.
    expect(code).toMatch(/<LazyPublicGtmRuntime\s+:container-id="settings\?\.gtmContainerId \?\? null"/)
    expect(code.match(/gtmContainerId/g)).toHaveLength(1)
    expect(code).not.toMatch(/analyticsEnabled|dataLayer|googletagmanager|useScriptGoogleTagManager|usePublicGtm/i)
  })

  it('adds no client-only insertion path (no mounted hook / DOM access / observer around the wiring)', () => {
    expect(code).not.toMatch(/\bonMounted\b|document\.|MutationObserver|innerHTML/)
    // Exactly the pre-existing focus-management client block — none added for metas.
    expect(code.match(/import\.meta\.client/g)).toHaveLength(1)
  })

  it('owns no PageSeo/canonical/hreflang/structured-data surface and emits no script capability', () => {
    expect(code).not.toMatch(/PageSeo|canonical|hreflang|alternates/i)
    expect(code).not.toMatch(/ld\+json|useSchemaOrg/)
    const withoutSfcTags = code.replace(/<\/?script[^>]*>/g, '').replace(/<\/?(template|style)[^>]*>/g, '')
    expect(withoutSfcTags).not.toMatch(/noscript|\biframe\b|<script/)
  })
})

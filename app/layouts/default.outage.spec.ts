// @vitest-environment nuxt
// FE4-U2d2 failure half: a Settings read that fails or returns blank/empty optional fields must
// remove ONLY the optional global tags — never the baseline metadata floor, never the page itself.
// Every fixture in this file is deliberately free of verification/custom values, so absence
// assertions stay valid even though one head instance serves the whole file.
import { describe, expect, it, afterEach } from 'vitest'
import { ref, type Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { renderSSRHead } from 'unhead/server'
import DefaultLayout from './default.vue'

type HeadLike = Parameters<typeof renderSSRHead>[0]
function headOf(vm: { $: { appContext: { config: { globalProperties: Record<string, unknown> } } } }): HeadLike {
  return vm.$.appContext.config.globalProperties.$unhead as HeadLike
}

const uiLocale: Ref<string> = ref('en')
let settingsPayload: Record<string, unknown>
let failSettings: boolean

mockNuxtImport('useI18n', () => () => ({
  t: (key: string) => key,
  locale: uiLocale,
  locales: ref([{ code: 'en', name: 'EN' }, { code: 'ar', name: 'AR', dir: 'rtl' }])
}))
mockNuxtImport('useLocalePath', () => () => (path?: string) => path ?? '/')
mockNuxtImport('useApi', () => () => (_path: string, _options?: Record<string, unknown>) => {
  if (failSettings) return Promise.reject(new Error('upstream 503'))
  return Promise.resolve({ data: settingsPayload })
})

const BLANK_PAYLOAD = {
  siteName: null,
  tagline: null,
  availabilityStatus: null,
  profileLinks: [],
  availableLocales: ['en', 'ar'],
  googleSiteVerification: '',
  bingSiteVerification: null,
  customMetas: []
}

async function mountLayout() {
  const wrapper = await mountSuspended(DefaultLayout)
  const head = headOf(wrapper.vm)
  return { wrapper, head }
}

function settingsMetas(head: HeadLike): Array<{ name: string, content: string }> {
  const template = document.createElement('template')
  template.innerHTML = `<html><head>${renderSSRHead(head).headTags}</head></html>`
  const names = ['google-site-verification', 'msvalidate.01', 'example-token']
  return template.content.querySelectorAll('meta')
    .values()
    .map(el => ({ name: el.getAttribute('name'), content: el.getAttribute('content') ?? '' }))
    .filter((m): m is { name: string, content: string } => typeof m.name === 'string' && names.includes(m.name))
    .toArray()
}

function expectBaselineIntact(head: HeadLike) {
  const template = document.createElement('template')
  template.innerHTML = `<html><head>${renderSSRHead(head).headTags}</head><body></body></html>`
  expect(template.content.querySelector('title')?.textContent).toContain('seo.defaultTitle')
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]'
  ]) {
    expect(template.content.querySelector(selector)?.getAttribute('content'), selector).toBeTruthy()
  }
}

afterEach(() => {
  uiLocale.value = 'en'
})

describe('FE4-U2d2 — blank/null verification + empty customMetas render nothing', () => {
  it('blank Google / null Bing / empty customMetas → no Settings tags, baseline floor intact', async () => {
    failSettings = false
    settingsPayload = BLANK_PAYLOAD
    const { wrapper, head } = await mountLayout()

    expect(settingsMetas(head)).toEqual([])
    expectBaselineIntact(head)
    // The public page still renders.
    expect(wrapper.find('#main-content').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('FE4-U2d2 — Settings outage removes only the optional global tags', () => {
  it('rejected read → no verification/custom tags, baseline floor intact, page renders D13-1-free', async () => {
    // Runs FIRST in the file so the shared async-data cache cannot serve a stale success here;
    // Nuxt writes payload.data[key] on success only, so a rejection leaves nothing behind for a
    // later mount either way.
    failSettings = true
    const { wrapper, head } = await mountLayout()

    expect(settingsMetas(head)).toEqual([])
    expectBaselineIntact(head)
    expect(wrapper.find('#main-content').exists()).toBe(true)
    wrapper.unmount()
  })

  it('a healthy read AFTER an outage still renders the public shell (failure is not sticky)', async () => {
    failSettings = false
    settingsPayload = BLANK_PAYLOAD
    const { wrapper, head } = await mountLayout()

    expect(settingsMetas(head)).toEqual([])
    expectBaselineIntact(head)
    expect(wrapper.find('#main-content').exists()).toBe(true)
    wrapper.unmount()
  })
})

// @vitest-environment nuxt
// FE4-U2d2 isolation half: the Settings verification/custom metas are registered by the PUBLIC
// layout ONLY. The dashboard and auth shells — and app.vue, which wraps all of them — must never
// project them. Proven behaviorally (real mounts resolved through the installed renderer) and
// structurally (source scans across every layout + app.vue).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ref, type Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { renderSSRHead } from 'unhead/server'
import AuthLayout from './auth.vue'
import DashboardLayout from './dashboard.vue'

type HeadLike = Parameters<typeof renderSSRHead>[0]
function headOf(vm: { $: { appContext: { config: { globalProperties: Record<string, unknown> } } } }): HeadLike {
  return vm.$.appContext.config.globalProperties.$unhead as HeadLike
}

const dashboardLocale: Ref<string> = ref('en')

mockNuxtImport('useDashboardI18n', () => () => ({
  t: (key: string) => key,
  locale: dashboardLocale,
  dir: ref('ltr'),
  ensureMessages: async () => {}
}))
mockNuxtImport('useAuthStore', () => () => ({
  user: ref(null),
  logout: async () => {}
}))
mockNuxtImport('useDashboardNav', () => () => ({ groups: [] }))
mockNuxtImport('useUnreadCount', () => () => ({ ensureFresh: async () => ({ count: 0 }) }))
mockNuxtImport('useLocalePath', () => () => (path?: string) => path ?? '/')

const SETTINGS_META_NAMES = [
  'google-site-verification',
  'msvalidate.01',
  'example-token',
  'hostile-meta'
]

function renderedMetaNames(head: HeadLike): string[] {
  const template = document.createElement('template')
  template.innerHTML = `<html><head>${renderSSRHead(head).headTags}</head></html>`
  return template.content.querySelectorAll('meta')
    .values()
    .map(el => el.getAttribute('name'))
    .filter((n): n is string => Boolean(n))
    .toArray()
}

describe('FE4-U2d2 — Settings metas never render outside the public layout', () => {
  it('the auth/login shell renders none of them', async () => {
    const wrapper = await mountSuspended(AuthLayout, {
      global: { stubs: { UiBrandMark: true, DashboardLangSwitch: true, LayoutThemeToggle: true } }
    })
    const head = headOf(wrapper.vm)
    for (const name of SETTINGS_META_NAMES) {
      expect(renderedMetaNames(head)).not.toContain(name)
    }
    wrapper.unmount()
  })

  it('the dashboard shell renders none of them', async () => {
    const wrapper = await mountSuspended(DashboardLayout, {
      global: {
        stubs: {
          DashboardNavList: true,
          DashboardLangSwitch: true,
          LayoutThemeToggle: true,
          USlideover: true,
          UButton: true,
          UDropdownMenu: true
        }
      }
    })
    const head = headOf(wrapper.vm)
    for (const name of SETTINGS_META_NAMES) {
      expect(renderedMetaNames(head)).not.toContain(name)
    }
    wrapper.unmount()
  })
})

describe('FE4-U2d2 — structural ownership scans', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('projectPublicSettingsMetas is wired in exactly ONE file: layouts/default.vue', () => {
    const files = [
      'app/layouts/default.vue',
      'app/layouts/auth.vue',
      'app/layouts/dashboard.vue',
      'app/layouts/preview.vue',
      'app/app.vue'
    ]
    const wired = files.filter(f => /projectPublicSettingsMetas/.test(strip(readFileSync(f, 'utf8'))))
    expect(wired).toEqual(['app/layouts/default.vue'])
  })

  it('GTM registration stays public-layout-only: default hands the id to the lazy boundary; every other shell is gtm-free', () => {
    // FE4-U2e2.1. The PUBLIC layout may read `gtmContainerId` ONLY to hand it to the lazy
    // client-only boundary; analyticsEnabled (admin kill switch) and manual machinery stay
    // forbidden there, and the other shells must not touch GTM at all.
    const def = strip(readFileSync('app/layouts/default.vue', 'utf8'))
    expect(def).toMatch(/<LazyPublicGtmRuntime\s+:container-id="settings\?\.gtmContainerId/)
    expect(def).not.toMatch(/usePublicGtm|useScriptGoogleTagManager/)
    expect(def).not.toMatch(/analyticsEnabled|dataLayer|googletagmanager|useScriptGoogleTagManager/i)
    for (const f of [
      'app/layouts/auth.vue',
      'app/layouts/dashboard.vue',
      'app/layouts/preview.vue',
      'app/app.vue'
    ]) {
      expect(strip(readFileSync(f, 'utf8')), f).not.toMatch(/gtmContainerId|analyticsEnabled|usePublicGtm|dataLayer|googletagmanager|gtm\.js/i)
    }
  })

  it('app.vue keeps its baseline floor without any Settings-meta registration', () => {
    const code = strip(readFileSync('app/app.vue', 'utf8'))
    expect(code).not.toMatch(/projectPublicSettingsMetas|useSiteSettings/)
    expect(code).toMatch(/useSeoMeta|useHead/)
  })
})

// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import DashboardLayout from './dashboard.vue'

const dashboardLocale = ref<'en' | 'ar'>('en')
const dashboardDir = ref<'ltr' | 'rtl'>('ltr')
const user = ref<{ email: string } | null>({ email: 'operator@example.com' })

mockNuxtImport('useDashboardI18n', () => () => ({
  t: (key: string) => key,
  locale: dashboardLocale,
  dir: dashboardDir,
  ensureMessages: async () => {}
}))
mockNuxtImport('useAuthStore', () => () => ({ user: user.value, logout: async () => {} }))
mockNuxtImport('useDashboardNav', () => () => ({ groups: [] }))
mockNuxtImport('useUnreadCount', () => () => ({ ensureFresh: async () => ({ count: 0 }) }))
mockNuxtImport('useLocalePath', () => () => (path: string, locale: string) => locale === 'ar' ? `/ar${path}` : path)

const UButton = {
  props: ['to', 'target', 'rel', 'ariaLabel', 'icon'],
  template: `
    <a v-if="to" :href="to" :target="target" :rel="rel" :aria-label="ariaLabel"><slot /></a>
    <button v-else type="button" :aria-label="ariaLabel"><slot /></button>
  `
}

const stubs = {
  DashboardNavList: { template: '<nav />' },
  DashboardLangSwitch: { template: '<div data-dashboard-lang-switch />' },
  LayoutThemeToggle: { template: '<button type="button" data-dashboard-theme-switch />', props: ['label'] },
  USlideover: { template: '<div><slot name="body" /></div>' },
  UButton
}

async function mount(locale: 'en' | 'ar' = 'en') {
  dashboardLocale.value = locale
  dashboardDir.value = locale === 'ar' ? 'rtl' : 'ltr'
  user.value = { email: 'operator@example.com' }
  return mountSuspended(DashboardLayout, { global: { stubs } })
}

afterEach(() => { user.value = null })

describe('DashboardLayout header action groups', () => {
  it('keeps every action in its intended workspace or account group', async () => {
    const wrapper = await mount()
    const workspace = wrapper.get('[data-dashboard-workspace-controls]')
    const account = wrapper.get('[data-dashboard-account-controls]')

    const viewSite = workspace.get('[data-dashboard-view-site]')
    expect(viewSite.attributes('href')).toBe('/')
    expect(viewSite.attributes('target')).toBe('_blank')
    expect(viewSite.attributes('rel')).toBe('noopener')
    expect(viewSite.attributes('aria-label')).toBe('dashboard.shell.viewSite')
    expect(workspace.classes()).toEqual(expect.arrayContaining(['shrink-0', 'border-e', 'border-default', 'pe-3']))
    expect(workspace.find('[data-dashboard-lang-switch]').exists()).toBe(true)
    expect(workspace.find('[data-dashboard-theme-switch]').exists()).toBe(true)

    const identity = account.get('[data-dashboard-account-identity]')
    expect(identity.text()).toBe('operator@example.com')
    expect(identity.classes()).toEqual(expect.arrayContaining(['max-w-48', 'truncate', 'sm:inline']))
    expect(account.get('[data-dashboard-sign-out]').attributes('aria-label')).toBe('dashboard.signOut')
    expect(workspace.find('[data-dashboard-account-identity]').exists()).toBe(false)
    expect(account.find('[data-dashboard-view-site]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('preserves RTL shell direction and the mobile menu trigger', async () => {
    const wrapper = await mount('ar')

    expect(wrapper.get('[data-shell="dashboard"]').attributes('dir')).toBe('rtl')
    expect(wrapper.get('[data-shell="dashboard"]').attributes('lang')).toBe('ar')
    expect(wrapper.get('[aria-label="dashboard.nav.openMenu"]').classes()).toContain('lg:hidden')
    expect(wrapper.find('[data-dashboard-workspace-controls]').exists()).toBe(true)
    expect(wrapper.find('[data-dashboard-account-controls]').exists()).toBe(true)
    wrapper.unmount()
  })
})

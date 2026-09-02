// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'

/**
 * The one thing that makes the bilingual dashboard work, asserted directly.
 *
 * `useDashboardI18n().t` must resolve against the DASHBOARD locale while the app's own i18n locale
 * stays `en` — because on an unprefixed `/dashboard/**` route the route-derived locale is always
 * `en` (D04-7). Drop the `{ locale }` option from the `t` wrapper and every one of these still
 * returns a real, well-formed English string: nothing throws, nothing warns, and the only symptom is
 * an English dashboard that was asked to be Arabic. That is why this is asserted on VALUES, against
 * the real catalogues, rather than on the call being made.
 */

/** Renders whatever the dashboard `t` returns, so the assertion goes through a real component. */
const Probe = defineComponent({
  setup() {
    const { t, locale, dir, setLocale, ensureMessages } = useDashboardI18n()
    // The app-wide, ROUTE-derived locale, captured from inside `setup` because vue-i18n's `useI18n`
    // may only be called there. Exposed so a test can prove the dashboard switch leaves it alone.
    const { locale: routeLocale } = useI18n()
    return { t, locale, dir, setLocale, ensureMessages, routeLocale }
  },
  render() {
    return h('div', [
      h('span', { class: 'title' }, this.t('dashboard.title')),
      h('span', { class: 'interpolated' }, this.t('dashboard.welcome', { email: 'owner@example.com' })),
      h('span', { class: 'locale' }, this.locale),
      h('span', { class: 'dir' }, this.dir)
    ])
  }
})

async function mountProbe() {
  const wrapper = await mountSuspended(Probe)
  // The catalogue is code-split; without this the first read races the fetch. The layouts await the
  // same call, which is what makes a cold Arabic load safe (see `layouts/dashboard.vue`).
  await wrapper.vm.ensureMessages('ar')
  return wrapper
}

describe('useDashboardI18n resolves against the dashboard locale', () => {
  it('starts in English, matching the shipped default', async () => {
    const wrapper = await mountProbe()

    expect(wrapper.get('.locale').text()).toBe('en')
    expect(wrapper.get('.dir').text()).toBe('ltr')
    expect(wrapper.get('.title').text()).toBe('Dashboard')
  })

  it('returns ARABIC copy once the dashboard locale is Arabic, while the route locale is untouched', async () => {
    const wrapper = await mountProbe()
    const routeLocaleBefore = wrapper.vm.routeLocale

    await wrapper.vm.setLocale('ar')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.title').text()).toBe('لوحة التحكم')
    expect(wrapper.get('.dir').text()).toBe('rtl')

    // THE OTHER HALF OF THE CONTRACT. Flipping the global i18n locale would also turn the title
    // Arabic and would pass the assertion above — while desynchronizing locale from route for every
    // later public navigation (D06-6 / D22-7). Asserting the route locale did NOT move is what
    // distinguishes the implemented design from the tempting wrong one.
    expect(wrapper.vm.routeLocale).toBe(routeLocaleBefore)
    expect(wrapper.vm.routeLocale).toBe('en')
  })

  it('keeps interpolation working in the switched locale', async () => {
    // A `t` wrapper that forwards the locale but drops `named` renders the placeholder literally.
    // Both halves are exercised in one string.
    const wrapper = await mountProbe()
    await wrapper.vm.setLocale('ar')
    await wrapper.vm.$nextTick()

    const text = wrapper.get('.interpolated').text()
    expect(text).toContain('owner@example.com')
    expect(text).not.toContain('{email}')
  })

  it('renders no raw key path in either locale', async () => {
    // The signature of the defect this whole campaign removes: a missing message rendering as its
    // own dotted key. Cheap to assert, and it fails loudly where the product failed silently.
    const wrapper = await mountProbe()
    for (const locale of ['en', 'ar'] as const) {
      await wrapper.vm.setLocale(locale)
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).not.toMatch(/dashboard\.[a-z]+/i)
    }
  })
})

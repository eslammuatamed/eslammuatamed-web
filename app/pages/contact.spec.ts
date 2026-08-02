// @vitest-environment nuxt
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import ContactPage from './contact.vue'
import { ApiError } from '~/utils/api-error'
import type { SiteSettings } from '~/types/models'

/**
 * Page-level coverage for the submission-state × locale matrix.
 *
 * These states cannot all be driven through the browser lane: Prism answers a single canned 200 for
 * any POST payload, so 422 / 429 / 500 / transport failure, the anti-spam deferral and the
 * double-submit lock are proven here, where the API call is a mock whose behaviour each test picks.
 *
 * `t` resolves against the REAL locale files, so an assertion fails if a string is missing, empty,
 * or accidentally still English in `ar.json`.
 */
const holder = vi.hoisted(() => ({
  i18n: null as unknown,
  post: null as unknown
}))

mockNuxtImport('useI18n', () => () => holder.i18n)
mockNuxtImport('useApi', () => () => holder.post)
mockNuxtImport('useSiteConfig', () => () => ({ url: 'https://example.com' }))
mockNuxtImport('useLocalePath', () => () => (path: string) => path)
mockNuxtImport('useSchemaOrg', () => () => undefined)
mockNuxtImport('defineWebPage', () => (input: unknown) => input)
mockNuxtImport('defineBreadcrumb', () => (input: unknown) => input)
mockNuxtImport('useSeoMeta', () => () => undefined)
mockNuxtImport('useSiteSettings', () => () => ({ data: settingsRef }))

const localeFile = (code: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `i18n/locales/${code}.json`), 'utf8')) as Record<string, unknown>
const messages: Record<string, Record<string, unknown>> = { en: localeFile('en'), ar: localeFile('ar') }
const locale = ref<'en' | 'ar'>('en')

/** Namespaces this page owns; a miss inside one is a real defect and throws. */
const OWNED = ['contact.', 'seo.contact.', 'nav.', 'brand.']

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

holder.i18n = { t: translate, locale }

function settings(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    siteName: 'Eslam Muatamed',
    tagline: 'Frontend Engineer',
    defaultMetaTitle: null,
    defaultMetaDescription: null,
    profileLinks: [],
    availabilityStatus: null,
    careerStartYear: 2023,
    careerStartMonth: 11,
    googleSiteVerification: null,
    bingSiteVerification: null,
    analytics: null,
    customMetas: [],
    resumeAsset: null,
    portraitAssetId: null,
    portrait: null,
    professionalEmail: 'hello@eslammuatamed.com',
    contactEmail: 'contact@eslammuatamed.com',
    contactPhone: '+201002785408',
    whatsappPhone: '+201002785408',
    aboutBio: null,
    engineeringPhilosophy: null,
    currentFocus: null,
    availableLocales: ['en', 'ar'],
    ...overrides
  } as SiteSettings
}

const settingsRef = ref<SiteSettings | null>(null)
let post: ReturnType<typeof vi.fn>

/** Fills the four visible fields the way a visitor would, then submits. */
async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountSuspended>>, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    name: 'Alex Morgan',
    email: 'alex@example.com',
    subject: 'Project inquiry',
    body: 'I would like to discuss a Nuxt build.',
    ...overrides
  }
  for (const [field, value] of Object.entries(values)) {
    const control = wrapper.find(`input[name="${field}"], textarea[name="${field}"]`)
    if (control.exists()) await control.setValue(value)
  }
  await wrapper.find('form').trigger('submit')
  await flush()
}

/** Drains microtasks and the fake-timer queue until the component settles. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await vi.runOnlyPendingTimersAsync()
    await nextTick()
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  locale.value = 'en'
  settingsRef.value = settings()
  post = vi.fn().mockResolvedValue({ data: { received: true } })
  holder.post = post
})

afterEach(() => {
  vi.useRealTimers()
})

describe('contact page — direct methods (FR-PUB-053, D10-16)', () => {
  it('renders a mailto for contactEmail', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).toContain('mailto:contact@eslammuatamed.com')
  })

  it('renders a tel: action for contactPhone', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).toContain('tel:+201002785408')
  })

  it('renders a wa.me action with the localized message URL-encoded', async () => {
    const wrapper = await mountSuspended(ContactPage)
    const html = wrapper.html()
    // wa.me takes the number WITHOUT the leading plus.
    expect(html).toContain('https://wa.me/201002785408')
    expect(html).toContain(encodeURIComponent(translate('contact.whatsappMessage')).slice(0, 40))
  })

  it('formats the displayed number for humans while dialling the E.164 value', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).toContain('+20 100 278 5408')
    expect(wrapper.html()).toContain('tel:+201002785408')
  })

  // Each row is gated on ITS OWN field — never inferred from the other (D10-16).
  it('shows email only when the other two are null', async () => {
    settingsRef.value = settings({ contactPhone: null, whatsappPhone: null })
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).toContain('mailto:')
    expect(wrapper.html()).not.toContain('tel:')
    expect(wrapper.html()).not.toContain('wa.me')
  })

  it('shows a call action without WhatsApp when whatsappPhone is null', async () => {
    settingsRef.value = settings({ whatsappPhone: null })
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).toContain('tel:+201002785408')
    expect(wrapper.html()).not.toContain('wa.me')
  })

  it('shows WhatsApp without a call action when contactPhone is null', async () => {
    settingsRef.value = settings({ contactPhone: null })
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).toContain('wa.me/201002785408')
    expect(wrapper.html()).not.toContain('tel:')
  })

  // The two settings may legitimately differ; each row must show and link its OWN number.
  it('never displays the call number on the WhatsApp row when the two differ', async () => {
    settingsRef.value = settings({
      contactPhone: '+201002785408',
      whatsappPhone: '+966512345678'
    })
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).toContain('tel:+201002785408')
    expect(wrapper.html()).toContain('wa.me/966512345678')
    expect(wrapper.text()).toContain('+20 100 278 5408')
    expect(wrapper.text()).toContain('+966 512 345 678')
  })

  it('never falls back to professionalEmail when contactEmail is null', async () => {
    settingsRef.value = settings({ contactEmail: null })
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.html()).not.toContain('mailto:')
    expect(wrapper.html()).not.toContain('hello@eslammuatamed.com')
  })

  it('renders no direct-method rows at all when every field is null', async () => {
    settingsRef.value = settings({ contactEmail: null, contactPhone: null, whatsappPhone: null })
    const wrapper = await mountSuspended(ContactPage)
    const html = wrapper.html()
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('wa.me')
    expect(html).not.toContain('null')
  })
})

describe('contact page — availability note', () => {
  it('renders availabilityStatus verbatim beside the direct methods when present', async () => {
    settingsRef.value = settings({ availabilityStatus: 'Open to frontend opportunities' })
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).toContain('Open to frontend opportunities')
  })

  it('renders no note when availabilityStatus is null — no invented promise', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.success.title'))
    // Nothing resembling a response-time claim appears.
    expect(wrapper.text()).not.toMatch(/within|hours|business day/i)
  })
})

describe('contact page — submission payload', () => {
  it('posts the exact contract field names', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const [path, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(path).toBe('/contact')
    expect(Object.keys(options.body).sort()).toEqual(
      ['body', 'elapsedMs', 'email', 'name', 'subject', 'website']
    )
  })

  // The API field is `body`, not `message` — the mistake this assertion exists to prevent.
  it('sends the message under `body`', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.body).toBe('I would like to discuss a Nuxt build.')
    expect(options.body).not.toHaveProperty('message')
  })

  it('trims the four visible values before sending', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { name: '  Alex Morgan  ', subject: '  Project inquiry  ' })
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.name).toBe('Alex Morgan')
    expect(options.body.subject).toBe('Project inquiry')
  })

  it('sends an integer elapsedMs of at least the threshold', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: { elapsedMs: number } }]
    expect(Number.isInteger(options.body.elapsedMs)).toBe(true)
    expect(options.body.elapsedMs).toBeGreaterThanOrEqual(3000)
  })
})

// Regression guard for a real defect this slice shipped and Lighthouse caught: with Nuxt UI's
// GENERATED ids, the SSR pass produced `v-0-1-*` and hydration produced `v-0-0-*` for the controls
// only, so every `<label for>` pointed at an element that no longer existed — clicking a label did
// nothing and each field was announced unlabelled (accessibility 92 EN / 96 AR against a required
// 100, with no Vue hydration warning because only the id values differed).
//
// Passing an explicit `id` makes `useFormField` write it into the same ref the label renders, so
// both sides resolve from one stable value. These assertions fail if the explicit ids are ever
// removed and the page drifts back onto generated ones.
describe('contact page — label association (a11y regression guard)', () => {
  it('gives every visible control a stable, non-generated id', async () => {
    const wrapper = await mountSuspended(ContactPage)
    for (const [field, id] of Object.entries({
      name: 'contact-name',
      email: 'contact-email',
      subject: 'contact-subject',
      body: 'contact-body'
    })) {
      const control = wrapper.find(`input[name="${field}"], textarea[name="${field}"]`)
      expect(control.attributes('id')).toBe(id)
      expect(control.attributes('id')).not.toMatch(/^v-\d/)
    }
  })

  it('points every label at a control that actually exists', async () => {
    const wrapper = await mountSuspended(ContactPage)
    const labels = wrapper.findAll('label')
    expect(labels.length).toBeGreaterThanOrEqual(5)
    for (const label of labels) {
      const target = label.attributes('for')
      expect(target).toBeDefined()
      expect(wrapper.find(`#${target}`).exists()).toBe(true)
    }
  })

  it('leaves no visible control unlabelled', async () => {
    const wrapper = await mountSuspended(ContactPage)
    for (const field of ['name', 'email', 'subject', 'body']) {
      const control = wrapper.find(`input[name="${field}"], textarea[name="${field}"]`)
      const id = control.attributes('id')
      expect(wrapper.find(`label[for="${id}"]`).exists()).toBe(true)
    }
  })
})

describe('contact page — honeypot', () => {
  it('does not name the honeypot input `website` in the DOM', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.find('input[name="website"]').exists()).toBe(false)
    expect(wrapper.find('input[name="company-url"]').exists()).toBe(true)
  })

  it('hides it from assistive technology and the tab order, without display:none', async () => {
    const wrapper = await mountSuspended(ContactPage)
    const field = wrapper.find('input[name="company-url"]')
    expect(field.attributes('tabindex')).toBe('-1')
    expect(field.attributes('autocomplete')).toBe('off')
    // Hidden by clipping, NOT by `display:none` — some autofill implementations skip a
    // display:none field (so a real visitor never trips it) and some bots detect it (so a real bot
    // avoids it). Matching on the exact class avoids the trap of substring-matching "hidden",
    // which `overflow-hidden` would satisfy while proving nothing.
    const container = field.element.closest('[aria-hidden="true"]') as HTMLElement | null
    expect(container).not.toBeNull()
    expect(container!.classList.contains('sr-only')).toBe(true)
    expect(container!.classList.contains('hidden')).toBe(false)
    expect(container!.style.display).not.toBe('none')
  })

  it('maps its value onto the contract `website` key at submission', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="company-url"]').setValue('http://spam.example')
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.website).toBe('http://spam.example')
  })

  // Never trimmed: the API's emptiness test is length 0, so whitespace must survive as a bot signal.
  it('sends a whitespace-only honeypot untrimmed', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="company-url"]').setValue('   ')
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.website).toBe('   ')
  })

  it('sends an empty string when untouched', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.website).toBe('')
  })
})

describe('contact page — outcome states', () => {
  it('shows the NEUTRAL success receipt and never claims inbox delivery', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.success.title'))
    expect(wrapper.text()).toContain(translate('contact.success.body'))
    expect(wrapper.text()).not.toMatch(/inbox|delivered|stored|saved/i)
  })

  it('clears the visible fields after a confirmed 200 (seen on the restored form)', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    // Success REPLACES the form, so the cleared values are observed after returning to it.
    const again = wrapper.findAll('button').find(b => b.text() === translate('contact.success.again'))
    await again!.trigger('click')
    await flush()
    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('')
  })

  it('resets the honeypot after a confirmed 200 (seen on the restored form)', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="company-url"]').setValue('bot')
    await fillAndSubmit(wrapper)
    const again = wrapper.findAll('button').find(b => b.text() === translate('contact.success.again'))
    await again!.trigger('click')
    await flush()
    expect((wrapper.find('input[name="company-url"]').element as HTMLInputElement).value).toBe('')
  })

  it('shows the validation state on a 422 with field errors', async () => {
    post.mockRejectedValue(new ApiError(
      { type: 'about:blank', title: 'Validation error', status: 422, errors: [{ field: 'email', message: 'Bad' }] }
    ))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.validationTitle'))
  })

  it('shows the rate-limit state with a localized duration when Retry-After is readable', async () => {
    post.mockRejectedValue(new ApiError(
      { type: 'about:blank', title: 'Too many', status: 429 }, { retryAfter: '3600' }
    ))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.rateLimitTitle'))
    expect(wrapper.text()).toContain('in 1 hour')
  })

  // The pre-D10-15 reality in a browser, and still reachable if the header is malformed.
  it('falls back to the static rate-limit copy when Retry-After is unreadable', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Too many', status: 429 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.rateLimitBody'))
    expect(wrapper.text()).not.toMatch(/NaN|undefined|Invalid/)
  })

  it('never fabricates a duration from a malformed Retry-After', async () => {
    post.mockRejectedValue(new ApiError(
      { type: 'about:blank', title: 'Too many', status: 429 }, { retryAfter: 'soon' }
    ))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.rateLimitBody'))
  })

  it('shows the server state on a 500', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Boom', status: 500 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.serverTitle'))
  })

  // statusOf() yields 0 for a transport failure, which must read as "couldn't reach", not "server error".
  it('shows the network state on a transport failure', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Failed to fetch', status: 0 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.networkTitle'))
  })

  it('keeps the visitor input on a recoverable failure', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Boom', status: 500 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const nameInput = wrapper.find('input[name="name"]').element as HTMLInputElement
    expect(nameInput.value).toBe('Alex Morgan')
  })

  it('exposes exactly one live region for a recoverable outcome', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Boom', status: 500 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const regions = wrapper.findAll('[role="status"]')
    expect(regions).toHaveLength(1)
    expect(regions[0]!.attributes('aria-live')).toBe('polite')
    expect(regions[0]!.attributes('tabindex')).toBe('-1')
  })
})

describe('contact page — double submission', () => {
  it('sends exactly one request when submitted twice in a row', async () => {
    let release: (value: unknown) => void = () => {}
    post.mockImplementation(() => new Promise((resolve) => { release = resolve }))
    const wrapper = await mountSuspended(ContactPage)

    await fillAndSubmit(wrapper)
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(post).toHaveBeenCalledTimes(1)
    release({ data: { received: true } })
    await flush()
  })
})

describe('contact page — locale switch resets the form', () => {
  it('clears entered values, the honeypot and the status', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Boom', status: 500 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.error.serverTitle'))

    await wrapper.find('input[name="company-url"]').setValue('bot')

    locale.value = 'ar'
    await flush()

    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('input[name="company-url"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(0)
  })

  it('dismisses a success state on locale switch and restores a fresh form', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.success.title'))

    locale.value = 'ar'
    await flush()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Message received')
  })
})

describe('contact page — Arabic', () => {
  beforeEach(() => {
    locale.value = 'ar'
  })

  it('renders the Arabic page identity', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).toContain(translate('contact.title'))
    expect(wrapper.text()).toContain(translate('contact.form.submit'))
  })

  it('renders the Arabic neutral receipt', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain('تم استلام الرسالة')
    expect(wrapper.text()).toContain('شكرًا لك — تم استلام رسالتك.')
  })

  // D03-4: Western Arabic digits everywhere, including inside the interpolated duration.
  it('renders the Arabic retry duration with latn digits', async () => {
    post.mockRejectedValue(new ApiError(
      { type: 'about:blank', title: 'Too many', status: 429 }, { retryAfter: '300' }
    ))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain('خلال 5 دقائق')
    expect(wrapper.text()).not.toMatch(/[٠-٩]/)
  })
})


// Email-or-phone (D10-16) and the E.164 the client composes from the selector (D13-6).
describe('contact page — email or phone', () => {
  it('submits email only, omitting phone from the payload entirely', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.email).toBe('alex@example.com')
    // Omitted, not sent blank: the API distinguishes "not supplied" from "supplied and empty".
    expect(options.body).not.toHaveProperty('phone')
  })

  it('submits phone only, omitting email from the payload entirely', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('100 278 5408')
    await fillAndSubmit(wrapper, { email: '' })
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body).not.toHaveProperty('email')
    expect(options.body.phone).toBe('+201002785408')
  })

  it('composes E.164 from the selected dialing code, dropping the local trunk zero', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('010 0278 5408')
    await fillAndSubmit(wrapper, { email: '' })
    const [, options] = post.mock.calls[0] as [string, { body: { phone: string } }]
    expect(options.body.phone).toBe('+201002785408')
  })

  it('sends both when both are supplied', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('1002785408')
    await fillAndSubmit(wrapper)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.email).toBe('alex@example.com')
    expect(options.body.phone).toBe('+201002785408')
  })

  it('blocks submission when neither method is supplied', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(translate('contact.errors.contactMethodRequired'))
  })

  // A value the visitor actually typed is judged on its own merits, even when the other is valid.
  it('blocks a malformed email even though a valid phone is present', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('1002785408')
    await fillAndSubmit(wrapper, { email: 'not-an-email' })
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(translate('contact.errors.emailInvalid'))
  })

  it('blocks an implausible phone even though a valid email is present', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('12')
    await fillAndSubmit(wrapper)
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(translate('contact.errors.phoneInvalid'))
  })

  it('offers the seven markets plus an Other country option', async () => {
    const wrapper = await mountSuspended(ContactPage)
    const options = wrapper.findAll('#contact-dial-code option')
    expect(options).toHaveLength(8)
    expect(options[0]!.text()).toContain('+20')
    expect(options[7]!.text()).toBe(translate('contact.form.otherCountry'))
  })

  it('labels the dialing-code select and the number field separately', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.find('label[for="contact-dial-code"]').exists()).toBe(true)
    expect(wrapper.find('label[for="contact-phone"]').exists()).toBe(true)
    expect(wrapper.find('#contact-phone').attributes('inputmode')).toBe('tel')
    expect(wrapper.find('#contact-phone').attributes('autocomplete')).toBe('tel')
  })

  it('does not claim every field is required', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).not.toContain('All fields are required')
    expect(wrapper.text()).toContain(translate('contact.form.requiredHint'))
  })
})


// Regression guard: with `undefined` initial values, zod failed on the TYPE before `.min(1, …)`
// and every blank required field rendered its generic "Invalid input" instead of authored copy.
describe('contact page — validation copy', () => {
  it('shows the authored required messages, never zod\'s generic fallback', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('form').trigger('submit')
    await flush()

    const text = wrapper.text()
    expect(text).not.toContain('Invalid input')
    expect(text).toContain(translate('contact.errors.nameRequired'))
    expect(text).toContain(translate('contact.errors.subjectRequired'))
    expect(text).toContain(translate('contact.errors.bodyRequired'))
  })

  it('shows the pair message once the other required fields are filled', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    expect(wrapper.text()).toContain(translate('contact.errors.contactMethodRequired'))
    expect(wrapper.text()).not.toContain('Invalid input')
  })
})


// ── F-6: the shared contact-method invariant must never go stale ──────────────────────────────
//
// Root cause: `UForm._validate({ name })` sets `errors.value = filterErrorsByNames(allErrors,
// names)`, so a per-field revalidation REPLACES the error list with only that field's errors, and
// an `input` event revalidates a field only once it has been blurred. A cross-field issue filed
// under `email` was therefore never re-judged when the phone changed — the message stayed and the
// next submit stayed blocked. The invariant is now a computed over current form values.
describe('contact page — F-6 stale contact-method error', () => {
  // The exact reported sequence.
  it('clears the shared error when a phone is entered after a failed submit, and submits', async () => {
    const wrapper = await mountSuspended(ContactPage)

    // 1-2. Submit with both methods empty → the shared error appears.
    await fillAndSubmit(wrapper, { email: '' })
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(translate('contact.errors.contactMethodRequired'))

    // 3-4. Enter a valid phone → the stale error must go immediately, with no resubmit needed.
    await wrapper.find('input[name="nationalNumber"]').setValue('1002785408')
    await flush()
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))

    // 5. Resubmission proceeds without a page reload.
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(post).toHaveBeenCalledTimes(1)
    const [, options] = post.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(options.body.phone).toBe('+201002785408')
  })

  it('clears the shared error when an email is entered instead', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    expect(wrapper.text()).toContain(translate('contact.errors.contactMethodRequired'))

    await wrapper.find('input[name="email"]').setValue('alex@example.com')
    await flush()
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))
  })

  it('restores the shared error when both methods are emptied again', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    await wrapper.find('input[name="nationalNumber"]').setValue('1002785408')
    await flush()
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))

    await wrapper.find('input[name="nationalNumber"]').setValue('')
    await flush()
    expect(wrapper.text()).toContain(translate('contact.errors.contactMethodRequired'))
  })

  it('keeps a malformed email as an email-specific error while a valid phone is present', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('1002785408')
    await fillAndSubmit(wrapper, { email: 'not-an-email' })
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(translate('contact.errors.emailInvalid'))
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))
  })

  it('keeps a malformed phone as a phone-specific error while a valid email is present', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await wrapper.find('input[name="nationalNumber"]').setValue('12')
    await fillAndSubmit(wrapper)
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(translate('contact.errors.phoneInvalid'))
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))
  })

  it('shows the shared error exactly once, never duplicated', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    await wrapper.find('form').trigger('submit')
    await flush()
    const matches = wrapper.text().split(translate('contact.errors.contactMethodRequired')).length - 1
    expect(matches).toBe(1)
  })

  it('associates the shared error with the email input for assistive technology', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    const email = wrapper.find('input[name="email"]')
    expect(email.attributes('aria-describedby')).toBe('contact-method-error')
    // `aria-invalid` is owned by UFormField's own error state and is deliberately not overridden
    // here; the announcement comes from role="alert" plus the describedby association.
    expect(wrapper.find('#contact-method-error').attributes('role')).toBe('alert')
  })

  it('does not show the shared error on first paint', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))
  })
})

// ── success-state lifecycle ───────────────────────────────────────────────────────────────────
describe('contact page — success state', () => {
  it('replaces the form with a success state after a confirmed 200', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain(translate('contact.success.title'))
    expect(wrapper.text()).toContain(translate('contact.success.body'))
    // The form itself is gone, not merely topped with a banner.
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('never claims the message was persisted in an inbox', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).not.toMatch(/inbox|delivered|stored|saved/i)
  })

  it('keeps the direct-contact methods visible in the left column', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const html = wrapper.html()
    expect(html).toContain('mailto:contact@eslammuatamed.com')
    expect(html).toContain('tel:+201002785408')
    expect(html).toContain('wa.me/201002785408')
  })

  it('announces the state and exposes a focusable heading', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const region = wrapper.find('[role="status"]')
    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-live')).toBe('polite')
    expect(wrapper.find('h2[tabindex="-1"]').text()).toBe(translate('contact.success.title'))
  })

  it('offers Send another message, which restores a fresh empty form', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)

    const again = wrapper.findAll('button').find(b => b.text() === translate('contact.success.again'))
    expect(again).toBeDefined()
    await again!.trigger('click')
    await flush()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).not.toContain(translate('contact.success.title'))
    expect((wrapper.find('input[name="name"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.find('input[name="company-url"]').element as HTMLInputElement).value).toBe('')
  })

  it('clears the honeypot and stale validation errors on success', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper, { email: '' })
    expect(wrapper.text()).toContain(translate('contact.errors.contactMethodRequired'))

    await wrapper.find('input[name="company-url"]').setValue('bot')
    await wrapper.find('input[name="email"]').setValue('alex@example.com')
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(wrapper.text()).toContain(translate('contact.success.title'))
    expect(wrapper.text()).not.toContain(translate('contact.errors.contactMethodRequired'))
  })

  it('sends a fresh elapsedMs on the next submission after Send another message', async () => {
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    const again = wrapper.findAll('button').find(b => b.text() === translate('contact.success.again'))
    await again!.trigger('click')
    await flush()

    await fillAndSubmit(wrapper)
    expect(post).toHaveBeenCalledTimes(2)
    const [, second] = post.mock.calls[1] as [string, { body: { elapsedMs: number } }]
    expect(second.body.elapsedMs).toBeGreaterThanOrEqual(3000)
  })

  it('keeps recoverable errors inline in the form panel, not as a success state', async () => {
    post.mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Boom', status: 500 }))
    const wrapper = await mountSuspended(ContactPage)
    await fillAndSubmit(wrapper)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain(translate('contact.error.serverTitle'))
    expect(wrapper.text()).not.toContain(translate('contact.success.title'))
  })
})

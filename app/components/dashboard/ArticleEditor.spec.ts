// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ArticleEditor from './ArticleEditor.vue'
import SeoPanel from './SeoPanel.vue'
import MediaPicker from './MediaPicker.vue'
import { ApiError } from '~/utils/api-error'
import type { AdminArticle, AdminArticleTranslation } from '~/composables/admin-article-types'

/**
 * The Articles editor, asserted through the real rendered component.
 *
 * `admin-article-form.spec.ts` proves the pure rules — the payload, the schema, and the
 * index→locale resolution. This file proves the COMPONENT wires them: that a 422 naming
 * `translations[N].slug` reaches the right input, that the offending tab is activated and marked,
 * and that a save that fails keeps the operator's text.
 *
 * The 422 case is here rather than only in the browser lane because it is the one behaviour whose
 * failure mode is silent: a mapping that resolves to the wrong locale still renders "an error", and
 * a browser test asserting only that an error appeared would pass against it.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, method: string, body?: unknown }>,
  article: null as unknown,
  /** When set, the NEXT write rejects with this. */
  writeError: null as unknown,
  /** Parks the entity READ, so the pre-resolution state is observable. */
  parkRead: false,
  release: null as null | (() => void)
}))

mockNuxtImport('useApi', () => () => async (path: string, options: Record<string, unknown> = {}) => {
  const method = String(options.method ?? 'GET').toUpperCase()
  holder.calls.push({ path, method, body: options.body })

  if (method === 'GET') {
    if (path.startsWith('/admin/articles/') && holder.parkRead) {
      await new Promise<void>((resolve) => { holder.release = resolve })
    }
    if (path === '/admin/categories') {
      return { data: [{ id: 'cat-1', translations: { en: { name: 'Engineering', slug: 'engineering' } } }] }
    }
    if (path === '/admin/tags') return { data: [] }
    // The OG picker resolves every stored reference through `GET /admin/media/:id`. Without this
    // branch the generic fallback below would hand the picker an ARTICLE, and `thumbnailFor`
    // would throw `variants is not iterable` while rendering.
    if (path.startsWith('/admin/media')) {
      return { data: {
        id: path.split('/').pop(), kind: 'IMAGE', url: 'u', mimeType: 'image/png', sizeBytes: 10,
        originalFilename: 'og.png', width: 1, height: 1, blurhash: null, contentHash: 'h',
        variants: [], alts: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
      } }
    }
    if (path.startsWith('/admin/articles/')) return { data: holder.article }
    return { data: [], meta: { page: 1, perPage: 12, total: 0, totalPages: 1 } }
  }

  if (holder.release !== null) {
    await new Promise<void>((resolve) => { holder.release = resolve })
  }
  if (holder.writeError) {
    const error = holder.writeError
    holder.writeError = null
    throw error
  }
  return { data: holder.article }
})

function translation(over: Partial<AdminArticleTranslation> = {}): AdminArticleTranslation {
  return {
    title: 'A modular monolith in practice',
    slug: 'a-modular-monolith-in-practice',
    excerpt: 'e',
    body: '# b',
    readingTimeMin: 4,
    metaTitle: null,
    metaDescription: null,
    ogImageId: null,
    canonicalUrl: null,
    ...over
  }
}

function article(over: Partial<AdminArticle> = {}): AdminArticle {
  return {
    id: 'a1',
    status: 'DRAFT',
    publishAt: null,
    categoryId: 'cat-1',
    coverImageId: null,
    tagIds: [],
    translations: {
      en: translation(),
      ar: translation({ title: 'الهندسة', slug: 'الهندسة-المعمارية' })
    },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over
  }
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  holder.release = null
  holder.writeError = null
  holder.parkRead = false
})

async function mount(entity: AdminArticle | null = article()) {
  holder.calls = []
  holder.article = entity
  const wrapper = await mountSuspended(ArticleEditor, { props: { id: entity ? entity.id : null } })
  mounted = wrapper
  await flushPromises()
  await flushPromises()
  return wrapper
}

const invalid = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, selector: string) =>
  wrapper.find(selector).attributes('aria-invalid')

/**
 * Submit the form.
 *
 * Through the FORM element, not by clicking `[data-editor-save]`: that control is a `UButton` with
 * `type="submit"`, and a synthetic click on it does not produce the implicit form submission a real
 * browser performs. The click path is covered in the browser lane, where the browser does it.
 */
async function submit(wrapper: Awaited<ReturnType<typeof mountSuspended>>): Promise<void> {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  await flushPromises()
}

describe('a 422 lands on the right locale', () => {
  /**
   * THE DISCRIMINATING ASSERTION.
   *
   * The write sends `[en, ar]`, so `translations[1].slug` is the ARABIC slug. An implementation that
   * assumed a fixed order, or that attached errors by field name alone, puts this on the English
   * input — which looks like a real error against a value that is fine.
   */
  it('attaches translations[1].slug to the ARABIC input, not the English one', async () => {
    const wrapper = await mount()
    holder.writeError = new ApiError({
      type: '/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: '1 field failed validation.',
      errors: [{ field: 'translations[1].slug', message: "Slug already exists for locale 'ar'." }]
    })

    await submit(wrapper)
    await flushPromises()
    await flushPromises()

    expect(invalid(wrapper, '[data-editor-slug="ar"]'), 'the Arabic slug is the invalid one').toBe('true')
    expect(invalid(wrapper, '[data-editor-slug="en"]'), 'the English slug is fine').not.toBe('true')
  })

  it('attaches translations[0].slug to the ENGLISH input — the mirror case', async () => {
    const wrapper = await mount()
    holder.writeError = new ApiError({
      type: '/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: '1 field failed validation.',
      errors: [{ field: 'translations[0].slug', message: "Slug already exists for locale 'en'." }]
    })

    await submit(wrapper)
    await flushPromises()
    await flushPromises()

    expect(invalid(wrapper, '[data-editor-slug="en"]')).toBe('true')
    expect(invalid(wrapper, '[data-editor-slug="ar"]')).not.toBe('true')
  })

  it('marks the offending TAB invalid and names the language in the summary', async () => {
    const wrapper = await mount()
    holder.writeError = new ApiError({
      type: '/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: '1 field failed validation.',
      errors: [{ field: 'translations[1].slug', message: "Slug already exists for locale 'ar'." }]
    })

    await submit(wrapper)
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[data-editor-tab-invalid="ar"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-editor-tab-invalid="en"]').exists(),
      'the sound tab must not be blamed'
    ).toBe(false)
    expect(wrapper.find('[data-editor-error-summary]').exists()).toBe(true)
  })

  it('keeps a non-field failure as a form-level message instead of guessing a field', async () => {
    const wrapper = await mount()
    holder.writeError = new ApiError({
      type: 'about:blank', title: 'Save failed', status: 500, detail: 'Server error.'
    })

    await submit(wrapper)
    await flushPromises()

    expect(wrapper.find('[data-editor-save-error]').exists()).toBe(true)
    expect(invalid(wrapper, '[data-editor-slug="en"]')).not.toBe('true')
    expect(invalid(wrapper, '[data-editor-slug="ar"]')).not.toBe('true')
  })
})

describe('a failed save preserves the operator\'s work', () => {
  it('keeps the edited value on screen', async () => {
    const wrapper = await mount()
    const input = wrapper.find('[data-editor-title="en"]')
    await input.setValue('Words worth keeping')
    holder.writeError = new ApiError({ type: 'about:blank', title: 'Save failed', status: 500 })

    await submit(wrapper)
    await flushPromises()

    expect((wrapper.find('[data-editor-title="en"]').element as HTMLInputElement).value)
      .toBe('Words worth keeping')
  })
})

describe('what it sends', () => {
  it('sends EVERY in-use locale, not only the edited one', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-editor-title="en"]').setValue('Changed English only')
    await submit(wrapper)
    await flushPromises()

    const write = holder.calls.find(call => call.method === 'PATCH')
    const body = write?.body as { translations: { locale: string }[] }
    // The PATCH upserts per locale and never deletes, so sending only the edited tab would leave
    // the other language's stored text untouched while the operator believes all of it was saved.
    expect(body.translations.map(entry => entry.locale)).toEqual(['en', 'ar'])
  })

  it('never sends readingTimeMin', async () => {
    const wrapper = await mount()
    await submit(wrapper)
    await flushPromises()
    const write = holder.calls.find(call => call.method === 'PATCH')
    const body = write?.body as { translations: Record<string, unknown>[] }
    expect(body.translations[0]).not.toHaveProperty('readingTimeMin')
  })
})

describe('§14.9 criterion 3 — no blank fields before the entity resolves', () => {
  it('renders a loading state instead of an empty form', async () => {
    holder.calls = []
    holder.article = article()
    holder.parkRead = true
    const wrapper = await mountSuspended(ArticleEditor, { props: { id: 'a1' } })
    mounted = wrapper
    await flushPromises()

    // The read is parked, so this is the state a slow network really produces.
    expect(wrapper.find('[data-editor-loading]').exists()).toBe(true)
    expect(
      wrapper.find('[data-editor-title="en"]').exists(),
      'an editable field here invites overwriting content that has not arrived'
    ).toBe(false)
    expect(wrapper.find('[data-editor-save]').exists()).toBe(false)
  })
})

/**
 * SEO-U3a — the shared panel refit. The four per-locale SEO fields are presented by
 * `DashboardSeoPanel` now; these tests prove the wiring is mechanical: the SAME form state the
 * payload builder reads, per-locale isolation intact, server errors still landing on the right
 * locale, and no duplicate or Project-specific presentation anywhere in the editor.
 */
describe('the shared SEO panel is wired to the article form', () => {
  it('renders one DashboardSeoPanel per mounted locale panel', async () => {
    const wrapper = await mount()
    const panels = wrapper.findAll('[data-editor-panel]')
    expect(wrapper.findAllComponents(SeoPanel).length).toBe(panels.length)
  })

  it('no longer renders the old duplicated SEO controls', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-editor-meta-title]').exists()).toBe(false)
  })

  it('routes an EN meta title edit into the payload the builder produces', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-editor-panel="en"] [data-seo-field="metaTitle"]').setValue('New EN title')
    await submit(wrapper)
    const write = holder.calls.find(call => call.method === 'PATCH')
    const en = (write?.body as { translations: Array<{ locale: string, metaTitle: string | null }> })
      .translations.find(entry => entry.locale === 'en')
    expect(en?.metaTitle).toBe('New EN title')
  })

  it('routes EN meta description and canonical URL edits the same way', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-editor-panel="en"] [data-seo-field="metaDescription"]').setValue('New EN description')
    await wrapper.find('[data-editor-panel="en"] [data-seo-field="canonicalUrl"]').setValue('https://example.com/canonical-en')
    await submit(wrapper)
    const write = holder.calls.find(call => call.method === 'PATCH')
    const en = (write?.body as { translations: Array<{ locale: string, metaDescription: string | null, canonicalUrl: string | null }> })
      .translations.find(entry => entry.locale === 'en')
    expect(en?.metaDescription).toBe('New EN description')
    expect(en?.canonicalUrl).toBe('https://example.com/canonical-en')
  })

  it('sends a picked OG image id and a CLEARED one as explicit null (D10-23)', async () => {
    const wrapper = await mount()
    const picker = wrapper.find('[data-editor-panel="en"] [data-seo-picker]').findComponent(MediaPicker)
    expect(picker.exists()).toBe(true)

    picker.vm.$emit('update:modelValue', 'asset-en-1')
    await flushPromises()
    holder.calls = []
    await submit(wrapper)
    const picked = holder.calls.find(call => call.method === 'PATCH')
    const pickedBody = (picked?.body as { translations: Array<{ locale: string, ogImageId: string | null }> })
      .translations.find(entry => entry.locale === 'en')
    expect(pickedBody?.ogImageId).toBe('asset-en-1')

    // The clear path: the picker emits null through the panel untouched.
    const wrapper2 = await mount()
    const picker2 = wrapper2.find('[data-editor-panel="en"] [data-seo-picker]').findComponent(MediaPicker)
    picker2.vm.$emit('update:modelValue', 'asset-temp')
    await flushPromises()
    picker2.vm.$emit('update:modelValue', null)
    await flushPromises()
    holder.calls = []
    await submit(wrapper2)
    const cleared = holder.calls.find(call => call.method === 'PATCH')
    const clearedBody = (cleared?.body as { translations: Array<{ locale: string, ogImageId: string | null }> })
      .translations.find(entry => entry.locale === 'en')
    expect(clearedBody?.ogImageId).toBeNull()
  })

  it('keeps EN and AR SEO state independent — editing one leaves the other stored value alone', async () => {
    const wrapper = await mount(article({
      translations: {
        en: translation({ metaTitle: 'English held title' }),
        ar: translation({ metaTitle: 'عنوان محفوظ' })
      }
    }))
    await wrapper.find('[data-editor-panel="en"] [data-seo-field="metaTitle"]').setValue('Only English changed')
    await submit(wrapper)

    const write = holder.calls.find(call => call.method === 'PATCH')
    const body = write?.body as { translations: Array<{ locale: string, metaTitle: string | null }> }
    expect(body.translations.find(entry => entry.locale === 'en')?.metaTitle).toBe('Only English changed')
    expect(body.translations.find(entry => entry.locale === 'ar')?.metaTitle).toBe('عنوان محفوظ')
  })

  it('lands an indexed canonicalUrl 422 on the ARABIC panel input and marks that tab invalid', async () => {
    const wrapper = await mount()
    holder.writeError = new ApiError({
      type: '/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: '1 field failed validation.',
      errors: [{ field: 'translations[1].canonicalUrl', message: 'Must be a valid URI.' }]
    })

    await submit(wrapper)
    await flushPromises()

    const arInput = wrapper.find('[data-editor-panel="ar"] [data-seo-field="canonicalUrl"]')
    expect(arInput.attributes('aria-invalid'), 'the Arabic canonical input carries the error').toBe('true')
    expect(
      wrapper.find('[data-editor-panel="en"] [data-seo-field="canonicalUrl"]').attributes('aria-invalid')
    ).not.toBe('true')
    expect(wrapper.find('[data-editor-tab-invalid="ar"]').exists()).toBe(true)
  })

  it('marks the form unsaved after an SEO edit', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-editor-panel="en"] [data-seo-field="metaTitle"]').setValue('Dirtying the form')
    await flushPromises()
    expect(wrapper.find('[data-editor-save-state="unsaved"]').exists()).toBe(true)
  })

  it('carries no Projects presentation anywhere in the rendered editor', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-project-field]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('dashboard.projects.')
  })
})

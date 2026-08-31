// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ProjectEditor from './ProjectEditor.vue'
import SeoPanel from './SeoPanel.vue'
import MediaPicker from './MediaPicker.vue'
import { ApiError } from '~/utils/api-error'
import { REQUIRED_TRANSLATION_FIELDS } from '~/composables/admin-project-form'
import type { AdminProject, AdminProjectTranslation } from '~/composables/admin-project-types'

/**
 * The editor, asserted through the REAL rendered form.
 *
 * `admin-project-form.spec.ts` proves the rules. This proves the FORM obeys them — that the boxes
 * the operator sees are seeded per locale with no fallback, that a content save carries the
 * publication state it loaded rather than defaulting it, and that the API's own rejection reaches
 * the screen. A correct rule wired to the wrong control is exactly what a pure test cannot catch.
 */

const holder = vi.hoisted(() => ({
  calls: [] as Array<{ path: string, options: Record<string, unknown> }>,
  project: null as unknown,
  /** Status to fail the next WRITE with; reads always succeed unless `readStatus` is set. */
  writeStatus: 0,
  readStatus: 0,
  fieldErrors: [] as Array<{ field: string, message: string }>,
  /** Assigned after the imports — see the note in the list spec; the factory is hoisted above them. */
  makeError: null as null | ((status: number, errors: Array<{ field: string, message: string }>) => unknown)
}))

mockNuxtImport('useApi', () => () => (path: string, options: Record<string, unknown> = {}) => {
  holder.calls.push({ path, options })
  const method = String(options.method ?? 'GET').toUpperCase()

  if (path === '/admin/skills') {
    return Promise.resolve({ data: [
      { id: 'skill-a', slug: 'typescript', group: 'LANGUAGE', order: 1, brandColor: null, isPublic: true, translations: { en: { label: 'TypeScript' } } },
      { id: 'skill-b', slug: 'nestjs', group: 'BACKEND', order: 2, brandColor: null, isPublic: true, translations: { en: { label: 'NestJS' } } }
    ] })
  }

  // The media picker resolves each stored reference through `GET /admin/media/:id`. Without this
  // it would receive the project entity and fail inside the picker, which has nothing to do with
  // what any of these tests are about.
  if (path.startsWith('/admin/media')) {
    return Promise.resolve({ data: {
      id: path.split('/').pop(), kind: 'IMAGE', url: 'u', mimeType: 'image/webp', sizeBytes: 10,
      originalFilename: 'shot.png', width: 1, height: 1, blurhash: null, contentHash: 'h',
      variants: [], alts: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    } })
  }

  if (method === 'GET') {
    if (holder.readStatus !== 0) return Promise.reject(holder.makeError?.(holder.readStatus, []))
    return Promise.resolve({ data: holder.project })
  }

  if (holder.writeStatus !== 0) {
    return Promise.reject(holder.makeError?.(holder.writeStatus, holder.fieldErrors))
  }
  // The API answers a write with the FULL updated entity; echoing the request body would let the
  // form re-seed from something the server never confirmed.
  return Promise.resolve({ data: { ...(holder.project as AdminProject), id: 'created-1' } })
})

holder.makeError = (status, errors) =>
  new ApiError({ type: 'about:blank', title: 'Request failed', status, detail: 'The API said no.', errors })

function translation(over: Partial<AdminProjectTranslation> = {}): AdminProjectTranslation {
  return {
    title: 'Content platform API',
    slug: 'content-platform-api',
    summary: 's', overview: 'o', businessProblem: 'b', solution: 'so', role: 'r',
    architecture: 'a', challenges: 'c', features: 'f', lessonsLearned: 'l',
    metaTitle: null, metaDescription: null, ogImageId: null, canonicalUrl: null,
    ...over
  }
}

function project(over: Partial<AdminProject> = {}): AdminProject {
  return {
    id: 'p1',
    featured: false,
    isPublished: true,
    order: 3,
    liveUrl: 'https://example.com',
    repoUrl: null,
    year: 2026,
    technologyIds: ['skill-a'],
    gallery: [],
    translations: { en: translation() },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...over
  }
}

let mounted: Awaited<ReturnType<typeof mountSuspended>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

async function mount(id: string | null, options: {
  project?: AdminProject | null
  writeStatus?: number
  readStatus?: number
  fieldErrors?: Array<{ field: string, message: string }>
} = {}) {
  holder.calls = []
  holder.project = options.project ?? project()
  holder.writeStatus = options.writeStatus ?? 0
  holder.readStatus = options.readStatus ?? 0
  holder.fieldErrors = options.fieldErrors ?? []
  const wrapper = await mountSuspended(ProjectEditor, { props: { id } })
  mounted = wrapper
  await flushPromises()
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mount>>

const field = (wrapper: Wrapper, name: string) =>
  wrapper.find<HTMLInputElement | HTMLTextAreaElement>(`[data-project-field="${name}"]`)

async function fillLocale(wrapper: Wrapper, locale: 'en' | 'ar', prefix: string): Promise<void> {
  for (const name of REQUIRED_TRANSLATION_FIELDS) {
    await field(wrapper, `${locale}.${name}`).setValue(`${prefix} ${name}`)
  }
}

/** The body of the last write, whatever its verb. */
function lastWrite(): { method: string, path: string, body: Record<string, unknown> } | null {
  const call = [...holder.calls].reverse().find(c => c.options.method !== undefined && c.options.method !== 'GET')
  if (!call) return null
  return {
    method: String(call.options.method),
    path: call.path,
    body: call.options.body as Record<string, unknown>
  }
}

/**
 * Submit the FORM, not the button.
 *
 * The save button is `type="submit"` and a real browser turns a click on it into the form's submit
 * event — happy-dom does not, so a click here reaches nothing and every assertion about the request
 * would pass vacuously. The button's own disabled state is asserted separately.
 */
async function save(wrapper: Wrapper): Promise<void> {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  await flushPromises()
}

/* ────────────────────────────────────────────────────────────────────────────────────────────── */

describe('the read is locale-agnostic', () => {
  it('sends `locale: false`, because an unsolicited ?locale= is a 422 on a forbidNonWhitelisted DTO', async () => {
    await mount('p1')
    const read = holder.calls.find(c => c.path === '/admin/projects/p1')
    expect(read?.options.locale).toBe(false)
  })

  it('reads the skill vocabulary the technology ids are drawn from, also without a locale', async () => {
    await mount('p1')
    const skills = holder.calls.find(c => c.path === '/admin/skills')
    expect(skills?.options.locale).toBe(false)
  })
})

describe('EN and AR are both editable, and neither borrows from the other', () => {
  it('seeds each locale from ITS OWN translation', async () => {
    const wrapper = await mount('p1', {
      project: project({ translations: { en: translation(), ar: translation({ title: 'منصة المحتوى', slug: 'mnsah' }) } })
    })
    expect(field(wrapper, 'en.title').element.value).toBe('Content platform API')
    expect(field(wrapper, 'ar.title').element.value).toBe('منصة المحتوى')
  })

  /**
   * THE TRAP FIXTURE. English is fully written and there is no Arabic translation at all, so a form
   * with any cross-locale fallback would show English in the Arabic boxes — and publish it under
   * the Arabic URL on the next save.
   */
  it('leaves EVERY Arabic box empty when the project has no Arabic translation', async () => {
    const wrapper = await mount('p1', { project: project({ translations: { en: translation() } }) })
    expect(field(wrapper, 'en.title').element.value).toBe('Content platform API')
    for (const name of REQUIRED_TRANSLATION_FIELDS) {
      expect(field(wrapper, `ar.${name}`).element.value, `ar.${name}`).toBe('')
    }
  })

  it('labels a missing language as such, rather than hiding it', async () => {
    const wrapper = await mount('p1', { project: project({ translations: { en: translation() } }) })
    expect(wrapper.find('[data-locale-state="en:complete"]').exists()).toBe(true)
    expect(wrapper.find('[data-locale-state="ar:empty"]').exists()).toBe(true)
  })

  it('keeps each translation field mounted with its own content direction', async () => {
    const wrapper = await mount('p1', {
      project: project({ translations: { en: translation(), ar: translation({ title: 'منصة المحتوى', slug: 'mnsah' }) } })
    })
    expect(wrapper.find('[data-editor-tabs]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-panel="en"]').attributes('dir')).toBeUndefined()
    expect(wrapper.find('[data-editor-panel="ar"]').attributes('dir')).toBeUndefined()
    expect(field(wrapper, 'en.title').attributes('dir')).toBe('ltr')
    expect(field(wrapper, 'ar.title').attributes('dir')).toBe('rtl')
  })

  it('sends BOTH languages once the second is written, not only the edited one', async () => {
    const wrapper = await mount('p1', { project: project({ translations: { en: translation() } }) })
    await fillLocale(wrapper, 'ar', 'عربي')
    await save(wrapper)
    const translations = lastWrite()?.body.translations as Array<{ locale: string }>
    expect(translations.map(t => t.locale).sort()).toEqual(['ar', 'en'])
  })
})

describe('editing does not silently change publication', () => {
  /**
   * `UpdateProjectDto` gives `isPublished` a `default: false` and declares no `required` array, so
   * an OMITTED `isPublished` is indistinguishable from an explicit `false` at the DTO boundary. A
   * content-only save that omitted it could unpublish a live case study.
   */
  it('carries the loaded publication state on a content-only save', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: true }) })
    await field(wrapper, 'en.summary').setValue('A new summary')
    await save(wrapper)
    expect(lastWrite()?.body.isPublished).toBe(true)
  })

  it('leaves an unpublished project unpublished when only its content changes', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: false }) })
    await field(wrapper, 'en.summary').setValue('A new summary')
    await save(wrapper)
    expect(lastWrite()?.body.isPublished).toBe(false)
  })

  it('says, before the save, that an unpublished project stays unpublished', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: false }) })
    expect(wrapper.find('[data-publication-notice="stays-unpublished"]').exists()).toBe(true)
  })

  it('publishes only when the publication switch is moved, and says so first', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: false }) })
    await wrapper.find('[data-project-published-switch]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-publication-notice="publish"]').exists()).toBe(true)
    await save(wrapper)
    expect(lastWrite()?.body.isPublished).toBe(true)
  })

  it('unpublishes only when the switch is moved the other way, and warns first', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: true }) })
    await wrapper.find('[data-project-published-switch]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-publication-notice="unpublish"]').exists()).toBe(true)
    await save(wrapper)
    expect(lastWrite()?.body.isPublished).toBe(false)
  })
})

describe('featured, order, year and the nullable URLs', () => {
  it('toggles featured independently of publication', async () => {
    const wrapper = await mount('p1', { project: project({ featured: false, isPublished: true }) })
    await wrapper.find('[data-project-featured-switch]').trigger('click')
    await save(wrapper)
    expect(lastWrite()?.body.featured).toBe(true)
    expect(lastWrite()?.body.isPublished).toBe(true)
  })

  it('sends a changed order', async () => {
    const wrapper = await mount('p1')
    await wrapper.find('[data-project-order]').setValue('11')
    await save(wrapper)
    expect(lastWrite()?.body.order).toBe(11)
  })

  it('sends NULL for an emptied live or repository URL, not an empty string', async () => {
    const wrapper = await mount('p1', { project: project({ liveUrl: 'https://example.com', repoUrl: 'https://github.com/x/y' }) })
    await wrapper.find('[data-project-live-url]').setValue('')
    await wrapper.find('[data-project-repo-url]').setValue('')
    await save(wrapper)
    expect(lastWrite()?.body.liveUrl).toBeNull()
    expect(lastWrite()?.body.repoUrl).toBeNull()
  })

  it('sends a null year for an emptied year box', async () => {
    const wrapper = await mount('p1', { project: project({ year: 2026 }) })
    await wrapper.find('[data-project-year]').setValue('')
    await save(wrapper)
    expect(lastWrite()?.body.year).toBeNull()
  })
})

describe('technologies', () => {
  it('seeds the ticked technologies from the project', async () => {
    const wrapper = await mount('p1', { project: project({ technologyIds: ['skill-a'] }) })
    expect(wrapper.find('[data-technology="skill-a"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-technology="skill-b"]').attributes('aria-checked')).toBe('false')
  })

  it('sends the whole set after a change — the API REPLACES the relation with it', async () => {
    const wrapper = await mount('p1', { project: project({ technologyIds: ['skill-a'] }) })
    await wrapper.find('[data-technology="skill-b"]').trigger('click')
    await save(wrapper)
    expect(lastWrite()?.body.technologyIds).toEqual(['skill-a', 'skill-b'])
  })

  /**
   * `M1·U4b` REGRESSION GUARD. `ProjectTechnologyPicker` became the shared `DashboardSkillPicker`
   * and its copy moved from i18n keys it looked up itself to LABEL PROPS the parent passes in.
   *
   * That change fails in a specific, quiet way: a missing or misspelled key on the parent side
   * renders the literal string `undefined` into the picker, and every assertion above still passes
   * because they all read `data-technology*` attributes rather than text. So the text is asserted
   * here, against the one surface that carries it.
   */
  it('renders real copy from the labels the parent passes, not undefined', async () => {
    const wrapper = await mount('p1', { project: project({ technologyIds: ['skill-a'] }) })
    const count = wrapper.find('[data-technologies-count]')
    expect(count.exists()).toBe(true)
    expect(count.text()).not.toBe('')
    expect(count.text()).not.toContain('undefined')
    // The count is interpolated from the selection, so it must reflect it rather than be static.
    expect(count.text()).toContain('1')
    // A raw i18n key path reaching the screen is the other failure mode of a copy change.
    expect(wrapper.text()).not.toMatch(/dashboard\.projects\.editor\.technolog/)
  })

  it('keeps a selected id the vocabulary cannot name, rather than dropping it', async () => {
    // `technologyIds` is replaced on save, so a selection that vanished from the UI would be
    // deleted from the project by the next save.
    const wrapper = await mount('p1', { project: project({ technologyIds: ['skill-a', 'ghost-id'] }) })
    expect(wrapper.find('[data-technology-unknown="ghost-id"]').exists()).toBe(true)
    await field(wrapper, 'en.summary').setValue('changed')
    await save(wrapper)
    expect(lastWrite()?.body.technologyIds).toEqual(['skill-a', 'ghost-id'])
  })
})

describe('the gallery', () => {
  it('sends the rows in array order, numbering `order` from the array', async () => {
    const wrapper = await mount('p1', {
      project: project({ gallery: [
        { id: 'g1', mediaAssetId: 'm1', order: 0, translations: { en: { caption: 'First' } } },
        { id: 'g2', mediaAssetId: 'm2', order: 1, translations: {} }
      ] })
    })
    await wrapper.find('[data-gallery-caption="1.en"]').setValue('Second')
    await save(wrapper)
    expect(lastWrite()?.body.gallery).toEqual([
      { mediaAssetId: 'm1', order: 0, translations: { en: { caption: 'First' }, ar: { caption: null } } },
      { mediaAssetId: 'm2', order: 1, translations: { en: { caption: 'Second' }, ar: { caption: null } } }
    ])
  })

  it('renumbers after a reorder', async () => {
    const wrapper = await mount('p1', {
      project: project({ gallery: [
        { id: 'g1', mediaAssetId: 'm1', order: 0, translations: {} },
        { id: 'g2', mediaAssetId: 'm2', order: 1, translations: {} }
      ] })
    })
    await wrapper.find('[data-gallery-down="0"]').trigger('click')
    await save(wrapper)
    const gallery = lastWrite()?.body.gallery as Array<{ mediaAssetId: string, order: number }>
    expect(gallery.map(item => [item.mediaAssetId, item.order])).toEqual([['m2', 0], ['m1', 1]])
  })

  it('BLOCKS the save when a row has no image, and says which row', async () => {
    const wrapper = await mount('p1')
    await wrapper.find('[data-gallery-add]').trigger('click')
    await flushPromises()
    await save(wrapper)
    expect(lastWrite()).toBeNull()
    expect(wrapper.find('[data-gallery-error="0"]').exists()).toBe(true)
  })
})

describe('slug changes on a PUBLISHED project (D04-6)', () => {
  it('warns, naming the locale, and does not write a redirect itself', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: true }) })
    await field(wrapper, 'en.slug').setValue('content-platform')
    await flushPromises()
    expect(wrapper.find('[data-slug-warning]').exists()).toBe(true)
    expect(wrapper.find('[data-slug-warning-locale="en"]').text()).toContain('content-platform-api')

    await save(wrapper)
    // The API auto-creates the redirect record; the client must never send one of its own.
    expect(holder.calls.some(c => c.path.includes('redirect'))).toBe(false)
  })

  it('does NOT warn for a project that is not published', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: false }) })
    await field(wrapper, 'en.slug').setValue('content-platform')
    await flushPromises()
    expect(wrapper.find('[data-slug-warning]').exists()).toBe(false)
  })

  it('does NOT warn when the slug is untouched', async () => {
    const wrapper = await mount('p1', { project: project({ isPublished: true }) })
    await field(wrapper, 'en.summary').setValue('Only the summary moved')
    await flushPromises()
    expect(wrapper.find('[data-slug-warning]').exists()).toBe(false)
  })
})

describe('validation refuses a save rather than losing work', () => {
  it('BLOCKS a partly written language and names the empty fields', async () => {
    const wrapper = await mount('p1', { project: project({ translations: { en: translation() } }) })
    await field(wrapper, 'ar.title').setValue('عنوان')
    await save(wrapper)
    expect(lastWrite()).toBeNull()
    expect(wrapper.find('[data-error-partial]').exists()).toBe(true)
    expect(wrapper.find('[data-error-partial-locale="ar"]').text()).toContain('Slug')
    // The work is still on screen.
    expect(field(wrapper, 'ar.title').element.value).toBe('عنوان')
  })

  it('BLOCKS emptying a language the server has saved', async () => {
    const wrapper = await mount('p1', {
      project: project({ translations: { en: translation(), ar: translation({ title: 'منصة', slug: 'mnsah' }) } })
    })
    for (const name of REQUIRED_TRANSLATION_FIELDS) {
      await field(wrapper, `ar.${name}`).setValue('')
    }
    await save(wrapper)
    expect(lastWrite()).toBeNull()
    expect(wrapper.find('[data-error-cleared]').exists()).toBe(true)
  })

  it('BLOCKS a create with no complete language', async () => {
    const wrapper = await mount(null)
    await save(wrapper)
    expect(lastWrite()).toBeNull()
    expect(wrapper.find('[data-error-no-translation]').exists()).toBe(true)
  })
})

describe('creating', () => {
  it('POSTs a complete project, unpublished unless the switch was moved', async () => {
    const wrapper = await mount(null)
    await fillLocale(wrapper, 'en', 'New')
    await save(wrapper)

    const write = lastWrite()
    expect(write?.method).toBe('POST')
    expect(write?.path).toBe('/admin/projects')
    expect(write?.body.isPublished).toBe(false)
    expect(write?.body.featured).toBe(false)
    expect((write?.body.translations as Array<{ locale: string, title: string }>)[0]).toMatchObject({
      locale: 'en',
      title: 'New title'
    })
  })

  it('does not read a project before there is one', async () => {
    await mount(null)
    expect(holder.calls.some(c => c.path.startsWith('/admin/projects/'))).toBe(false)
  })
})

describe('editing', () => {
  it('PATCHes the project by id', async () => {
    const wrapper = await mount('p1')
    await field(wrapper, 'en.summary').setValue('Moved')
    await save(wrapper)
    expect(lastWrite()?.method).toBe('PATCH')
    expect(lastWrite()?.path).toBe('/admin/projects/p1')
  })

  it('uses the persistent shared actions even while the hydrated editor is clean', async () => {
    const wrapper = await mount('p1')
    expect(wrapper.find('[data-editor-actions]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-save]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-save-state="idle"]').exists()).toBe(true)
  })

  it('owns save and delete presentation through the shared entity actions component', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/components/dashboard/ProjectEditor.vue'), 'utf8')
    expect(source).toContain('<DashboardEntityFormActions')
  })

  it('uses the shared translation tabs instead of rendering concurrent locale panels', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/components/dashboard/ProjectEditor.vue'), 'utf8')
    expect(source).toContain('<DashboardTranslationTabs')
    expect(source).not.toContain('v-for="contentLocale in PROJECT_LOCALES"')
  })
})

describe('the API\'s own answer reaches the screen (RFC 7807)', () => {
  it('renders the problem detail and every field error a 422 carries', async () => {
    const wrapper = await mount('p1', {
      writeStatus: 422,
      fieldErrors: [
        { field: 'liveUrl', message: 'must be a URL' }
      ]
    })
    await field(wrapper, 'en.summary').setValue('Moved')
    await save(wrapper)

    const alert = wrapper.find('[data-save-error]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('The API said no.')
    expect(wrapper.find('[data-save-field-error="liveUrl"]').text()).toContain('must be a URL')
  })

  it('routes an indexed translation 422 to the sent Arabic locale, field, and tab', async () => {
    const wrapper = await mount('p1', {
      project: project({ translations: { en: translation(), ar: translation({ title: 'منصة المحتوى', slug: 'mnsah' }) } }),
      writeStatus: 422,
      fieldErrors: [{ field: 'translations[1].slug', message: 'slug already exists' }]
    })
    await field(wrapper, 'en.summary').setValue('Moved')
    await save(wrapper)

    expect(field(wrapper, 'ar.slug').attributes('aria-invalid')).toBe('true')
    expect(field(wrapper, 'en.slug').attributes('aria-invalid')).not.toBe('true')
    expect(wrapper.find('[data-editor-tab-invalid="ar"]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-error-summary]').text()).toContain('slug already exists')
    expect(wrapper.find('[data-save-error]').exists()).toBe(false)
  })

  it('keeps the operator\'s edits after a rejected save', async () => {
    const wrapper = await mount('p1', { writeStatus: 500 })
    await field(wrapper, 'en.summary').setValue('Still here')
    await save(wrapper)
    expect(wrapper.find('[data-save-error]').exists()).toBe(true)
    expect(field(wrapper, 'en.summary').element.value).toBe('Still here')
  })

  it('shows a FORBIDDEN surface when the read is refused, not an empty form', async () => {
    const wrapper = await mount('p1', { readStatus: 403 })
    expect(wrapper.find('[data-project-forbidden]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-save]').exists()).toBe(false)
  })

  it('says a project does not exist rather than offering a blank editor', async () => {
    const wrapper = await mount('p1', { readStatus: 404 })
    expect(wrapper.find('[data-project-not-found]').exists()).toBe(true)
  })
})

/**
 * SEO-U3b — the shared panel refit. The four per-locale SEO fields are presented by
 * `DashboardSeoPanel` (titled mode — the panel owns the fieldset/legend this file used to
 * duplicate). These tests prove the wiring is mechanical: edits land in the SAME form state the
 * SEO-U2 payload builder reads, locales stay isolated, and a cleared value travels as explicit
 * `null` while an untouched one is omitted.
 */
describe('the shared SEO panel is wired to the project form', () => {
  const seoInput = (wrapper: Wrapper, locale: 'en' | 'ar', field: string) =>
    wrapper.find(`[data-locale-section="${locale}"] [data-seo-field="${field}"]`)

  const enTranslationWith = (over: Partial<AdminProjectTranslation>): AdminProject => project({
    translations: {
      en: translation({
        metaTitle: 'Held EN title',
        metaDescription: 'Held EN description',
        canonicalUrl: 'https://held.example.com/en',
        ogImageId: 'asset-held-en',
        ...over
      }),
      ar: translation({ title: 'منصة المحتوى', slug: 'mnsah' })
    }
  })

  it('renders one DashboardSeoPanel per locale section, titled by the shared keys', async () => {
    const wrapper = await mount('p1', { project: project({ translations: { en: translation(), ar: translation({ title: 'منصة', slug: 'mnsah' }) } }) })
    expect(wrapper.findAllComponents(SeoPanel).length).toBe(2)
  })

  it('no longer renders the old duplicated Projects SEO controls or picker path', async () => {
    const wrapper = await mount('p1')
    expect(field(wrapper, 'en.metaTitle').exists()).toBe(false)
    expect(field(wrapper, 'en.canonicalUrl').exists()).toBe(false)

    // The ONLY media-picker path for SEO is through the shared panel now; the translation
    // component itself imports no picker at all.
    const source = readFileSync(resolve(process.cwd(), 'app/components/dashboard/ProjectTranslationFields.vue'), 'utf8')
    expect(source).not.toMatch(/DashboardMediaPicker|LazyDashboardMediaPicker/)
  })

  it('routes text SEO edits into the payload the builder produces', async () => {
    const wrapper = await mount('p1', { project: enTranslationWith({}) })
    await seoInput(wrapper, 'en', 'metaTitle').setValue('Next EN title')
    await seoInput(wrapper, 'en', 'metaDescription').setValue('Next EN description')
    await seoInput(wrapper, 'en', 'canonicalUrl').setValue('https://next.example.com/en')
    await save(wrapper)

    const entry = (lastWrite()?.body.translations as Array<Record<string, unknown>>)
      .find(item => item.locale === 'en')
    expect(entry).toMatchObject({
      metaTitle: 'Next EN title',
      metaDescription: 'Next EN description',
      canonicalUrl: 'https://next.example.com/en'
    })
  })

  it('sends explicit NULL for a cleared text field and a cleared OG image (D10-23)', async () => {
    const wrapper = await mount('p1', { project: enTranslationWith({}) })
    await seoInput(wrapper, 'en', 'metaTitle').setValue('')
    const picker = wrapper.find('[data-locale-section="en"] [data-seo-picker]').findComponent(MediaPicker)
    picker.vm.$emit('update:modelValue', null)
    await flushPromises()
    await save(wrapper)

    const entry = (lastWrite()?.body.translations as Array<Record<string, unknown>>)
      .find(item => item.locale === 'en')
    expect(entry).toHaveProperty('metaTitle', null)
    expect(entry).toHaveProperty('ogImageId', null)
  })

  it('sends a REPLACED OG image id through the shared picker', async () => {
    const wrapper = await mount('p1', { project: enTranslationWith({}) })
    const picker = wrapper.find('[data-locale-section="en"] [data-seo-picker]').findComponent(MediaPicker)
    expect(picker.exists()).toBe(true)
    picker.vm.$emit('update:modelValue', 'asset-next-en')
    await flushPromises()
    await save(wrapper)

    const entry = (lastWrite()?.body.translations as Array<Record<string, unknown>>)
      .find(item => item.locale === 'en')
    expect(entry).toHaveProperty('ogImageId', 'asset-next-en')
  })

  it('omits UNTOUCHED SEO values from the PATCH — preservation needs no wire presence', async () => {
    const wrapper = await mount('p1', { project: enTranslationWith({}) })
    await field(wrapper, 'en.summary').setValue('Only the summary moved')
    await save(wrapper)

    const entry = (lastWrite()?.body.translations as Array<Record<string, unknown>>)
      .find(item => item.locale === 'en')
    expect(entry).not.toHaveProperty('metaTitle')
    expect(entry).not.toHaveProperty('metaDescription')
    expect(entry).not.toHaveProperty('canonicalUrl')
    expect(entry).not.toHaveProperty('ogImageId')
  })

  it('keeps EN and AR SEO isolated — editing either leaves the other stored value alone', async () => {
    const wrapper = await mount('p1', {
      project: project({
        translations: {
          en: translation({ metaTitle: 'Held EN title' }),
          ar: translation({ title: 'منصة المحتوى', slug: 'mnsah', metaTitle: 'عنوان محفوظ' })
        }
      })
    })
    await seoInput(wrapper, 'ar', 'metaTitle').setValue('عنوان جديد')
    await save(wrapper)
    let body = lastWrite()?.body.translations as Array<{ locale: string, metaTitle?: string }>
    expect(body.find(item => item.locale === 'ar')?.metaTitle).toBe('عنوان جديد')

    // Mirror direction: an ENGLISH edit must not disturb the held Arabic title.
    const wrapper2 = await mount('p1', {
      project: project({
        translations: {
          en: translation({ metaTitle: 'Held EN title' }),
          ar: translation({ title: 'منصة المحتوى', slug: 'mnsah', metaTitle: 'عنوان محفوظ' })
        }
      })
    })
    await seoInput(wrapper2, 'en', 'metaTitle').setValue('New English title')
    await save(wrapper2)
    body = lastWrite()?.body.translations as Array<{ locale: string, metaTitle?: string }>
    expect(body.find(item => item.locale === 'en')?.metaTitle).toBe('New English title')
    expect(body.find(item => item.locale === 'ar')?.metaTitle).toBeUndefined()
  })

  it('keeps canonicalUrl LTR inside the RTL Arabic section', async () => {
    const wrapper = await mount('p1', {
      project: project({ translations: { en: translation(), ar: translation({ title: 'منصة', slug: 'mnsah' }) } })
    })
    expect(seoInput(wrapper, 'ar', 'canonicalUrl').attributes('dir')).toBe('ltr')
    expect(seoInput(wrapper, 'en', 'canonicalUrl').attributes('dir')).toBe('ltr')
  })

  it('an SEO edit updates the persistent actions to unsaved — the form registers as changed', async () => {
    const wrapper = await mount('p1', { project: enTranslationWith({}) })
    expect(wrapper.find('[data-editor-actions]').exists()).toBe(true)
    expect(wrapper.find('[data-editor-save-state="idle"]').exists()).toBe(true)
    await seoInput(wrapper, 'en', 'metaTitle').setValue('Dirtying the form')
    await flushPromises()
    expect(wrapper.find('[data-editor-save-state="unsaved"]').exists()).toBe(true)
  })

  it('uses the shared translation tabs without carrying Articles presentation', async () => {
    const wrapper = await mount('p1')
    expect(wrapper.find('[data-editor-meta-title], [data-editor-slug]').exists()).toBe(false)
    expect(wrapper.find('[data-editor-tabs]').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('dashboard.articles.')
  })
})

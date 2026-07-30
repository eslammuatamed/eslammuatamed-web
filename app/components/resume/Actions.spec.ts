// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { MediaPdf } from '~/types/models'
import Actions from './Actions.vue'

/**
 * The two résumé actions. The rules under test are the ones a screenshot cannot show:
 * the media URL is used EXACTLY as served, the PDF-null state is honest and leaks no
 * `resumeAssetId`, and print survives both states.
 */
// `t` echoes the key, EXCEPT the two unit strings: those are passed into `formatFileSize` as
// data, so echoing them would make the size assertions test the mock rather than the formatting.
const UNIT_MESSAGES: Record<string, string> = {
  'resume.pdf.unitKb': 'kB',
  'resume.pdf.unitMb': 'MB'
}

mockNuxtImport('useI18n', () => () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    UNIT_MESSAGES[key] ?? (params ? `${key}:${Object.values(params).join('|')}` : key),
  locale: ref('en')
}))

const pdf = (overrides: Partial<MediaPdf> = {}): MediaPdf => ({
  id: '11111111-2222-3333-4444-555555555555',
  kind: 'PDF',
  url: 'https://media.eslammuatamed.com/media/8f0a/eslam-muatamed-resume.pdf',
  filename: 'eslam-muatamed-resume.pdf',
  sizeBytes: 97805,
  ...overrides
})

const UNAVAILABLE = '[data-testid="resume-pdf-unavailable"]'

describe('ResumeActions — PDF available', () => {
  it('links to the absolute media URL exactly as the contract serves it', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    const anchor = wrapper.find('a')
    expect(anchor.attributes('href')).toBe(
      'https://media.eslammuatamed.com/media/8f0a/eslam-muatamed-resume.pdf'
    )
  })

  // No API-origin rewrite and no client-side reconstruction of a storage key: the href must be
  // byte-identical to the descriptor, not assembled from parts.
  it('performs no rewrite or key reconstruction on the URL', async () => {
    const custom = pdf({ url: 'https://cdn.example.test/some/other/layout/file.pdf' })
    const wrapper = await mountSuspended(Actions, { props: { resume: custom } })
    expect(wrapper.find('a').attributes('href')).toBe(custom.url)
  })

  it('is a real anchor with an href so the download works without JavaScript', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    const anchor = wrapper.find('a')
    expect(anchor.exists()).toBe(true)
    expect(anchor.attributes('href')).toBeTruthy()
  })

  it('names the file and its size in the accessible label', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    const label = wrapper.find('a').attributes('aria-label')
    expect(label).toContain('eslam-muatamed-resume.pdf')
    expect(label).toContain('98 kB')
  })

  it('shows a human-readable size beside the visible label', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    expect(wrapper.text()).toContain('98 kB')
  })

  // A malformed size must not print "NaN kB" or suppress the download itself.
  it('still offers the download when the size is unusable, printing no size', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf({ sizeBytes: Number.NaN }) } })
    expect(wrapper.find('a').attributes('href')).toBeTruthy()
    expect(wrapper.text()).not.toContain('NaN')
  })

  it('renders no unavailable notice when a PDF exists', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    expect(wrapper.find(UNAVAILABLE).exists()).toBe(false)
  })

  it('never renders the asset id', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    expect(wrapper.html()).not.toContain('11111111-2222-3333-4444-555555555555')
  })
})

describe('ResumeActions — PDF unavailable', () => {
  it('renders an honest notice instead of a download link', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: null } })
    expect(wrapper.find(UNAVAILABLE).exists()).toBe(true)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  // The specific failure this guards: an anchor with an empty or "#" href that looks like a
  // download and goes nowhere.
  it('creates no broken anchor', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: null } })
    for (const anchor of wrapper.findAll('a')) {
      const href = anchor.attributes('href')
      expect(href).toBeTruthy()
      expect(href).not.toBe('#')
    }
  })

  // Asserted on RENDERED TEXT, not raw HTML: source comments in this component legitimately
  // discuss `resumeAssetId` and `/contact` to explain why neither is emitted, and Vue keeps
  // comments in a dev build. What must be free of technical vocabulary is what a visitor reads.
  it('exposes no technical vocabulary to the visitor', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: null } })
    const visible = wrapper.text().toLowerCase()
    expect(visible).not.toContain('resumeassetid')
    expect(visible).not.toContain('null')
    expect(visible).not.toContain('undefined')
  })

  // Contact is a later slice and its route does not exist — linking to it would 404.
  it('renders no link at all in the unavailable state', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: null } })
    expect(wrapper.findAll('a')).toHaveLength(0)
  })

  it('keeps the print action available', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: null } })
    expect(wrapper.text()).toContain('resume.print')
    expect(wrapper.find('button').exists()).toBe(true)
  })
})

describe('ResumeActions — print behaviour', () => {
  it('hides the whole control row from the printed document', async () => {
    const wrapper = await mountSuspended(Actions, { props: { resume: pdf() } })
    expect(wrapper.find('div').classes()).toContain('print:hidden')
  })

  it('invokes the browser print dialog from a button, not a link', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const wrapper = await mountSuspended(Actions, { props: { resume: null } })

    await wrapper.find('button').trigger('click')

    expect(print).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})

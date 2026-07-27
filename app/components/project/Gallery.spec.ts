// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ProjectGalleryItem } from '~/types/models'
import ProjectGallery from './Gallery.vue'

// FR-PUB-032. Real owner images are deferred, so this is verified entirely against contract-shaped
// descriptors — which is exactly what the gallery will receive once media is uploaded through the
// Dashboard → Media Library → API → R2 pipeline.
function item(overrides: Partial<ProjectGalleryItem['mediaAsset']> = {}, rest: Partial<ProjectGalleryItem> = {}): ProjectGalleryItem {
  return {
    mediaAssetId: rest.mediaAssetId ?? 'asset-1',
    order: rest.order ?? 0,
    caption: rest.caption ?? null,
    mediaAsset: {
      id: 'media-1',
      kind: 'IMAGE',
      url: 'https://media.example.com/1920.webp',
      width: 2400,
      height: 1350,
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      alt: 'A dashboard overview',
      variants: [
        { format: 'WEBP', width: 640, height: 360, url: 'https://media.example.com/640.webp' },
        { format: 'WEBP', width: 1280, height: 720, url: 'https://media.example.com/1280.webp' }
      ],
      ...overrides
    }
  } as ProjectGalleryItem
}

const mount = (items: ProjectGalleryItem[]) =>
  mountSuspended(ProjectGallery, { props: { items, heading: 'Gallery' } })

describe('ProjectGallery', () => {
  it('renders one figure per item as a labelled section', async () => {
    const wrapper = await mount([item(), item({}, { mediaAssetId: 'asset-2', order: 1 })])

    expect(wrapper.find('section').attributes('aria-labelledby')).toBe('project-gallery-heading')
    expect(wrapper.findAll('figure')).toHaveLength(2)
  })

  it('preserves the API order rather than re-sorting', async () => {
    const wrapper = await mount([
      item({ url: 'https://media.example.com/first.webp' }, { mediaAssetId: 'a', order: 0 }),
      item({ url: 'https://media.example.com/second.webp' }, { mediaAssetId: 'b', order: 1 })
    ])

    const sources = wrapper.findAll('img').map(img => img.attributes('src'))
    expect(sources[0]).toContain('first')
    expect(sources[1]).toContain('second')
  })

  it('sets explicit dimensions so the box is reserved and CLS stays at zero', async () => {
    const wrapper = await mount([item()])
    const img = wrapper.find('img')

    expect(img.attributes('width')).toBe('2400')
    expect(img.attributes('height')).toBe('1350')
  })

  it('builds the srcset from the contract variants, widest url as src', async () => {
    const wrapper = await mount([item()])
    const img = wrapper.find('img')

    expect(img.attributes('srcset')).toBe(
      'https://media.example.com/640.webp 640w, https://media.example.com/1280.webp 1280w'
    )
    expect(img.attributes('src')).toBe('https://media.example.com/1920.webp')
  })

  it('omits the srcset entirely when no variants exist', async () => {
    const wrapper = await mount([item({ variants: [] })])
    expect(wrapper.find('img').attributes('srcset')).toBeUndefined()
  })

  it('lazy-loads gallery images — none competes with the page LCP element', async () => {
    const wrapper = await mount([item()])
    expect(wrapper.find('img').attributes('loading')).toBe('lazy')
  })

  it('paints the blurhash average colour behind the image while it loads', async () => {
    const wrapper = await mount([item()])
    expect(wrapper.find('img').attributes('style')).toMatch(/background-color: rgb\(/)
  })

  it('degrades to no background when the blurhash is malformed', async () => {
    const wrapper = await mount([item({ blurhash: '!!' })])
    expect(wrapper.find('img').attributes('style') ?? '').not.toMatch(/background-color/)
  })

  it('renders meaningful alt text when a translation exists', async () => {
    const wrapper = await mount([item({ alt: 'A dashboard overview' })])
    const img = wrapper.find('img')

    expect(img.attributes('alt')).toBe('A dashboard overview')
    expect(img.attributes('aria-hidden')).toBeUndefined()
  })

  it('treats an intentionally decorative image as decorative, and keeps it in the figure', async () => {
    const wrapper = await mount([item({ alt: '' })])
    const img = wrapper.find('img')

    // alt="" is the owner's explicit choice — the image stays part of the figure's meaning.
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('aria-hidden')).toBeUndefined()
  })

  it('hides an image whose alt has no translation, rather than inventing one', async () => {
    const wrapper = await mount([item({ alt: null }, {})])
    const img = wrapper.find('img')

    // null means "no translation for this locale" — a different state from a deliberate alt="".
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('aria-hidden')).toBe('true')
  })

  it('renders a caption when one exists and none when it does not', async () => {
    const withCaption = await mount([item({}, { caption: 'Dashboard overview' })])
    expect(withCaption.find('figcaption').text()).toBe('Dashboard overview')

    const without = await mount([item({}, { caption: null })])
    expect(without.find('figcaption').exists()).toBe(false)
  })
})

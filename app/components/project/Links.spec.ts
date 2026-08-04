// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectLinks from './Links.vue'

// FR-PUB-033 says links appear "where they exist" with "absence handled gracefully". All four
// combinations are real: several seeded projects are client work with no public URL at all, so
// "neither" is the common case rather than an edge case.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const LIVE = 'https://example.com/product'
const REPO = 'https://github.com/eslammuatamed/example'

describe('ProjectLinks', () => {
  it('renders both links when both exist', async () => {
    const wrapper = await mountSuspended(ProjectLinks, { props: { liveUrl: LIVE, repoUrl: REPO } })

    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain(LIVE)
    expect(hrefs).toContain(REPO)
  })

  it('renders only the live link when the repository is private', async () => {
    const wrapper = await mountSuspended(ProjectLinks, { props: { liveUrl: LIVE, repoUrl: null } })

    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toEqual([LIVE])
    expect(wrapper.text()).not.toContain('projects.links.repo')
  })

  it('renders only the repository link when the product is not public', async () => {
    const wrapper = await mountSuspended(ProjectLinks, { props: { liveUrl: null, repoUrl: REPO } })

    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toEqual([REPO])
    expect(wrapper.text()).not.toContain('projects.links.live')
  })

  it('renders nothing at all when neither link exists', async () => {
    const wrapper = await mountSuspended(ProjectLinks, { props: { liveUrl: null, repoUrl: null } })

    // Not a disabled button and not "not available" copy — an absent link is not a broken one.
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text().trim()).toBe('')
  })

  it('neutralizes a non-http(s) URL instead of emitting a live href (WD-5 scheme allowlist)', async () => {
    // Defence in depth: liveUrl/repoUrl are CMS-authored. Taking AppLink's external branch explicitly
    // is what activates the allowlist, so a javascript: target renders inert.
    const wrapper = await mountSuspended(ProjectLinks, {
      props: { liveUrl: 'javascript:alert(1)', repoUrl: null }
    })

    expect(wrapper.find('a').attributes('href')).toBe('#')
  })

  it('opens external targets in a new tab with a safe rel', async () => {
    // External-link hardening (target/rel/scheme allowlist) is AppLink's responsibility and is covered
    // where it lives; what THIS component owns is delegating to it instead of hand-rolling an <a>.
    // The end-to-end result is asserted against real SSR output in the e2e suite.
    const wrapper = await mountSuspended(ProjectLinks, { props: { liveUrl: LIVE, repoUrl: REPO } })

    for (const anchor of wrapper.findAll('a')) {
      expect(anchor.attributes('target')).toBe('_blank')
      expect(anchor.attributes('rel')).toBe('noopener noreferrer')
    }
  })
})

// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppLink from './AppLink.vue'

/**
 * Regression suite for the external-detection defect found by web-005.
 *
 * Root cause: `external?: boolean` is Boolean-cast by Vue to `false` when the prop is absent, so
 * `props.external ?? detect(...)` never reached the detect. Every external URL fell through to the
 * internal NuxtLink branch, which still emits a working href — so the failure was invisible in normal
 * use and only surfaced as a missing target/icon and, more seriously, a bypassed scheme allowlist.
 *
 * The tri-state (`true` / `false` / absent) is therefore the thing under test, not an implementation
 * detail.
 */
const mount = (props: { to: string, external?: boolean }) =>
  mountSuspended(AppLink, { props, slots: { default: () => 'Label' } })

describe('AppLink — external detection', () => {
  it.each(['https://example.com/x', 'http://example.com', 'HTTPS://EXAMPLE.COM/y'])(
    'auto-detects %s as external when the prop is absent',
    async (url) => {
      const wrapper = await mount({ to: url })
      const anchor = wrapper.find('a')

      expect(anchor.attributes('href')).toBe(url)
      expect(anchor.attributes('target')).toBe('_blank')
      expect(anchor.attributes('rel')).toBe('noopener noreferrer')
    }
  )

  it('treats an internal path as internal when the prop is absent', async () => {
    const wrapper = await mount({ to: '/projects' })
    const anchor = wrapper.find('a')

    // Resolved through localePath, and explicitly NOT a new tab.
    expect(anchor.attributes('href')).toBe('/projects')
    expect(anchor.attributes('target')).toBeUndefined()
    expect(anchor.attributes('rel')).toBeUndefined()
  })

  it('honours an explicit external=false override on an http(s) URL', async () => {
    const wrapper = await mount({ to: 'https://example.com/x', external: false })

    // Forced internal: the router owns it, so no new tab and no external rel.
    expect(wrapper.find('a').attributes('target')).toBeUndefined()
  })

  it('honours an explicit external=true override on a non-http target', async () => {
    const wrapper = await mount({ to: 'mailto:someone@example.com', external: true })

    expect(wrapper.find('a').attributes('href')).toBe('mailto:someone@example.com')
  })

  it('does not open mailto: in a new tab', async () => {
    // mailto hands off to the OS handler and never replaces the page; a _blank would strand an
    // empty tab, and the arrow would promise a navigation that never happens.
    const wrapper = await mount({ to: 'mailto:someone@example.com', external: true })
    const anchor = wrapper.find('a')

    expect(anchor.attributes('target')).toBeUndefined()
    expect(anchor.find('[aria-hidden="true"]').exists()).toBe(false)
  })

  it('does not open tel: in a new tab', async () => {
    const wrapper = await mount({ to: 'tel:+201234567890', external: true })

    expect(wrapper.find('a').attributes('target')).toBeUndefined()
  })

  it('normalizes an unsafe javascript: URL to an inert href, even without an explicit flag', async () => {
    // Safe-by-default: if the detect only matched http(s), this would fall through to the INTERNAL
    // branch and be emitted as a live href, bypassing the allowlist completely.
    const auto = await mount({ to: 'javascript:alert(1)' })
    expect(auto.find('a').attributes('href')).toBe('#')

    const forced = await mount({ to: 'javascript:alert(1)', external: true })
    expect(forced.find('a').attributes('href')).toBe('#')
  })

  it('normalizes a protocol-relative //host target to an inert href', async () => {
    const wrapper = await mount({ to: '//evil.example.com/x' })
    expect(wrapper.find('a').attributes('href')).toBe('#')
  })

  it('normalizes an unsafe data: URL to an inert href', async () => {
    const wrapper = await mount({ to: 'data:text/html,<script>alert(1)</script>', external: true })

    expect(wrapper.find('a').attributes('href')).toBe('#')
  })

  it('shows the external indicator only for links that really open a new tab', async () => {
    const external = await mount({ to: 'https://example.com/x' })
    expect(external.find('[aria-hidden="true"]').exists()).toBe(true)

    const internal = await mount({ to: '/projects' })
    expect(internal.find('[aria-hidden="true"]').exists()).toBe(false)
  })

  it('keeps the Header/Footer navigation pattern internal and locale-resolved', async () => {
    // Every existing Header/Footer AppLink passes an internal path (`/`, `/blog`, nav item.to) — the
    // fix must not reroute any of them through the external branch.
    for (const path of ['/', '/blog', '/projects', '/experience']) {
      const wrapper = await mount({ to: path })
      expect(wrapper.find('a').attributes('href')).toBe(path)
      expect(wrapper.find('a').attributes('target')).toBeUndefined()
    }
  })
})

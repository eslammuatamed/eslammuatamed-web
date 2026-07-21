// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Skill } from '~/types/models'
import Capabilities from './Capabilities.vue'

// Capabilities groups skills by a fixed GROUP_ORDER (LANGUAGE, FRAMEWORK, TOOLING, PRACTICE), drops
// empty groups, and orders within a group by `order`. The section is omitted when there is nothing to
// show and not loading/erroring (NFR-DEGRADE); pending/error states render inline.
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: ref('en') }))

const stubs = {
  UiSpread: { template: '<div><slot /></div>' },
  UiStateError: { template: '<div class="state-error"><button @click="$emit(\'retry\')">retry</button></div>' },
  UiSectionSkeleton: { template: '<div class="section-skeleton" />', props: ['count'] }
}

const skill = (overrides: Partial<Skill>): Skill => ({
  id: 'id',
  label: 'Label',
  group: 'LANGUAGE',
  order: 0,
  brandColor: null,
  availableLocales: ['en'],
  ...overrides
})

describe('HomeCapabilities', () => {
  it('groups by GROUP_ORDER, drops empty groups, and orders within a group by order', async () => {
    const skills: Skill[] = [
      skill({ id: 'l2', group: 'LANGUAGE', order: 2, label: 'TypeScript' }),
      skill({ id: 'l1', group: 'LANGUAGE', order: 1, label: 'JavaScript' }),
      skill({ id: 'f1', group: 'FRAMEWORK', order: 1, label: 'Vue' }),
      skill({ id: 'p1', group: 'PRACTICE', order: 1, label: 'TDD' })
      // no TOOLING skills — that group must be dropped entirely
    ]
    const wrapper = await mountSuspended(Capabilities, { props: { skills }, global: { stubs } })

    const headings = wrapper.findAll('h3').map(h => h.text())
    expect(headings).toEqual([
      'home.techStack.group.LANGUAGE',
      'home.techStack.group.FRAMEWORK',
      'home.techStack.group.PRACTICE'
    ])

    const languageItems = wrapper.findAll('section')[0]!.findAll('li').map(li => li.text())
    expect(languageItems).toEqual(['JavaScript', 'TypeScript'])
  })

  it('omits the section when skills is empty and not pending/error', async () => {
    const wrapper = await mountSuspended(Capabilities, {
      props: { skills: [], pending: false, error: false },
      global: { stubs }
    })
    expect(wrapper.find('#capabilities-title').exists()).toBe(false)
  })

  it('renders an inline error and emits retry', async () => {
    const wrapper = await mountSuspended(Capabilities, {
      props: { skills: null, error: true },
      global: { stubs }
    })
    expect(wrapper.find('.state-error').exists()).toBe(true)
    await wrapper.find('.state-error button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders a skeleton while pending', async () => {
    const wrapper = await mountSuspended(Capabilities, {
      props: { skills: null, pending: true },
      global: { stubs }
    })
    expect(wrapper.find('.section-skeleton').exists()).toBe(true)
    expect(wrapper.find('section').exists()).toBe(false)
  })
})

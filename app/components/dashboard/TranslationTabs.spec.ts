// @vitest-environment nuxt
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TranslationTabs from './TranslationTabs.vue'

const UTabs = defineComponent({
  name: 'UTabs',
  props: {
    modelValue: { type: String, required: true },
    items: { type: Array, required: true }
  },
  emits: ['update:modelValue'],
  template: `
    <div :data-active="modelValue" data-tabs>
      <div v-for="item in items" :key="item.value">
        <slot :item="item" />
        <slot name="content" :item="item" />
      </div>
    </div>
  `
})

const UBadge = defineComponent({ template: '<span><slot /></span>' })

const Harness = defineComponent({
  components: { TranslationTabs },
  props: {
    shellDir: { type: String, required: true },
    initialLocale: { type: String, required: true }
  },
  setup(props) {
    const active = ref(props.initialLocale)
    const items = [
      { value: 'en', label: 'English', fill: 'complete' as const, invalid: false },
      { value: 'ar', label: 'Arabic', fill: 'complete' as const, invalid: false }
    ]

    return { active, items }
  },
  template: `
    <div :dir="shellDir" data-dashboard-shell>
      <TranslationTabs v-model="active" :items="items" :fill-labels="{ empty: 'Empty', partial: 'Partial', complete: 'Complete' }" invalid-label="Invalid">
        <template #panel="{ locale, contentDir }">
          <p data-technical-ui>Technical label</p>
          <input :data-authored-field="locale" :dir="contentDir">
        </template>
      </TranslationTabs>
    </div>
  `
})

function mountHarness(shellDir: 'ltr' | 'rtl', initialLocale: 'en' | 'ar') {
  return mount(Harness, {
    props: { shellDir, initialLocale },
    global: { stubs: { UTabs, UBadge } }
  })
}

describe('DashboardTranslationTabs direction ownership', () => {
  it('keeps English chrome LTR while the Arabic authored field is RTL', () => {
    const wrapper = mountHarness('ltr', 'ar')

    expect(wrapper.get('[data-dashboard-shell]').attributes('dir')).toBe('ltr')
    expect(wrapper.get('[data-editor-panel="ar"]').attributes('dir')).toBeUndefined()
    expect(wrapper.get('[data-authored-field="ar"]').attributes('dir')).toBe('rtl')
    expect(wrapper.get('[data-editor-panel="ar"] [data-technical-ui]').attributes('dir')).toBeUndefined()
  })

  it('keeps Arabic chrome RTL while the English authored field is LTR', () => {
    const wrapper = mountHarness('rtl', 'en')

    expect(wrapper.get('[data-dashboard-shell]').attributes('dir')).toBe('rtl')
    expect(wrapper.get('[data-editor-panel="en"]').attributes('dir')).toBeUndefined()
    expect(wrapper.get('[data-authored-field="en"]').attributes('dir')).toBe('ltr')
    expect(wrapper.get('[data-editor-panel="en"] [data-technical-ui]').attributes('dir')).toBeUndefined()
  })

  it('changes selected content without changing the shell or panel direction', async () => {
    const wrapper = mountHarness('ltr', 'ar')

    expect(wrapper.get('[data-tabs]').attributes('data-active')).toBe('ar')
    await wrapper.findComponent(UTabs).vm.$emit('update:modelValue', 'en')
    await nextTick()

    expect(wrapper.get('[data-tabs]').attributes('data-active')).toBe('en')
    expect(wrapper.get('[data-dashboard-shell]').attributes('dir')).toBe('ltr')
    expect(wrapper.get('[data-editor-panel="ar"]').attributes('dir')).toBeUndefined()
    expect(wrapper.get('[data-editor-panel="en"]').attributes('dir')).toBeUndefined()
    expect(wrapper.get('[data-authored-field="ar"]').attributes('dir')).toBe('rtl')
    expect(wrapper.get('[data-authored-field="en"]').attributes('dir')).toBe('ltr')
  })
})

<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

// Dashboard sign-in (FR-DSH-001). The dashboard is the client-only world (/dashboard/** is
// ssr:false — D06-1); this page uses the bare `auth` layout (centered card, no dashboard chrome)
// and deliberately carries NO `auth` middleware so a logged-out visitor can reach it. On success
// the access token lives in memory only (D11-1) and we forward to the originally requested route.
// No locale-prefixed twin of this route (D04-7) — the dashboard is bilingual through a persisted
// application locale, not through the URL. Rationale in `~/utils/dashboard-locale`.
defineI18nRoute(false)

definePageMeta({ layout: 'auth' })

const { t } = useDashboardI18n()
const auth = useAuthStore()
const route = useRoute()

/**
 * Zod schema per current ui.nuxt.com form docs (Standard Schema), REBUILT WHEN THE LANGUAGE CHANGES.
 *
 * It used to be built once in setup, and the comment justifying that said: "a locale switch is a
 * route change that remounts this page". That was true, and OD-11 made it false — the dashboard
 * language switch is state, not navigation (D04-7), precisely so it cannot discard form state. The
 * schema closes over `t`, so a `const` schema would keep serving validation messages in whichever
 * language the page happened to load in, while every other string on screen changed around them.
 *
 * A `computed` is enough: `t` reads the dashboard locale ref, so the schema is invalidated by the
 * switch and `UForm` re-validates against the new one. Field VALUES are untouched — rebuilding the
 * schema does not remount the inputs.
 */
function loginSchema(translate: typeof t) {
  return z.object({
    email: z.email(translate('auth.errorEmail')),
    password: z.string().min(12, translate('auth.errorPassword'))
  })
}
type Schema = z.output<ReturnType<typeof loginSchema>>
const schema = computed(() => loginSchema(t))

const state = reactive<Partial<Schema>>({ email: undefined, password: undefined })
const form = useTemplateRef('form')
const alert = useTemplateRef<HTMLElement>('alert')
const formError = ref<string | null>(null)
const pending = ref(false)

/**
 * Password visibility, built as `UInput`'s `#trailing` slot rather than an absolutely-positioned
 * control of our own. This is the shape `@nuxt/ui@4.10`'s own `UAuthForm` uses for a `password`
 * field, copied deliberately: the slot is inside `UInput`'s markup, so the theme positions it with
 * the LOGICAL `end-*` utilities and the control lands on the correct side in Arabic for free.
 * Hand-positioning it is how a physical `right:` enters dashboard chrome, which is a defect class
 * here (`check-logical-properties`).
 *
 * `UAuthForm` itself is not adopted, and the reason is specific rather than aesthetic: this page
 * needs `form.setErrors()` for 422 field errors and a focus-managed `role="alert"` for everything
 * else (D21 §5), and it needs the schema rebuilt when the dashboard language changes. Those are
 * reachable on `UForm` and not on `UAuthForm`'s surface. Composition polish is FE-5's.
 *
 * `type` flips rather than a second input being revealed, so the field keeps its value, its
 * `v-model` binding and its validation state across a toggle.
 */
/**
 * `UCard` supplies the page's surface, border, radius and dark-mode states, for the same reason
 * `messages.vue` uses it: Nuxt UI-first, so this page inherits the design system rather than
 * restating it. No colour or spacing decision is taken here — visual finalize is FE-5's.
 */
const icons = useAppConfig().ui.icons
const passwordInput = useTemplateRef<{ inputRef?: HTMLInputElement | null }>('passwordInput')
const passwordVisible = ref(false)

useSeoMeta({ title: () => t('auth.title'), robots: 'noindex' })

async function onSubmit(event: FormSubmitEvent<Schema>): Promise<void> {
  formError.value = null
  pending.value = true
  try {
    await auth.login(event.data)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await navigateTo(redirect)
  } catch (error) {
    const apiError = toApiError(error)
    // Field-level problems (422) attach to their inputs via UForm's `name` binding (doc 11 §4).
    // Anything else is a form-level message that is announced (role=alert) and takes focus, so a
    // keyboard / screen-reader user is told why sign-in failed (doc 21 §5).
    if (apiError.status === 422 && apiError.fieldErrors.length > 0) {
      const errors: FormError[] = apiError.fieldErrors.map(item => ({ name: item.field, message: item.message }))
      form.value?.setErrors(errors)
    } else {
      formError.value = apiError.status === 401 ? t('auth.errorInvalid') : t('auth.errorGeneric')
      await nextTick()
      alert.value?.focus()
    }
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-h1 text-highlighted">{{ t('auth.title') }}</h1>
      <p class="mt-2 text-muted">{{ t('auth.subtitle') }}</p>
    </template>

    <div v-if="formError" ref="alert" tabindex="-1" role="alert" class="mb-6 outline-none">
      <UAlert color="error" variant="subtle" icon="i-lucide-circle-alert" :title="formError" />
    </div>

    <UForm ref="form" :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
      <UFormField name="email" :label="t('auth.email')" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          autofocus
          class="w-full"
        />
      </UFormField>

      <UFormField name="password" :label="t('auth.password')" required>
        <UInput
          ref="passwordInput"
          v-model="state.password"
          :type="passwordVisible ? 'text' : 'password'"
          autocomplete="current-password"
          class="w-full"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="passwordVisible ? icons.eyeOff : icons.eye"
              :aria-label="passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')"
              :aria-pressed="passwordVisible"
              :aria-controls="passwordInput?.inputRef?.id"
              @click="passwordVisible = !passwordVisible"
            />
          </template>
        </UInput>
      </UFormField>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="pending"
        :disabled="pending"
        :label="pending ? t('auth.submitting') : t('auth.submit')"
      />
    </UForm>
  </UCard>
</template>

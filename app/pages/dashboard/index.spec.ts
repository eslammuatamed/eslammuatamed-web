import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
const root = resolve(process.cwd())
const page = readFileSync(resolve(root, 'app/pages/dashboard/index.vue'), 'utf8')
const en = JSON.parse(readFileSync(resolve(root, 'i18n/locales/en.json'), 'utf8')) as { dashboard: Record<string, unknown> }
const ar = JSON.parse(readFileSync(resolve(root, 'i18n/locales/ar.json'), 'utf8')) as { dashboard: Record<string, unknown> }
describe('Dashboard Overview v1 structural contract', () => {
  it('replaces the retired placeholder with the approved operational sections', () => { expect(page).not.toContain('dashboard.placeholder'); expect(page).toContain('dashboard.overview.contentSnapshot.title'); expect(page).toContain('dashboard.overview.attention.title'); expect(page).toContain('dashboard.overview.quickActions.title') })
  it('uses only approved existing Dashboard destinations', () => { for (const route of ['/dashboard/articles', '/dashboard/projects', '/dashboard/skills', '/dashboard/testimonials', '/dashboard/messages', '/dashboard/articles/new', '/dashboard/projects/new', '/dashboard/media', '/dashboard/seo']) expect(page).toContain(route); expect(page).not.toContain('/ar/dashboard') })
  it('uses metadata only where the API provides it', () => { expect(page).toContain("totalSnapshot('/admin/articles')"); expect(page).toContain("totalSnapshot('/admin/projects')"); expect(page).toContain('query: { page: 1, perPage: 1 }'); expect(page).toContain('useUnreadCount()'); expect(page).not.toContain('/admin/skills'); expect(page).not.toContain('/admin/testimonials') })
  it('renders nested snapshot state as primitive values rather than Ref objects', () => { expect(page).toContain('snapshot.state.pending.value && snapshot.state.total.value === null'); expect(page).toContain("count: snapshot.state.total.value"); expect(page).toContain('snapshot.state.forbidden.value ?'); expect(page).toContain('v-if="snapshot.state.failed.value"'); expect(page).not.toContain('count: snapshot.state.total })'); expect(page).not.toContain('v-if="snapshot.state.failed"') })
  it('adds no analytics or localized route duplicate', () => { expect(page).not.toMatch(/google analytics|gtm|dataLayer/i); expect(page).toContain('defineI18nRoute(false)'); expect(existsSync(resolve(root, 'app/pages/ar/dashboard/index.vue'))).toBe(false) })
  it('provides Overview messages in English and Arabic', () => { expect(en.dashboard.overview).toBeTypeOf('object'); expect(ar.dashboard.overview).toBeTypeOf('object') })
})

import process from 'node:process'
import { expect, type Page } from '@playwright/test'

const CONTROL_BASE = `http://127.0.0.1:${Number(process.env.CI_SKILLS_MOCK_PORT ?? 4201)}`

export const NARROW = { width: 380, height: 780 }
export const SKILL = {
  typescript: '00000000-0000-4000-f100-000000000001',
  vue: '00000000-0000-4000-f100-000000000002',
  nest: '00000000-0000-4000-f100-000000000003',
  delivery: '00000000-0000-4000-f100-000000000004',
  experienceOnly: '00000000-0000-4000-f100-000000000005'
} as const
export const API_ORDER = [SKILL.typescript, SKILL.vue, SKILL.nest, SKILL.delivery, SKILL.experienceOnly] as const

export async function resetBackend(page: Page): Promise<void> {
  const response = await page.request.post(`${CONTROL_BASE}/__e2e/reset`)
  expect(response.ok(), 'Skills backend reset must succeed').toBe(true)
}

export async function setBackendState(
  page: Page,
  state: { mode?: 'ok' | 'empty' | 'error' | 'forbidden', delayMs?: number }
): Promise<void> {
  const response = await page.request.post(`${CONTROL_BASE}/__e2e/state`, { data: state })
  expect(response.ok(), 'Skills backend state change must succeed').toBe(true)
}

export async function signIn(page: Page, locale: 'en' | 'ar', baseURL: string): Promise<void> {
  await page.context().addCookies([{ name: 'dashboard_locale', value: locale, url: baseURL }])
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('e2e-password-1234')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

export const rows = (page: Page) => page.locator('[data-skill-row]')
export const shell = (page: Page) => page.locator('[data-shell="dashboard"]')

/** Positive terminal-state barrier; absence of a spinner before the request starts is not settling. */
export async function listSettled(page: Page): Promise<void> {
  await page.locator(
    '[data-skill-row], [data-skills-empty], [data-skills-failed], [data-skills-forbidden]'
  ).first().waitFor({ timeout: 15_000 })
  await expect(page.locator('[aria-busy=true]')).toHaveCount(0, { timeout: 15_000 })
}

export async function expectNoKeyPaths(page: Page): Promise<void> {
  const text = await page.locator('main').innerText()
  expect(text).not.toMatch(/\b(dashboard|state|common|a11y)\.[a-zA-Z]/)
}

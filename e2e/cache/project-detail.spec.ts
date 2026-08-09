import { expect, test } from '@playwright/test'
import { PROJECTS, SLUG } from '../../scripts/e2e/fixtures'
import { CONTROL_PUBLISH, CONTROL_RESET } from '../../scripts/e2e/project-cache-server'

const API_PORT = Number(process.env.CI_PROJECT_CACHE_MOCK_PORT ?? 3801)
const CONTROL_ORIGIN = `http://127.0.0.1:${API_PORT}`

test('the next fresh EN and AR detail requests reflect an upstream gallery mutation', async ({ request }) => {
  const reset = await request.post(`${CONTROL_ORIGIN}${CONTROL_RESET}`)
  expect(reset.status()).toBe(204)

  const routes = [
    {
      path: `/projects/${SLUG.bilingual.en}`,
      caption: PROJECTS.en[SLUG.bilingual.en]!.gallery[0]!.caption,
      mediaId: PROJECTS.en[SLUG.bilingual.en]!.gallery[0]!.mediaAsset.id
    },
    {
      path: `/ar/projects/${SLUG.bilingual.ar}`,
      caption: PROJECTS.ar[SLUG.bilingual.ar]!.gallery[0]!.caption,
      mediaId: PROJECTS.ar[SLUG.bilingual.ar]!.gallery[0]!.mediaAsset.id
    }
  ]

  // Prime each independent Nitro key while the upstream relation is empty.
  for (const route of routes) {
    const primed = await request.get(route.path)
    expect(primed.ok()).toBeTruthy()
    expect(await primed.text()).not.toContain(route.mediaId)
  }

  const publish = await request.post(`${CONTROL_ORIGIN}${CONTROL_PUBLISH}`)
  expect(publish.status()).toBe(204)

  // These are the first requests after the mutation. A stale-once SWR rule returns the primed HTML
  // here and only revalidates in the background; a correctly uncached detail route renders current
  // upstream state in this same response.
  for (const route of routes) {
    const fresh = await request.get(route.path)
    expect(fresh.ok()).toBeTruthy()
    expect(fresh.headers()['cache-control'] ?? '').not.toContain('stale-while-revalidate')
    const html = await fresh.text()
    expect(html).toContain(route.mediaId)
    expect(html).toContain(route.caption)
  }
})

test('the exact EN and AR project indexes retain SWR', async ({ request }) => {
  for (const path of ['/projects', '/ar/projects']) {
    const response = await request.get(path)
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['cache-control']).toContain('s-maxage=60')
    expect(response.headers()['cache-control']).toContain('stale-while-revalidate')
  }
})

import { execFileSync } from 'node:child_process'
import process from 'node:process'
import type { APIResponse, Page, Route, Request } from '@playwright/test'
import { expect, test as base } from '@playwright/test'

/**
 * Real-API race harness.
 *
 * Two rules make this a proof rather than a simulation:
 *
 *   1. NOTHING IS FABRICATED. Every intercepted request is eventually `continue()`d to the real API,
 *      so the database really moves and the responses are really the server's. The harness controls
 *      only WHEN a request is allowed to execute — which is exactly the variable a timing bug lives
 *      in, and the only one a test can legitimately pin.
 *
 *   2. ASSERTIONS ARE BLACK-BOX. Final URL, rendered rows, slideover state, badge text and the real
 *      database — never component internals or source order.
 */

const DB = process.env.RACE_DB as string

/** Query the REAL disposable database. This is the source of truth every scenario ends on. */
export function sql(query: string): string {
  return execFileSync('psql', ['-U', 'eslammuatamed', '-h', 'localhost', '-d', DB, '-tAc', query], {
    encoding: 'utf8'
  }).trim()
}

export interface Fixture { readonly id: string, readonly subject: string }

/**
 * Reset to a known state. Called per test so `--repeat-each` runs are independent: a repeat that
 * inherited the previous run's rows would drift, and a passing tenth iteration would mean nothing.
 */
export function resetMessages(): { inbox: Fixture[], archived: Fixture[] } {
  sql('DELETE FROM contact_messages')
  const rows = (label: string, count: number, archived: boolean, read: boolean) =>
    sql(
      `INSERT INTO contact_messages (id,name,email,phone,subject,body,is_read,is_archived,archived_at,meta,created_at,updated_at)
       SELECT gen_random_uuid(),'Sender '||g,'s'||g||'@example.com',NULL,'${label} '||g,'Body '||g,
              ${read},${archived},${archived ? 'now()' : 'NULL'},'{}'::jsonb, now() - (g||' minutes')::interval, now()
       FROM generate_series(1,${count}) g RETURNING id||'|'||subject`
    )
  const parse = (out: string): Fixture[] =>
    out.split('\n').filter(Boolean).map((line) => {
      const [id, ...rest] = line.split('|')
      return { id: id as string, subject: rest.join('|') }
    })
  const inbox = parse(rows('Inbox msg', 3, false, false))
  const archived = parse(rows('Archived msg', 2, true, true))
  return { inbox, archived }
}

/** Rows currently rendered, read from the DOM. */
export async function renderedSubjects(page: Page): Promise<string[]> {
  const cells = page.locator('table tbody tr td:nth-child(3) button')
  await expect(cells.first()).toBeVisible({ timeout: 10_000 }).catch(() => undefined)
  return (await cells.allTextContents()).map(t => t.trim())
}

/** The sidebar unread badge, or null when hidden (which is what zero renders as). */
export async function badge(page: Page): Promise<string | null> {
  const el = page.locator('a[href="/dashboard/messages"] span').filter({ hasText: /^\d+\+?$/ })
  return (await el.count()) === 0 ? null : (await el.first().textContent())?.trim() ?? null
}

/** Unread count straight from the database — what the badge must agree with. */
export function dbUnreadCount(): number {
  return Number(sql('SELECT count(*) FROM contact_messages WHERE NOT is_read AND NOT is_archived'))
}

export function dbRow(id: string): { isRead: boolean, isArchived: boolean } | null {
  const out = sql(`SELECT is_read||'|'||is_archived FROM contact_messages WHERE id='${id}'`)
  if (!out) return null
  const [read, archived] = out.split('|')
  // psql -tA prints `true`/`false`, not `t`/`f`.
  return { isRead: read === 'true', isArchived: archived === 'true' }
}

type Held = { route: Route, request: Request, release: () => void }

/**
 * A request that has ALREADY EXECUTED against the real API, whose real response is parked awaiting
 * delivery to the page.
 *
 * This is the difference between controlling DISPATCH order and controlling COMPLETION order.
 * `route.continue()` only decides when a request leaves the browser; the response then arrives
 * whenever the network decides, so "release A then B" does not establish which one COMPLETES first.
 * For an out-of-order test that distinction is the entire point — otherwise the test is itself
 * relying on winning the race it claims to have eliminated.
 *
 * `route.fetch()` performs the genuine request and returns the genuine response; `route.fulfill({
 * response })` hands that same response to the page unmodified. Nothing is fabricated — the payload
 * is the real server's, and the request really hit the real API at the moment it was executed, which
 * is what makes it observe the pre-mutation state.
 */
type HeldResponse = { route: Route, request: Request, response: APIResponse, deliver: () => void }

/**
 * Controls when real admin requests execute.
 *
 * `hold()` parks a matching request; `release()` lets it run against the real API. Anything not held
 * passes straight through, so the app behaves normally except at the exact seam under test.
 */
export class RequestCoordinator {
  readonly log: string[] = []
  private held: Held[] = []
  private heldResponses: HeldResponse[] = []
  private holdMatchers: Array<{ label: string, match: (r: Request) => boolean }> = []
  private responseMatchers: Array<{ label: string, match: (r: Request) => boolean }> = []

  private constructor(private readonly page: Page) {}

  static async attach(page: Page): Promise<RequestCoordinator> {
    const c = new RequestCoordinator(page)
    await page.route('**/api/v1/admin/messages**', async (route, request) => {
      const label = c.describe(request)
      // Response-order control takes precedence: execute the real request NOW, park its real
      // response, and deliver it only when the test says so.
      const responseMatcher = c.responseMatchers.find(m => m.match(request))
      if (responseMatcher) {
        c.responseMatchers = c.responseMatchers.filter(m => m !== responseMatcher)
        const response = await route.fetch()
        c.log.push(`EXECUTED-RESPONSE-PARKED ${label}`)
        await new Promise<void>((resolve) => {
          c.heldResponses.push({ route, request, response, deliver: resolve })
        })
        return
      }

      const matcher = c.holdMatchers.find(m => m.match(request))
      if (!matcher) {
        c.log.push(`pass-through ${label}`)
        await route.continue()
        return
      }
      c.holdMatchers = c.holdMatchers.filter(m => m !== matcher)
      c.log.push(`HELD ${label}`)
      await new Promise<void>((resolve) => {
        c.held.push({ route, request, release: resolve })
      })
    })
    return c
  }

  /** A stable, readable description used for both matching and the reported ordering log. */
  describe(request: Request): string {
    const url = new URL(request.url())
    if (request.method() === 'PATCH') return `PATCH ${url.pathname.split('/').pop()}`
    const archived = url.searchParams.get('isArchived')
    const perPage = url.searchParams.get('perPage')
    const page = url.searchParams.get('page') ?? '1'
    if (perPage === '1') return 'GET badge-count'
    return `GET list isArchived=${archived} page=${page}`
  }

  /**
   * Let the next matching request EXECUTE against the real API immediately, but park its real
   * response until `deliverResponse` is called. Use this when the test must control which response
   * COMPLETES first, not merely which request is sent first.
   */
  holdResponseNext(needle: string): void {
    this.responseMatchers.push({ label: needle, match: r => this.describe(r).includes(needle) })
  }

  /** Wait until a matching request has executed and its response is parked. */
  async waitUntilResponseParked(needle: string): Promise<void> {
    await expect
      .poll(() => this.heldResponses.some(h => this.describe(h.request).includes(needle)), {
        timeout: 15_000,
        message: `no parked response matching "${needle}"; log so far:\n${this.log.join('\n')}`
      })
      .toBe(true)
  }

  /**
   * Deliver a parked REAL response to the page, and wait for the page to consume it. Delivery order
   * across several parked responses is therefore exactly the order these calls are made.
   */
  async deliverResponse(needle: string): Promise<void> {
    await this.waitUntilResponseParked(needle)
    const idx = this.heldResponses.findIndex(h => this.describe(h.request).includes(needle))
    const [entry] = this.heldResponses.splice(idx, 1)
    if (!entry) return
    this.log.push(`DELIVERED ${this.describe(entry.request)}`)
    await entry.route.fulfill({ response: entry.response })
    entry.deliver()
  }

  /** Park the next request whose description contains `needle`. */
  holdNext(needle: string): void {
    this.holdMatchers.push({ label: needle, match: r => this.describe(r).includes(needle) })
  }

  /** Release the oldest held request matching `needle`, and let it reach the real API. */
  async release(needle: string): Promise<void> {
    await expect
      .poll(() => this.held.filter(h => this.describe(h.request).includes(needle)).length, {
        timeout: 10_000,
        message: `expected a held request matching "${needle}"; log so far:\n${this.log.join('\n')}`
      })
      .toBeGreaterThan(0)

    const idx = this.held.findIndex(h => this.describe(h.request).includes(needle))
    const [entry] = this.held.splice(idx, 1)
    if (!entry) return
    this.log.push(`RELEASED ${this.describe(entry.request)}`)
    await entry.route.continue()
    entry.release()
  }

  /** Wait until a request matching `needle` has been parked. */
  async waitUntilHeld(needle: string): Promise<void> {
    await expect
      .poll(() => this.held.some(h => this.describe(h.request).includes(needle)), {
        timeout: 15_000,
        message: `no held request matching "${needle}"; log so far:\n${this.log.join('\n')}`
      })
      .toBe(true)
  }

  /**
   * Discard anything still parked at teardown.
   *
   * ABORT, not continue. A request the test deliberately abandoned must never be allowed to reach
   * the API during teardown: it would land AFTER the next test's database reset and silently mutate
   * that test's fixtures, which is precisely the cross-test bleed that made this suite
   * non-deterministic. Aborting is not fabricating a response — it cancels an in-flight request,
   * exactly as closing the page would.
   */
  async drain(): Promise<void> {
    while (this.heldResponses.length > 0) {
      const [entry] = this.heldResponses.splice(0, 1)
      if (!entry) break
      this.log.push(`ABORTED-AT-TEARDOWN ${this.describe(entry.request)}`)
      await entry.route.abort('failed').catch(() => undefined)
      entry.deliver()
    }
    while (this.held.length > 0) {
      const [entry] = this.held.splice(0, 1)
      if (!entry) break
      this.log.push(`ABORTED-AT-TEARDOWN ${this.describe(entry.request)}`)
      await entry.route.abort('failed').catch(() => undefined)
      entry.release()
    }
  }

  /** Every admin request this page made, in the order the browser issued it. */
  ordering(): string[] {
    return [...this.log]
  }
}

/** Real login against the real API — no injected token. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/dashboard/login')
  await page.locator('input[type=email]').fill('owner@example.com')
  await page.locator('input[type=password]').fill('change-me-minimum-12-chars')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/dashboard')
}

/**
 * Worker-scoped authenticated page.
 *
 * The real API rate-limits login to 5 per 15 minutes and refresh to 30 per hour (doc 19 §6), which
 * is correct production behaviour and is NOT relaxed for testing — the API is exercised exactly as
 * it ships. A fresh context per test would need one login and one refresh each, and the required
 * `--repeat-each=10` over seven scenarios would blow both caps and turn a throttle into a phantom
 * test failure.
 *
 * So authentication happens ONCE per worker and the page is reused. With `workers: 1` that is one
 * login for the entire run, repeats included. Test isolation is preserved where it actually matters:
 * the database is reset per test, route handlers are cleared per test, and every test navigates
 * afresh. What is shared is only the session — which is what a real operator has too.
 */
export const raceTest = base.extend<{ coordinator: RequestCoordinator }, { authedPage: Page }>({
  authedPage: [async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await signIn(page)
    await use(page)
    await context.close()
  }, { scope: 'worker' }],

  // Per-test wiring on the shared page: clear previous interception, reset data, attach a fresh
  // coordinator. Without the unroute, handlers would stack across tests and hold the wrong requests.
  coordinator: async ({ authedPage }, use) => {
    await authedPage.unrouteAll({ behavior: 'ignoreErrors' })
    resetMessages()
    const c = await RequestCoordinator.attach(authedPage)
    await use(c)

    // Discard parked requests, then let anything already released settle. Aborted requests never
    // reach the API, so nothing from this test can mutate the next test's fixtures. Deliberately NO
    // page navigation here: `goto` is a full reload and each one legitimately spends a silent
    // refresh (D11-1), which would exhaust the API's 30/hour refresh tier mid-batch and produce a
    // throttle failure disguised as a test failure.
    await c.drain()
    await authedPage.waitForLoadState('networkidle').catch(() => undefined)
  },

  page: async ({ authedPage }, use) => {
    await use(authedPage)
  }
})

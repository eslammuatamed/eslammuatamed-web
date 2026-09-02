import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { EXP, SKILL, UNKNOWN_SKILL, server } from './experiences-server'

/**
 * The Experiences e2e backend is an INSTRUMENT, and this file is its calibration.
 *
 * Same reason `articles-server.spec.ts` exists: these are not tests of the product, they are the
 * negative controls that make the product's tests meaningful. What is different here is WHAT has to
 * be calibrated, because Experiences is FE-3's second consumer and its value is in where it diverges
 * from Articles (ledger §5.1). Four divergences carry real defect risk, and each one is provable
 * only at this boundary:
 *
 * - `technologyIds` replaces the whole set while `translations` upserts and `endDate` clears on
 *   null — three clearing semantics in one save. The silent failure is a form model that sends
 *   `technologyIds: []` it never meant to send.
 * - The skills 422 carries NO field path, unlike every 422 Articles produces.
 * - `isCurrent` has no server backstop, so the mock must ACCEPT what the Dashboard will refuse.
 * - The list order is not `startDate desc`, and the fixture that proves it reproduces a defect that
 *   actually shipped.
 *
 * If this file is green and the module's tests still fail, the module is wrong. If this file is not
 * green, nothing built on it means anything.
 */

let base = ''
const AUTH = { authorization: 'Bearer e2e-access-token', 'content-type': 'application/json' }

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

beforeEach(async () => {
  await fetch(`${base}/__e2e/reset`, { method: 'POST' })
})

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${base}/api/v1${path}`, { ...init, headers: { ...AUTH, ...(init.headers ?? {}) } })

const setState = (state: Record<string, unknown>) =>
  fetch(`${base}/__e2e/state`, { method: 'POST', body: JSON.stringify(state) })

/** The admin read shape, narrowed to what these calibrations assert on. */
interface Entity {
  id: string
  endDate: string | null
  isCurrent: boolean
  order: number
  technologyIds: string[]
  translations: Record<string, { role: string, company: string, location: string, impact: string }>
}

const list = async () => (await (await api('/admin/experiences')).json()).data as Entity[]
const get = async (id: string) => (await (await api(`/admin/experiences/${id}`)).json()).data as Entity

// ── the three clearing semantics ────────────────────────────────────────────────────────────────

describe('technologyIds — replaces the full set, and the silent way that goes wrong', () => {
  it('PRESERVES the relation when the key is OMITTED — the no-touch save', async () => {
    // THE defect this backend exists to catch. A form model that initialises `technologyIds: []`
    // before the GET resolves, then saves an untouched form, wipes the relation with no 422 and
    // every gate green. The editor's own version of this test loads the page and saves without
    // touching the picker; this one proves the SERVER is not the thing that would forgive it.
    expect((await get(EXP.current)).technologyIds).toHaveLength(3)

    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ order: 7 })
    })

    expect(res.status).toBe(200)
    expect((await res.json()).data.technologyIds).toHaveLength(3)
    expect((await get(EXP.current)).technologyIds).toHaveLength(3)
  })

  it('CLEARS the relation on an explicit empty array', async () => {
    // The mirror of the test above. Both are required: a backend that preserved on `[]` would make
    // the no-touch test pass for the wrong reason, and the operator could never clear the field.
    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ technologyIds: [] })
    })

    expect(res.status).toBe(200)
    expect((await get(EXP.current)).technologyIds).toEqual([])
  })

  it('REPLACES wholesale rather than appending', async () => {
    await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ technologyIds: [SKILL.postgres] })
    })
    // Three in, one sent, one left. An appending backend would answer four and a picker bug that
    // sent only the newly-checked id would look correct.
    expect((await get(EXP.current)).technologyIds).toEqual([SKILL.postgres])
  })
})

describe('translations — upsert, never delete', () => {
  it('keeps a locale the payload OMITS', async () => {
    // Why the editor must send every complete locale and not only the tab being edited: an omitted
    // locale is not a deletion, so a "clear this translation" gesture cannot be expressed by
    // omission and must be blocked in the client (§10.3 rule 6).
    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'en', role: 'Staff Engineer', company: 'Findropica', location: 'Cairo, Egypt', impact: '- Still here.' }]
      })
    })

    expect(res.status).toBe(200)
    const after = await get(EXP.current)
    // Bound and asserted BEFORE they are read: `translations` is an index signature, so every
    // lookup is `T | undefined`. Reading through it directly made `typecheck:e2e` red — the gate
    // M1·U1's exit row never listed, and therefore never ran.
    const en = after.translations.en
    const ar = after.translations.ar
    expect(en).toBeDefined()
    expect(ar).toBeDefined()
    expect(en!.role).toBe('Staff Engineer')
    // The untouched locale SURVIVES the upsert — translations never delete.
    expect(ar!.role).toBe('مهندس واجهات أول')
  })

  it('ADDS a locale that did not exist', async () => {
    const res = await api(`/admin/experiences/${EXP.enOnly}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [{ locale: 'ar', role: 'مطوّر واجهات', company: 'القاهرة الرقمية', location: 'القاهرة، مصر', impact: '- تابعت الموقع التسويقي.' }]
      })
    })

    expect(res.status).toBe(200)
    expect(Object.keys((await get(EXP.enOnly)).translations).sort()).toEqual(['ar', 'en'])
  })
})

describe('endDate — an explicit null clears, an omitted key preserves (D10-23)', () => {
  it('clears on explicit null', async () => {
    expect((await get(EXP.past)).endDate).toBe('2024-12-31')
    await api(`/admin/experiences/${EXP.past}`, { method: 'PATCH', body: JSON.stringify({ endDate: null }) })
    expect((await get(EXP.past)).endDate).toBeNull()
  })

  it('preserves when omitted', async () => {
    // The discriminating pair. A backend that treated `undefined` and `null` alike would let the
    // null-clearing helper be broken in either direction without a test noticing.
    await api(`/admin/experiences/${EXP.past}`, { method: 'PATCH', body: JSON.stringify({ order: 9 }) })
    expect((await get(EXP.past)).endDate).toBe('2024-12-31')
  })
})

// ── the 422 shapes, which are NOT the same shape ────────────────────────────────────────────────

describe('validation — two different failure shapes from one endpoint', () => {
  it('answers translation failures with errors[] and the CLIENT array index in the path', async () => {
    // The index is load-bearing: the read shape is a locale-KEYED map and the write shape is an
    // ARRAY, so mapping an error back to the right locale tab depends on the request's own
    // ordering. Arabic is sent SECOND here on purpose — a hard-coded index 0 would pass otherwise.
    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({
        translations: [
          { locale: 'en', role: 'Senior Frontend Engineer', company: 'Findropica', location: 'Cairo, Egypt', impact: '- Fine.' },
          { locale: 'ar', role: '', company: 'فايندروبيكا', location: 'القاهرة، مصر', impact: '- تمام.' }
        ]
      })
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors).toContainEqual({ field: 'translations[1].role', message: 'role should not be empty.' })
    expect(body.errors.some((e: { field: string }) => e.field.startsWith('translations[0]'))).toBe(false)
  })

  it('answers an UNKNOWN skill id with a 422 that has NO field path at all', async () => {
    // `assertSkillIds` throws a bare `UnprocessableEntityException(message)`, so there is no
    // `errors[]` to read. An editor that renders only `errors[]` shows nothing here and the
    // operator sees a save that silently did not happen.
    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ technologyIds: [UNKNOWN_SKILL] })
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors).toBeUndefined()
    expect(body.detail).toContain('unknown skills')
  })

  it('rejects DUPLICATE skill ids rather than de-duplicating them', async () => {
    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ technologyIds: [SKILL.vue, SKILL.vue] })
    })

    expect(res.status).toBe(422)
    expect((await res.json()).detail).toContain('duplicate')
  })

  it('leaves the record UNCHANGED when a write is rejected', async () => {
    // A backend that half-applied a rejected write would make "the editor preserved your input"
    // impossible to test honestly.
    await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ order: 42, technologyIds: [UNKNOWN_SKILL] })
    })
    expect((await get(EXP.current)).order).toBe(0)
  })
})

describe('isCurrent — the rule with NO server backstop', () => {
  it('ACCEPTS a current role that also carries an end date', async () => {
    // Deliberate. The DTOs carry no cross-field rule, so rejecting this would test the Dashboard's
    // guard against a server rule that does not exist — the most flattering possible green. The
    // client is the ONLY thing standing between the operator and this state, and its test has to
    // face a server that would happily accept it.
    const res = await api(`/admin/experiences/${EXP.current}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCurrent: true, endDate: '2026-01-01' })
    })

    expect(res.status).toBe(200)
    const after = await get(EXP.current)
    expect(after.isCurrent).toBe(true)
    expect(after.endDate).toBe('2026-01-01')
  })
})

// ── ordering, which is the API's and is not startDate ───────────────────────────────────────────

describe('list order — current first, and the defect that proves it', () => {
  it('ranks a CURRENT role above one that started later but has ENDED', async () => {
    // `EXP.endedLater` starts 2026-03; `EXP.current` starts 2025-01 and is current. Under a naive
    // `startDate desc` — the sort that actually shipped and was caught in Production — endedLater
    // comes first. A Dashboard that re-sorts locally fails here instead of live.
    const rows = await list()
    expect(rows[0]).toBeDefined()
    expect(rows[0]!.id).toBe(EXP.current)
    expect(rows.findIndex(r => r.id === EXP.endedLater)).toBeGreaterThan(0)
  })

  it('orders the ended roles by most-recent startDate', async () => {
    const rows = await list()
    const ended = rows.filter(r => !r.isCurrent).map(r => r.id)
    expect(ended).toEqual([EXP.endedLater, EXP.past, EXP.enOnly, EXP.noSkills])
  })

  it('is TOTAL — two rows sharing startDate and order still have a stable relative order', async () => {
    // Without the id tie-break, `Array#sort` stability leaves these at the mercy of insertion order,
    // and a listing could differ between two identical requests.
    await setState({
      experiences: [
        { id: EXP.past, startDate: '2023-01-01', endDate: '2023-12-31', isCurrent: false, employmentType: 'FULL_TIME', order: 1, technologyIds: [], translations: { en: { role: 'B', company: 'B', location: 'B', impact: 'B' } } },
        { id: EXP.enOnly, startDate: '2023-01-01', endDate: '2023-12-31', isCurrent: false, employmentType: 'FULL_TIME', order: 1, technologyIds: [], translations: { en: { role: 'A', company: 'A', location: 'A', impact: 'A' } } }
      ]
    })
    expect((await list()).map(r => r.id)).toEqual([EXP.past, EXP.enOnly])
  })
})

// ── the list envelope, which is NOT the Articles envelope ───────────────────────────────────────

describe('the collection envelope', () => {
  it('answers { data } with NO pagination meta, exactly as the contract declares', async () => {
    // `GET /admin/experiences` takes zero query parameters. A mock that volunteered `meta` would let
    // a collection built on Articles' paginated shape read a field the real API never sends.
    const body = await (await api('/admin/experiences')).json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta).toBeUndefined()
  })

  it('ignores query parameters instead of pretending to honour them', async () => {
    const all = await list()
    const body = await (await api('/admin/experiences?page=2&perPage=1&status=DRAFT')).json()
    expect(body.data).toHaveLength(all.length)
  })
})

// ── the hold, and the modes ─────────────────────────────────────────────────────────────────────

describe('the hold — what makes a loading state observable at all', () => {
  it('answers immediately by default, so no lane pays for latency it did not ask for', async () => {
    const started = Date.now()
    expect((await api('/admin/experiences')).status).toBe(200)
    expect(Date.now() - started).toBeLessThan(150)
  })

  it('holds a READ open for delayMs', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    const res = await api('/admin/experiences')
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  })

  it('holds a WRITE open too — the only condition under which double-submit is a real test', async () => {
    await setState({ delayMs: 300 })
    const started = Date.now()
    const res = await api(`/admin/experiences/${EXP.current}`, { method: 'PATCH', body: JSON.stringify({ order: 3 }) })
    expect(res.status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
  })

  it('holds the SKILLS read too, so the picker has a pending state to render', async () => {
    await setState({ delayMs: 250 })
    const started = Date.now()
    expect((await api('/admin/skills')).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(230)
  })
})

describe('modes — "you may not read this" stays distinguishable from "empty" (D11-2)', () => {
  it('forbidden answers 403, not an empty list', async () => {
    await setState({ mode: 'forbidden' })
    expect((await api('/admin/experiences')).status).toBe(403)
  })

  it('empty answers 200 with zero rows', async () => {
    await setState({ mode: 'empty' })
    const body = await (await api('/admin/experiences')).json()
    expect(body.data).toEqual([])
  })

  it('error is a TRANSPORT failure, not a well-formed error body', async () => {
    // A destroyed socket is what the client's network-error path actually has to survive; a JSON
    // error body would exercise a different branch and leave that path untested.
    await setState({ mode: 'error' })
    await expect(api('/admin/experiences')).rejects.toThrow()
  })

  it('failNextWrite fails exactly ONE write, then recovers', async () => {
    await setState({ failNextWrite: true })
    expect((await api(`/admin/experiences/${EXP.current}`, { method: 'PATCH', body: JSON.stringify({ order: 1 }) })).status).toBe(500)
    expect((await api(`/admin/experiences/${EXP.current}`, { method: 'PATCH', body: JSON.stringify({ order: 1 }) })).status).toBe(200)
  })

  it('requires a bearer token', async () => {
    const res = await fetch(`${base}/api/v1/admin/experiences`)
    expect(res.status).toBe(401)
  })

  it('answers 404 for a well-formed id that is absent', async () => {
    expect((await api(`/admin/experiences/${EXP.absent}`)).status).toBe(404)
  })
})

describe('reset — the guarantee the single-spec-file rule rests on', () => {
  it('restores the fixtures a previous test mutated', async () => {
    await api(`/admin/experiences/${EXP.current}`, { method: 'PATCH', body: JSON.stringify({ technologyIds: [] }) })
    expect((await get(EXP.current)).technologyIds).toEqual([])

    await fetch(`${base}/__e2e/reset`, { method: 'POST' })
    expect((await get(EXP.current)).technologyIds).toHaveLength(3)
  })

  it('restores delayMs and mode as well, so a spec cannot leak latency into the next one', async () => {
    await setState({ delayMs: 400, mode: 'empty' })
    await fetch(`${base}/__e2e/reset`, { method: 'POST' })
    const started = Date.now()
    const body = await (await api('/admin/experiences')).json()
    expect(Date.now() - started).toBeLessThan(150)
    expect(body.data.length).toBeGreaterThan(0)
  })
})

describe('the skills option source', () => {
  it('is paginated and includes a non-public skill, because the picker is an ADMIN surface', async () => {
    const body = await (await api('/admin/skills')).json()
    expect(body.meta).toEqual({ page: 1, perPage: 12, total: 5, totalPages: 1 })
    expect(body.data).toHaveLength(5)
    expect(body.data.some((s: { isPublic: boolean }) => !s.isPublic)).toBe(true)
  })

  it('slices a later page from the requested perPage without a group query', async () => {
    const page1 = await (await api('/admin/skills?page=1&perPage=2')).json()
    const page2 = await (await api('/admin/skills?page=2&perPage=2')).json()

    expect(page1.meta).toEqual({ page: 1, perPage: 2, total: 5, totalPages: 3 })
    expect(page2.meta).toEqual({ page: 2, perPage: 2, total: 5, totalPages: 3 })
    expect(page2.data).toHaveLength(2)
    expect(page2.data[0].id).not.toBe(page1.data[0].id)

    const skills = Array.from({ length: 51 }, (_, index) => ({
      ...page1.data[0], id: `test-skill-${index + 1}`
    }))
    await setState({ skills })

    const laterSkill = await (await api('/admin/skills?page=2&perPage=50')).json()
    expect(laterSkill.meta).toEqual({ page: 2, perPage: 50, total: 51, totalPages: 2 })
    expect(laterSkill.data.map((skill: { id: string }) => skill.id)).toEqual(['test-skill-51'])
  })

  it('carries per-locale labels, so the picker can be bilingual', async () => {
    const body = await (await api('/admin/skills')).json()
    const vue = body.data.find((s: { id: string }) => s.id === SKILL.vue)
    expect(vue.translations.en.label).toBe('Vue')
    expect(vue.translations.ar.label).toBe('فيو')
  })
})

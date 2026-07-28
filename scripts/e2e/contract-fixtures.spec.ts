import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { PROJECTS, REDIRECTS, SLUG, TECHNOLOGY } from './fixtures.ts'
import { API_PREFIX, resolveRequest } from './scenario-server.ts'

/**
 * CONTRACT FIDELITY GATE — the scenario backend may not drift from the committed contract.
 *
 * This is the second of two mechanisms. The first is compile time: every fixture in `fixtures.ts` is
 * typed with the OpenAPI-derived types `npm run api:types` generates into `app/types/api.d.ts`, so a
 * missing or misnamed required field fails `npm run typecheck:e2e`. That catches structure, but it
 * cannot check what the types erase — `format: uuid`, `format: uri`, enum membership, or numeric
 * shapes. So this validates the ACTUAL SERVED RESPONSES against the committed
 * `openapi/openapi.json` with ajv.
 *
 * It validates responses rather than the fixture objects on purpose: the envelope (`{ data }` for
 * reads, `{ data, meta }` for lists, D10-3) is part of what the application consumes, and a fixture
 * that is individually valid inside a wrong envelope would still break the page.
 *
 * `openapi/openapi.json` is READ, never written. Nothing here modifies the contract or its examples.
 */

const document = JSON.parse(readFileSync('openapi/openapi.json', 'utf8')) as {
  components: { schemas: Record<string, unknown> }
}

/**
 * OpenAPI 3.0 is *nearly* JSON Schema, and the gap is `nullable: true` — a 3.0-only spelling of what
 * JSON Schema expresses as a union with `null`. ajv would ignore the keyword and then reject every
 * legitimately null field, so it is translated rather than suppressed. Ignoring it instead would make
 * the gate pass by not checking, which is worse than not having the gate.
 */
function fromOpenApi(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(fromOpenApi)
  if (node === null || typeof node !== 'object') return node

  const source = node as Record<string, unknown>
  const converted: Record<string, unknown> = {}
  let nullable = false

  for (const [key, value] of Object.entries(source)) {
    if (key === 'nullable') {
      nullable = value === true
      continue
    }
    // `properties` (and friends) map NAMES to schemas. Walking them as schemas would misread a
    // property that happens to be called `nullable` or `type` as a keyword.
    converted[key] = key === 'properties' || key === 'patternProperties'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([name, schema]) => [name, fromOpenApi(schema)])
        )
      : fromOpenApi(value)
  }

  if (!nullable) return converted

  if (typeof converted.type === 'string') {
    return {
      ...converted,
      type: [converted.type, 'null'],
      // An enum that excludes null would reject null again through the back door.
      ...(Array.isArray(converted.enum) ? { enum: [...converted.enum, null] } : {})
    }
  }
  // No plain `type` to widen (e.g. `nullable` beside an `allOf` $ref) — express the union directly.
  return { anyOf: [{ type: 'null' }, converted] }
}

// `strict: false` because the document carries OpenAPI-only annotations (`example`, `discriminator`,
// `xml`) that are not JSON Schema keywords and are not errors.
const ajv = new Ajv({ strict: false, allErrors: true })
addFormats(ajv)
ajv.addSchema({ components: { schemas: fromOpenApi(document.components.schemas) } }, 'contract')

/** Compile a validator for one committed schema, referenced exactly as the contract names it. */
function validator(schemaName: string) {
  return ajv.compile({ $ref: `contract#/components/schemas/${schemaName}` })
}

/** Run one scenario request through the backend and return the body it would serve. */
function serve(path: string): unknown {
  const reply = resolveRequest(`${API_PREFIX}${path}`)
  if (reply.kind === 'destroy') throw new Error(`${path} destroys the connection and has no body`)
  return reply.body
}

function check(schemaName: string, value: unknown, label: string): void {
  const validate = validator(schemaName)
  const valid = validate(value)
  // Print ajv's own messages: a bare `toBe(true)` says a fixture drifted but not how.
  expect(
    valid ? [] : (validate.errors ?? []).map(error => `${error.instancePath || '/'} ${error.message}`),
    `${label} must satisfy ${schemaName}`
  ).toEqual([])
  expect(valid, label).toBe(true)
}

/** Every successful response the backend can serve, with the committed schema it must satisfy. */
const SUCCESS_RESPONSES: { label: string, path: string, schema: string, list?: boolean }[] = [
  { label: 'site settings (en)', path: '/settings/site?locale=en', schema: 'PublicSiteSettingsEntity' },
  { label: 'site settings (ar)', path: '/settings/site?locale=ar', schema: 'PublicSiteSettingsEntity' },
  { label: 'skills (en)', path: '/skills?locale=en', schema: 'PublicSkillEntity', list: true },
  { label: 'skills (ar)', path: '/skills?locale=ar', schema: 'PublicSkillEntity', list: true },
  { label: 'redirect resolve (en)', path: `/redirects/resolve?locale=en&path=/projects/${SLUG.renamed.en}`, schema: 'RedirectResolveEntity' },
  { label: 'redirect resolve (ar)', path: `/redirects/resolve?locale=ar&path=/projects/${SLUG.renamed.ar}`, schema: 'RedirectResolveEntity' },
  { label: 'canonical project (en)', path: `/projects/${SLUG.canonical.en}?locale=en`, schema: 'PublicProjectDetailEntity' },
  { label: 'canonical project (ar)', path: `/projects/${SLUG.canonical.ar}?locale=ar`, schema: 'PublicProjectDetailEntity' },
  { label: 'empty-gallery project (en)', path: `/projects/${SLUG.emptyGallery.en}?locale=en`, schema: 'PublicProjectDetailEntity' },
  { label: 'empty-gallery project (ar)', path: `/projects/${SLUG.emptyGallery.ar}?locale=ar`, schema: 'PublicProjectDetailEntity' },
  { label: 'bilingual project (en)', path: `/projects/${SLUG.bilingual.en}?locale=en`, schema: 'PublicProjectDetailEntity' },
  { label: 'bilingual project (ar)', path: `/projects/${SLUG.bilingual.ar}?locale=ar`, schema: 'PublicProjectDetailEntity' }
]

describe('the committed contract is loadable and its schemas compile', () => {
  it('exposes every schema the scenario backend serves', () => {
    for (const { schema } of SUCCESS_RESPONSES) {
      expect(document.components.schemas, schema).toHaveProperty(schema)
    }
    expect(document.components.schemas).toHaveProperty('ProblemDetailsDto')
    expect(document.components.schemas).toHaveProperty('PageMeta')
  })
})

describe('successful scenario responses match the committed contract', () => {
  for (const { label, path, schema, list } of SUCCESS_RESPONSES) {
    it(`${label} satisfies ${schema}`, () => {
      const body = serve(path) as { data: unknown }
      expect(body, `${label} must use the { data } envelope (D10-3)`).toHaveProperty('data')

      if (list) {
        const items = body.data as unknown[]
        expect(Array.isArray(items), label).toBe(true)
        expect(items.length, `${label} must not be empty, or the check would be vacuous`).toBeGreaterThan(0)
        items.forEach((item, index) => check(schema, item, `${label}[${index}]`))
      } else {
        check(schema, body.data, label)
      }
    })
  }

  it('the projects index uses the paginated envelope with a valid PageMeta', () => {
    const body = serve('/projects?locale=en') as { data: unknown[], meta: unknown }

    expect(Array.isArray(body.data)).toBe(true)
    check('PageMeta', body.meta, 'projects index meta')
  })
})

describe('failure scenario responses use the contract’s RFC 7807 shape', () => {
  const FAILURES: { label: string, path: string, status: number }[] = [
    { label: 'unknown slug', path: `/projects/${SLUG.unknown.en}?locale=en`, status: 404 },
    { label: 'redirect miss', path: `/redirects/resolve?locale=en&path=/projects/${SLUG.unknown.en}`, status: 404 },
    { label: 'upstream failure (detail)', path: `/projects/${SLUG.upstreamFailure.en}?locale=en`, status: 503 },
    { label: 'upstream failure (index)', path: `/projects?locale=en&technology=${TECHNOLOGY.upstream503}`, status: 503 },
    { label: 'unsupported locale', path: '/projects?locale=fr', status: 422 }
  ]

  for (const { label, path, status } of FAILURES) {
    it(`${label} is a valid ProblemDetailsDto carrying ${status}`, () => {
      const body = serve(path) as { status: number }
      check('ProblemDetailsDto', body, label)
      // The body's own `status` member must agree with the HTTP status, or `toApiError` — which
      // prefers the body — would report a different failure than the one that happened.
      expect(body.status, label).toBe(status)
    })
  }
})

describe('fixture drift guards', () => {
  it('every authored project is reachable through the route the tests use', () => {
    // A project added to the fixtures but not served by any scenario URL is dead weight; a slug
    // renamed in one place and not the other would otherwise fail far away, in Playwright.
    for (const [locale, projects] of Object.entries(PROJECTS)) {
      for (const [slug, project] of Object.entries(projects)) {
        expect(project.slug, `${locale}/${slug}`).toBe(slug)
        expect(serve(`/projects/${slug}?locale=${locale}`)).toHaveProperty('data.slug', slug)
      }
    }
  })

  it('every redirect destination is a project that actually exists', () => {
    // The redirect scenario asserts "no loop"; that only holds if the destination is terminal.
    for (const [locale, table] of Object.entries(REDIRECTS)) {
      for (const [fromPath, toPath] of Object.entries(table)) {
        expect(serve(`${toPath}?locale=${locale}`), `${fromPath} → ${toPath}`).toHaveProperty('data')
      }
    }
  })

  it('the bilingual pair genuinely differs in every field the EN/AR scenario asserts', () => {
    const english = PROJECTS.en[SLUG.bilingual.en]!
    const arabic = PROJECTS.ar[SLUG.bilingual.ar]!

    for (const field of [
      'slug', 'title', 'summary',
      'overview', 'businessProblem', 'solution', 'role',
      'architecture', 'challenges', 'features', 'lessonsLearned'
    ] as const) {
      expect(arabic[field], `${field} is identical across locales`).not.toBe(english[field])
    }

    expect(arabic.gallery[0]?.caption).not.toBe(english.gallery[0]?.caption)
    expect(arabic.gallery[0]?.mediaAsset.alt).not.toBe(english.gallery[0]?.mediaAsset.alt)
    // The slug map is what drives hreflang and the language switcher (D22-3).
    expect(english.slugs).toEqual({ en: SLUG.bilingual.en, ar: SLUG.bilingual.ar })
    expect(arabic.slugs).toEqual(english.slugs)
  })

  it('the empty-gallery fixture is empty in exactly one respect', () => {
    const project = PROJECTS.en[SLUG.emptyGallery.en]!

    expect(project.gallery).toEqual([])
    // Every other FR-CNT-020 field must be populated, or "the rest of FR-CNT-020 remains visible"
    // would be asserted against a page that is empty for an unrelated reason.
    for (const field of [
      'overview', 'businessProblem', 'solution', 'role',
      'architecture', 'challenges', 'features', 'lessonsLearned'
    ] as const) {
      expect(project[field].length, field).toBeGreaterThan(0)
    }
  })
})

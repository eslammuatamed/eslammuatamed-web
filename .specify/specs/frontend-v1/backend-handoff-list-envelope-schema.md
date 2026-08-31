# Backend handoff — four admin LIST endpoints declare a single entity instead of an array

**Raised by:** Campaign 027 (Frontend v1), FE-3 taxonomy investigation lane INV-2, 2026-08-19.
**Owner ruling:** this is a **contract-representation bug**, not a product decision. The corrected
shape is already established by runtime semantics, so no one needs to choose it.
**Status:** Frontend has made **no change** and will make none. Fix belongs in the API source.

---

## 1. Affected endpoints — four, confirmed against the emitted artifact

| Endpoint | Source site | Declared `data` | Handler actually returns |
| --- | --- | --- | --- |
| `GET /api/v1/admin/categories` | `src/modules/taxonomy/categories.admin.controller.ts:48` | `$ref: AdminCategoryEntity` ❌ | `Promise<AdminCategoryEntity[]>` |
| `GET /api/v1/admin/tags` | `src/modules/taxonomy/tags.admin.controller.ts:46` | `$ref: AdminTagEntity` ❌ | `Promise<AdminTagEntity[]>` |
| `GET /api/v1/admin/users` | `src/modules/access-control/users.admin.controller.ts:41` | `$ref: UserEntity` ❌ | `Promise<UserEntity[]>` |
| `GET /api/v1/admin/roles` | `src/modules/access-control/roles.admin.controller.ts:59` | `$ref: RoleEntity` ❌ | `Promise<RoleEntity[]>` |

⚠ **Two of these are outside Taxonomy.** `users` and `roles` were found by sweeping for the same
defect class rather than by looking at the reported symptom, and they will hit the RBAC module the
same way. Fixing only the two taxonomy endpoints leaves the trap armed.

## 2. The exact incorrect shape

```jsonc
// GET /api/v1/admin/categories → responses.200.content['application/json'].schema
{ "type": "object",
  "properties": { "data": { "$ref": "#/components/schemas/AdminCategoryEntity" } },  // ← singular
  "required": ["data"] }
```

Each operation's own `summary` contradicts it — *"**List** categories with full translation maps."*,
*"**List** tags with full translation maps."*, *"**List** operator accounts…"*, and the roles
equivalent. A generated client therefore types `data` as one entity for an endpoint documented, named,
and implemented as a list.

## 3. The expected shape — established, not chosen

```jsonc
{ "type": "object",
  "properties": { "data": { "type": "array",
                            "items": { "$ref": "#/components/schemas/AdminCategoryEntity" } } },
  "required": ["data"] }
```

Three independent lines of evidence, all pointing the same way:

1. **The handler's own TypeScript return type is `Promise<AdminCategoryEntity[]>`** — the runtime
   already returns an array. Nothing about the response body changes when this is fixed.
2. **Nine sibling endpoints in the same contract already declare the array form correctly** —
   `/admin/skills`, `/admin/testimonials`, `/admin/experiences`, their public counterparts,
   `/admin/messages/…/replies`, `/admin/seo`, `/admin/media/…/usage`.
3. **The PUBLIC `/api/v1/categories` and `/api/v1/tags` are declared correctly** — so the *same
   entity family* is declared both ways within one document. That is decisive evidence of an
   oversight rather than an intended difference.

## 4. Root cause — one missing option, four times

```ts
// Defective — categories/tags/users/roles admin list
@ApiOkEnvelope(AdminCategoryEntity)

// Correct — skills, testimonials, and the PUBLIC categories/tags
@ApiOkEnvelope(AdminSkillEntity, { isArray: true })
```

`@ApiOkEnvelope` (`src/common/swagger/api-envelope.ts:22`) defaults to the singular envelope. The
handler's return type and the decorator are **two independent declarations of the same fact**, and
only the decorator reaches OpenAPI — so the two can disagree with `tsc` and every build passing. That
is the defect class, and it is why the requested regression test targets exactly that disagreement.

## 5. Requested fix

1. Add `{ isArray: true }` to the four `@ApiOkEnvelope` call sites in §1. **No service, DTO, entity or
   response-body change is required or wanted** — the runtime is already correct.
2. **Regenerate the OpenAPI artifact** so the committed/served document reflects it. The fix is not
   complete while `openapi.json` still declares the singular form; the artifact is what clients
   generate from, and the artifact — not the source — is what proved this defect.

## 6. Requested regression test, and how to prove it works

A test that pins the artifact, because the artifact is the deliverable:

> For every `GET` operation whose handler returns an array, the `200` schema's `data` MUST declare
> `type: 'array'` with an `items` `$ref`.

Practical form: assert it over the **generated document** for an explicit list of collection
endpoints, so a new list endpoint is added to the list deliberately rather than passing by omission.

⚠ **It must be positive-controlled before it is trusted.** Remove `{ isArray: true }` from
`/admin/skills` (an endpoint that is currently correct), regenerate, and confirm the test **FAILS**
naming that endpoint; then restore and confirm it passes. A test asserting a property that four
endpoints currently violate will pass trivially once they are fixed — that is not evidence it can
catch the next one.

A source-level assertion (decorator agrees with the handler's return type) is the alternative and
catches it one step earlier, but it is the more brittle of the two; the artifact-level test is the one
that matches how the defect was actually found.

## 7. What Frontend is doing meanwhile — and what it will not do

**Will not:** add a frontend workaround; hand-patch generated OpenAPI types; introduce another
handwritten cast or generic to normalise the bad schema; modify the API repo from this campaign; or
infer a permanent taxonomy architecture from the incorrect schema.

⚠ **An existing handwritten array generic in Web (`app/composables/useAdminArticles.ts:215`) has been
masking this** and is *not* authority for the contract. It is left exactly as it is — removing it now
would break a working consumer, and treating it as evidence is what let the defect survive this long.

**The taxonomy implementation lane is BLOCKED** — narrowly, at the point where the list response shape
becomes load-bearing. FE-3 is **not** blocked globally: Skills (`M2·U2`/`M2·U3`), the Testimonials
review, and other sound-contract modules continue in parallel.

## 8. After the fix

Reconcile the Web vendored `openapi/openapi.json` through the established generation workflow — Web
currently holds a copy byte-identical to API `origin/main` (`sha256 2679bf3580…`, verified
2026-08-19), and that identity is the campaign's contract guarantee, so the reconciliation must
preserve it. Then unblock taxonomy and re-run INV-2's architecture question against the corrected
contract, because its recommended departure (inline create/edit, no detail route) rests on the list
carrying every editor field — a claim the broken schema currently makes unverifiable.

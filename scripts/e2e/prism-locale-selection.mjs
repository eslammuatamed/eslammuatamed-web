/**
 * Which named contract example a request should be answered with — the pure decision, separated
 * from the proxy that applies it so it can be tested without binding a port.
 *
 * THE HEADER IS CONTRACT-DERIVED, AND THAT IS LOAD-BEARING RATHER THAN HYGIENE. Measured against
 * Prism 5.x: a `Prefer: example=<name>` naming an example the operation does not declare returns
 *
 *     404 … "Response for contentType: application/json and exampleKey: ar does not exist."
 *
 * So a blanket "every `?locale=ar` request gets `Prefer: example=ar`" would break `/experiences`,
 * `/skills`, `/projects` and every other operation the moment it was introduced. These functions
 * read the committed contract and select a name ONLY where that operation's 200 response actually
 * declares one. Parameterized operations may declare `<locale>-<path-value>` examples; those are
 * preferred over the locale-only fallback so one response cannot masquerade as another resource.
 */

/**
 * `{ 'GET /api/v1/settings/site' → Set{'en','ar'} }` — the named examples each operation's 200
 * `application/json` response declares. Anything absent is never sent a `Prefer` header.
 */
export function readExampleIndex(contract) {
  const index = new Map()
  for (const [path, operations] of Object.entries(contract.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations ?? {})) {
      const names = Object.keys(
        operation?.responses?.['200']?.content?.['application/json']?.examples ?? {}
      )
      if (names.length > 0) index.set(`${method.toUpperCase()} ${path}`, new Set(names))
    }
  }
  return index
}

/**
 * Matches a concrete request path against a templated contract path (`/articles/{slug}`). Segment
 * count must agree and every non-template segment must match exactly, so `/articles/x` resolves to
 * `/articles/{slug}` while `/articles/x/y` does not.
 */
export function matchContractPath(index, method, pathname) {
  const exact = `${method} ${pathname}`
  if (index.has(exact)) return exact

  const segments = pathname.split('/')
  for (const key of index.keys()) {
    const separator = key.indexOf(' ')
    if (key.slice(0, separator) !== method) continue
    const keySegments = key.slice(separator + 1).split('/')
    if (keySegments.length !== segments.length) continue
    const matches = keySegments.every(
      (segment, i) => (segment.startsWith('{') && segment.endsWith('}')) || segment === segments[i]
    )
    if (matches) return key
  }
  return null
}

/**
 * The example name for a request, or `null` to forward it untouched.
 *
 * Derived from the request's OWN `?locale=`, so the selector follows the locale the application
 * actually asked for rather than holding a second copy of the routing rules. When a matching
 * operation declares a `<locale>-<path-value>` example, the path value is included too. An absent
 * `?locale=` means the contract's documented default (`en`) — the same default the API itself applies.
 */
export function selectExample(index, method, pathname, searchParams) {
  const key = matchContractPath(index, method, pathname)
  if (!key) return null
  const locale = searchParams.get('locale') ?? 'en'
  const names = index.get(key)

  for (const value of pathParameterValues(key, pathname)) {
    const specific = `${locale}-${value}`
    if (names.has(specific)) return specific
  }

  return names.has(locale) ? locale : null
}

/** Return concrete values for `{parameter}` segments in a matched contract path. */
function pathParameterValues(contractKey, pathname) {
  const separator = contractKey.indexOf(' ')
  const template = contractKey.slice(separator + 1).split('/')
  const concrete = pathname.split('/')
  if (template.length !== concrete.length) return []

  return template.flatMap((segment, index) =>
    segment.startsWith('{') && segment.endsWith('}') ? [concrete[index]] : []
  )
}

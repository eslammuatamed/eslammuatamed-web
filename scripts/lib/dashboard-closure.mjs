/**
 * Client-build closure for AUTHENTICATED DASHBOARD routes — doc 20 §1.2 (D20-23).
 *
 * WHY A SECOND METHOD EXISTS. The public gate resolves a route's asset set from its rendered HTML,
 * which is correct only because public routes are server-rendered. `/dashboard/**` is `ssr: false`
 * (doc 06 D06-1 — the dashboard is a client-only SPA), so the server returns a bare shell: read that
 * way, EVERY dashboard route reports the same ~204.5 KB gz shared entry and nothing route-specific.
 * That is not a measurement of the route, so §1.2 replaces the method — not the threshold — for
 * these routes. A chunk is never excluded for loading after client boot; on a client-only route
 * that is still first view.
 *
 * THE ALGORITHM IS "SEED, THEN STATIC CLOSURE", AND THE ORDER IS LOAD-BEARING.
 *
 * The seed is the small set of chunks a cold direct load of THIS route must execute: the shared
 * client entry, the dashboard layout entry, the route's page dynamic entry, and the auth/session
 * middleware and stores required before the page is usable. The closure then follows STATIC
 * `imports` transitively from the seed.
 *
 * `dynamicImports` are followed ONLY into seed members (which is how the layout, page and auth
 * chunks are identified in the first place) and are NEVER expanded transitively. This is the whole
 * correctness argument: the client entry's `dynamicImports` array is the router's code-split map and
 * lists EVERY page chunk in the application. Expanding it transitively would pull `/blog`,
 * `/projects`, every article route and the entire public surface into the closure of every dashboard
 * route — inflating the measurement past any sane ceiling and failing the gate for a reason that has
 * nothing to do with the route being measured. A gate that fails for the wrong reason is as useless
 * as one that passes for the wrong reason.
 *
 * Each asset is counted ONCE per route (a Set, not a sum): shared chunks are real downloads a cold
 * load performs, and double-counting a chunk two seeds both import would invent bytes.
 */

/**
 * A module id belongs to the route's seed when it matches one of these shapes. Ordered and
 * explicit — nothing joins the seed by falling through, mirroring `classifyModuleId`'s doctrine
 * that unrecognised input must be reported rather than absorbed.
 */
const SEED_MODULE_PATTERNS = {
  layout: [/app\/layouts\/dashboard\.vue/],
  // Auth/session code required before the page is usable. The middleware decides whether the route
  // renders at all and the store holds the token it decides on, so neither is optional weight.
  auth: [/app\/middleware\/auth\.ts/, /app\/stores\/auth\.ts/]
}

/** Strip Rollup's query suffix (`?vue&type=script…`) so a module matches its source path. */
function bareId(id) {
  return String(id).replace(/\?.*$/, '')
}

/** Chunks are keyed by index in the sidecar; index them by emitted fileName instead. */
export function indexChunksByFile(chunks) {
  const byFile = new Map()
  for (const key of Object.keys(chunks)) {
    const chunk = chunks[key]
    if (chunk?.fileName) byFile.set(chunk.fileName, chunk)
  }
  return byFile
}

/** Every chunk whose module list matches any of `patterns`. */
function chunksMatching(byFile, patterns) {
  const hits = []
  for (const chunk of byFile.values()) {
    const modules = chunk.modules ?? []
    if (modules.some(m => patterns.some(p => p.test(bareId(m.id))))) hits.push(chunk)
  }
  return hits
}

/**
 * The chunk that owns a dashboard route's page component.
 *
 * Matched on the page module id rather than a filename convention, so the gate cannot be fooled by
 * a hash or a chunk name — provenance comes from Rollup, never from filenames (the same rule the
 * public gate follows).
 *
 * @param {Map<string, object>} byFile
 * @param {string} pageModule e.g. `app/pages/dashboard/messages.vue`
 */
export function findPageChunk(byFile, pageModule) {
  const exact = new RegExp(`${pageModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  // A page's own dynamic entry carries real bytes for that module. The shared entry also *mentions*
  // every page module with a near-zero stub (the route map), so an entry chunk is never the page
  // chunk — require a dynamic entry and non-trivial rendered bytes for the module itself.
  const candidates = []
  for (const chunk of byFile.values()) {
    for (const m of chunk.modules ?? []) {
      if (exact.test(bareId(m.id)) && chunk.isDynamicEntry && (m.renderedLength ?? 0) > 0) {
        candidates.push(chunk)
        break
      }
    }
  }
  return candidates[0] ?? null
}

/**
 * Resolve the deduplicated asset closure for one dashboard route.
 *
 * @param {Record<string, object>} chunks   Rollup sidecar `chunks`
 * @param {string} pageModule               the route's page module id
 * @returns {{ files: string[], seed: Record<string, string|null>, missing: string[] }}
 */
export function resolveDashboardClosure(chunks, pageModule) {
  const byFile = indexChunksByFile(chunks)

  const entry = [...byFile.values()].find(c => c.isEntry) ?? null
  const layout = chunksMatching(byFile, SEED_MODULE_PATTERNS.layout)[0] ?? null
  const page = findPageChunk(byFile, pageModule)
  const authChunks = chunksMatching(byFile, SEED_MODULE_PATTERNS.auth)

  const seed = [entry, layout, page, ...authChunks].filter(Boolean)

  // Report what could not be resolved instead of quietly measuring a smaller route. The caller
  // turns a missing entry or page into an infrastructure failure (exit 2), never a passing number.
  const missing = []
  if (!entry) missing.push('client entry')
  if (!page) missing.push(`page chunk for ${pageModule}`)

  // Transitive STATIC closure from the seed. `dynamicImports` are deliberately not traversed —
  // see the header: the entry's dynamic map is the whole application.
  const files = new Set()
  const stack = seed.map(c => c.fileName)
  while (stack.length > 0) {
    const file = stack.pop()
    if (files.has(file)) continue
    files.add(file)
    const chunk = byFile.get(file)
    for (const imported of chunk?.imports ?? []) {
      if (!files.has(imported)) stack.push(imported)
    }
  }

  return {
    files: [...files].sort(),
    seed: {
      entry: entry?.fileName ?? null,
      layout: layout?.fileName ?? null,
      page: page?.fileName ?? null,
      auth: authChunks.map(c => c.fileName).sort()
    },
    missing
  }
}

/** The dashboard routes measured under D20-23, and the page module each resolves to. */
export const DASHBOARD_ROUTES = [
  { route: '/dashboard/login', pageModule: 'app/pages/dashboard/login.vue' },
  { route: '/dashboard', pageModule: 'app/pages/dashboard/index.vue' },
  { route: '/dashboard/messages', pageModule: 'app/pages/dashboard/messages.vue' }
]

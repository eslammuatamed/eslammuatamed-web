import { expect, type Page } from '@playwright/test'

/**
 * CSP violation collection for the security suite (FE4-U2e1, Step 8).
 *
 * TEST INFRASTRUCTURE ONLY. There is deliberately no production reporting destination in this unit —
 * a Report-Only rollout without a consumer is theatre (recorded in the U2e1 ledger). What a focused
 * browser run CAN do honestly is listen to `securitypolicyviolation` on every frame and assert that
 * the count of unexpected violations is zero while real journeys execute.
 *
 * The listener installs via `addInitScript` so it exists before ANY script runs on the document,
 * including the nonced Nuxt bootstrap. Violations are recorded as `directive|blockedURI` strings so
 * assertion output reads as evidence, not as opaque objects.
 */
export async function collectCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations?: string[] }
    w.__cspViolations = []
    document.addEventListener('securitypolicyviolation', e => {
      w.__cspViolations!.push(`${e.violatedDirective}|${e.blockedURI}`)
    })
  })
}

/** Reads the violations collected by {@link collectCspViolations} for the current document. */
export async function readCspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [])
}

/**
 * Known-benign violation signatures this application carries, each identified to source (Step 7
 * discipline): nothing here weakens the policy — they document where third-party code probes at
 * boundaries the policy deliberately holds.
 *
 * 1. `script-src-attr|inline`
 *    `@nuxt/image` hardcodes `onerror="this.setAttribute('data-error', 1)"` into every SSR'd
 *    `<NuxtImg>` (NuxtImg.vue:62 — no module option disables it). Our policy blocks inline handlers,
 *    so when a media-origin image FAILS to load, Chrome reports one violation. Nothing legitimate is
 *    lost: no component consumes the resulting `@error` emit (grep-verified), the attribute is a
 *    debug marker, and blocking is the policy working as intended. Removing `script-src-attr 'none'`
 *    would not silence it either — under `'strict-dynamic'`, inline handlers stay blocked through
 *    script-src fallback semantics while the explicit directive keeps intent auditable.
 *
 * 2. `script-src|eval`
 *    Nuxt UI ships valibot, whose module init runs a JIT capability probe:
 *    `if (jitless) … try { return Function(''), !0 } catch { return !1 }`. `'unsafe-eval'` stays
 *    banned (non-negotiable), so the probe throws, valibot CATCHES it and runs its supported jitless
 *    mode — the fallback path is the design. Observed only on `/dashboard/login` (UForm schema
 *    validation); behaviour and rendering verified intact.
 */
export const KNOWN_BENIGN_CSP_VIOLATIONS = ['script-src-attr|inline', 'script-src|eval'] as const

/** Asserts zero violations beyond the documented known-benign set, and returns what was seen. */
export async function expectNoUnexpectedCspViolations(page: Page): Promise<string[]> {
  const seen = await readCspViolations(page)
  const unexpected = seen.filter(v => !(KNOWN_BENIGN_CSP_VIOLATIONS as readonly string[]).includes(v))
  expect(unexpected).toEqual([])
  return seen
}

/**
 * Console twin of {@link KNOWN_BENIGN_CSP_VIOLATIONS}: blocked handlers and the valibot JIT probe
 * each surface as a console error in addition to the violation event. Same events, same disposition,
 * same narrow matches.
 */
export function isKnownBenignCspConsoleError(text: string): boolean {
  return (
    (text.includes('violates the following Content Security Policy directive')
      && text.includes("'script-src-attr 'none''"))
    || text.includes('Refused to evaluate')
  )
}

/** Asserts zero console errors beyond the documented known-benign CSP signature. */
export function expectNoUnexpectedConsoleErrors(errors: string[]): void {
  expect(errors.filter(e => !isKnownBenignCspConsoleError(e))).toEqual([])
}

/**
 * Pulls one directive's source list out of a raw Content-Security-Policy header value.
 * Directive names in the header are kebab-case; matching is case-insensitive on the name only.
 */
export function parseDirective(cspHeader: string, directive: string): string[] | null {
  for (const part of cspHeader.split(';')) {
    const tokens = part.trim().split(/\s+/)
    if (tokens[0]?.toLowerCase() === directive.toLowerCase()) return tokens.slice(1)
  }
  return null
}

/** Extracts the nonce value this response's policy admits (`nonce-…`). */
export function parseNonce(cspHeader: string): string | null {
  return cspHeader.match(/'nonce-([^']+)'/)?.[1] ?? null
}

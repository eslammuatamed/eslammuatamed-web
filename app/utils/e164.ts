/**
 * A deliberately shallow shape check: `+`, a non-zero leading digit, plausible total length.
 *
 * Must stay permissive — a client that rejected more than the API would turn a valid number into an
 * error the visitor cannot resolve, and D13-6 is explicit that the API is authoritative.
 *
 * WHY IT LIVES ALONE, away from the rest of `contact.ts` (018, measured):
 *
 * It is now shared by the contact form AND by the Footer, and the Footer is on every public route.
 * Importing it from `contact.ts` pulled that whole module — the dial-code tables, the country plans,
 * the form validator — onto every page: `/` went to 106410 B app-owned rendered against the FROZEN
 * 103424 B limit (doc 20 §1 / D20-12), over by 2986 B. Splitting the predicate into this leaf module
 * put the route back under budget without re-baselining anything and without a second validator:
 * `contact.ts` imports this same function, so there is still exactly ONE E.164 predicate in the app.
 */
export function isPlausibleE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value)
}

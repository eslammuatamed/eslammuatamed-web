import { isPlausibleE164 } from './e164'

/**
 * The ONE derivation of the owner's `wa.me` URL, shared by `/contact`, the Footer and the project CTA.
 *
 * It exists because the URL was built inline on the Contact page and was about to be built inline in
 * two more places. Three copies of "strip the plus, encode the message" is three chances for one
 * surface to link a number another surface hides — so the gate lives here and every caller reads the
 * same answer.
 *
 * The gate is `isPlausibleE164` — the SAME predicate the contact form validates visitor numbers with,
 * deliberately not a second phone check. A stricter or looser validator here is precisely how the
 * Footer would offer a link that the Contact page withholds. It is imported from the leaf module
 * `./e164` rather than from `contact.ts` for a measured reason recorded there: the Footer is on every
 * public route, and reaching through `contact.ts` pulled its dial-code tables onto all of them.
 *
 * Arabic-Indic digits are REJECTED, not folded. `toAsciiDigits` exists for what a visitor types on an
 * Arabic keyboard; `whatsappPhone` is not typed here, it is governed data the API stores in canonical
 * E.164. Folding it would make this gate quietly more permissive than `isPlausibleE164` — the exact
 * divergence above — and would emit a link whose digits differ from the number `/contact` prints.
 * A non-ASCII value in that field is bad data, and the honest response is no affordance at all.
 *
 * The message is a PARAMETER. Calling `useI18n()` from a plain module runs outside a setup context,
 * which throws `MUST_BE_CALL_SETUP_TOP` and silently drops the node (the failure already documented
 * on `useAboutSchema.ts`); every caller already holds `t`.
 *
 * @param phone Raw `SiteSettings.whatsappPhone`.
 * @param message Already-localized prefilled text.
 * @returns `https://wa.me/<digits>?text=<encoded>`, or `null` when there is no usable number.
 */
export function buildWhatsappUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null

  // Surrounding whitespace is transport noise, not a different number. Interior formatting is not
  // accepted: that would widen the gate past `isPlausibleE164`.
  const value = phone.trim()
  if (!isPlausibleE164(value)) return null

  // wa.me takes the number WITHOUT the leading plus. Shape kept byte-identical to the live Contact
  // page behaviour this function replaces — a de-duplication, not a redesign.
  const digits = value.replace(/^\+/, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

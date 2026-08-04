# Feature 011 — Public Contact Slice

**Umbrella:** `web-005 Public Pages` (stays OPEN — the dashboard inbox and the integrated
Contact closeout follow this slice).
**Routes:** `/contact`, `/ar/contact`.
**Requirements:** `FR-PUB-050`, `FR-PUB-051`, `FR-PUB-052`, `FR-PUB-053`. Flow `F-P3`.
**Contract source:** API `origin/dev` `b2d141233dd11a141dc3496f5808887d4e63d6cc`
(`openapi.json` `46312659af04…`, types `094f1c1f7f07…`).
**Governed by:** doc 10 v1.9.1 (**D10-15**), doc 19 v1.5.0, doc 20 v1.15.0 (**D20-22**).

## 1. Why this slice exists

`/contact` is the platform's single conversion point and the last mandatory public route
that does not render. Five live components link to it today and all five 404:
`layout/Header.vue:110` (desktop CTA), `layout/Header.vue:162` (mobile drawer),
`layout/Footer.vue:20` (footer nav), `home/Contact.vue:39` (home closing CTA), and
`home/Nameplate.vue:58` (hero secondary CTA). This slice makes them resolve.

It is also the last route outstanding from doc 20 §5's four-page performance matrix
(D20-22 closes that deferral).

## 2. Scope

**In:** the bilingual public Contact page at both routes; real submission to the API from
the browser; the honeypot and time-trap anti-spam client contract; every submission state;
the direct-email fallback; the availability note; SEO and structured data; accessibility,
RTL, performance and test closeout.

**Out (explicitly):** the dashboard inbox (`/dashboard/messages` — Web PR 2, approved but
deferred, copy recorded in §8); any API change beyond the already-merged D10-15 correction;
issue #30; `og:image` (finding F-1); Prisma 7; promotion to `main`; deployment.

**The Contact feature does not close with this slice.** It closes after the dashboard inbox
and the integrated proof.

## 3. Owner decisions this slice implements

| # | Decision |
|---|---|
| 1 | The **sole** direct-email source is `SiteSettings.contactEmail` (canonical `contact@eslammuatamed.com`). Never `professionalEmail`, never the admin login email, never the notification address, never a Web hard-coded value. When `null`, the block is omitted entirely. |
| 2 | Approach B — public Contact now, dashboard inbox later, closeout after both. |
| 3 | `MIN_FILL_MS = 3000` unchanged. Measured from the governed client lifecycle on a **monotonic** clock. A sub-3000 ms submission enters the pending state, waits only the remainder, **re-measures**, and dispatches the **actual** integer elapsed value. Never fabricated, never a timestamp, never silently discarded, never surfaced as a separate anti-spam message. |
| 4 | The request goes **directly from the browser to the API**. It is not proxied through Nitro, because the API throttle is keyed on the visitor IP and a proxy would collapse every visitor into one bucket. |
| 5 | `settings.availabilityStatus` is the only permitted source for an availability note, rendered verbatim only when non-null. No response-time promise is invented. |
| 6 | `zod` + `UForm`/`UFormField` is provisional, conditional on the D20-22 measurement. If a frozen budget fails because of zod, replace **only** zod with a feature-local validator, keep UForm's accessible behaviour, add no dependency, change no threshold. |
| 7 | Issue #30 untouched: no retries, no shared-timeout increases, no weakened axe, no fifth Playwright server pair. |

## 4. The success receipt must stay neutral (owner copy correction)

The API returns an **identical** 2xx receipt whether a message was persisted or silently
dropped by anti-spam (D02-1). The client therefore **cannot** know which happened, and must
not claim the message reached the inbox.

`contact.success.title` is "Message received" / "تم استلام الرسالة" and
`contact.success.body` is "Thanks — your submission has been received." /
"شكرًا لك — تم استلام رسالتك." Any wording asserting delivery, storage or inbox arrival is a
defect, not a copy preference.

## 5. Field mapping

The API field is **`body`**, not `message`. The visible label is Message / الرسالة.

| Payload key | Visible label (EN / AR) | Cap | Notes |
|---|---|---|---|
| `name` | Name / الاسم | 200 | trimmed client-side and server-side |
| `email` | Email / البريد الإلكتروني | 320 | trimmed both sides |
| `subject` | Subject / الموضوع | 300 | trimmed both sides |
| `body` | Message / الرسالة | 5000 | trimmed both sides |
| `website` | honeypot | — | **never trimmed**; DOM name must NOT be `website` |
| `elapsedMs` | time trap | — | integer, actual measured elapsed at dispatch |

The honeypot's **DOM field name is deliberately different from its payload key**; the local
value is mapped onto `website` only when the request is assembled. A bot scraping the form
markup for a field literally named `website` finds none.

Hiding is clip-based with zero layout footprint — `autocomplete="off"`, `tabindex="-1"`,
`aria-hidden="true"`, an associated hidden label. **Never `display:none`**, which some
autofill implementations skip and some bots detect.

## 6. Submission states

pristine · partially complete · invalid · anti-spam wait/pending · network pending ·
success · 422 · 429 with a readable valid `Retry-After` · 429 without one · 500 ·
network failure.

The pending state spans **both** the remaining anti-spam delay and the network request —
one uninterrupted state, no separate waiting message. Double submission is prevented
throughout.

After a confirmed 200: show the neutral receipt, clear visible fields, reset the honeypot,
reset the timing origin, clear stale errors.

## 7. Locale switching

Switching locale clears entered values, clears the honeypot, clears validation and
submission status, resets the timing origin, and transitions route + `lang` + `dir` + SEO
atomically. No contact PII is persisted across localized routes or into browser storage.

This is **explicit**, not inherited: under `prefix_except_default`, `/contact` → `/ar/contact`
is a route change, not a component remount, so the reset must be implemented and asserted.

## 8. Dashboard copy — approved, deferred, NOT implemented here

The 48 `dashboard.messages.*` keys are owner-approved (with the corrections below) but
belong to **Web PR 2**. They are recorded in `plan.md §7` and must **not** enter
`i18n/locales/*.json` in this slice — shipping unused keys would be dead weight and would
blur the PR boundary.

Owner corrections carried forward: `unreadBadgeLabel` = "Unread messages: {count}" /
"الرسائل غير المقروءة: {count}" (avoids incorrect plural grammar); `filter.all` = "Inbox" /
"الوارد" (the default list sends `isArchived=false`, so "All" would misdescribe it);
`emptyFilteredBody` = "Try another filter or return to the inbox." / "جرّب تصفية أخرى أو ارجع
إلى الوارد."; `actions.markRead`/`markUnread` AR = "وضع علامة كمقروءة" / "وضع علامة كغير
مقروءة"; `detail.notFoundBody` = "This message doesn't exist or is no longer available." /
"هذه الرسالة غير موجودة أو لم تعد متاحة." (no manual delete endpoint exists, so the wording
must not imply one).

## 9. Non-goals

No `ContactPage` structured-data type (not governed — doc 22 §4 gives Contact `WebPage` +
`BreadcrumbList`). No second `Person`. No `og:image`. No dashboard reply composer. No
in-page countdown timer. No new API endpoint. No threshold change of any kind.

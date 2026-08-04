# Feature 011 — Plan

## 1. Contract adoption (done)

Commit `chore(contract): adopt the contact intake correction`, atomic per doc 16 §3 step 4.

| Artifact | Before | After |
|---|---|---|
| API `dev` | `188e7718…` | `b2d141233dd11a141dc3496f5808887d4e63d6cc` |
| `openapi/openapi.json` | `f6451878ed8d…` | `46312659af04…` |
| `app/types/api.d.ts` | `3ecd3b6681f6…` | `094f1c1f7f07…` |

Drift is descriptive plus one typed response header (`Retry-After?: number` on the contact
429). `minLength` has no TypeScript representation, so it appears only in the contract.

## 2. Page architecture

`app/pages/contact.vue`, one file, both routes via i18n routing.

1. `UiBreadcrumbs` — Home → Contact (mirrored by `BreadcrumbList`, doc 22 §4)
2. Page identity — `contact.title` + `contact.description`
3. Direct-email fallback — rendered **before** the form so it survives every form state
4. The form
5. Availability note — only when `settings.availabilityStatus` is non-null
6. One controlled status region — `role="status"` / `aria-live="polite"`, labelled by
   `contact.a11y.statusLabel`, the single owner of every submission outcome

## 3. Time trap (owner decision 3)

`MIN_FILL_MS = 3000` mirrored client-side as a named constant citing D02-1.

- Origin stamped on the governed page lifecycle with **`performance.now()`** — monotonic, so
  a clock adjustment mid-fill cannot corrupt the measurement.
- On submit: enter pending, lock further submission, compute `elapsed`.
- If `elapsed < 3000`, wait the remainder in a **re-checking loop**, not a single
  `setTimeout` trusted to fire on time (a throttled background tab defers timers).
- **Re-measure** after the wait and dispatch only once the real elapsed value clears 3000.
- Send `Math.round(actual)` — the true measured duration through dispatch.

Never fabricate, never send a timestamp, never surface a separate "anti-spam" message: the
wait is absorbed by `contact.form.submitting`.

## 4. Request path (owner decision 4)

`useApi()` straight from the browser to the API origin. **Not** proxied through Nitro — the
contact throttle is keyed on the visitor IP, and a server-side proxy would collapse every
visitor into the deploy's single IP, making the 3/hour limit global rather than per-visitor.

## 5. `{retryAfter}` formatting

Read the numeric `Retry-After` header (readable cross-origin as of D10-15). Accept **only**
a positive finite integer; absent, malformed, zero or negative → the static
`contact.error.rateLimitBody`. Never fabricate a duration.

Choose a unit by magnitude (seconds → minutes → hours → days), **round up** so the UI never
advises retrying early, and format with `Intl.RelativeTimeFormat` — no hand-written
EN/AR plural branches.

**`numberingSystem: 'latn'` is mandatory.** D03-4 requires Western Arabic digits in both
locales, and `Intl.RelativeTimeFormat('ar')` defaults to Eastern Arabic digits (٥) — which
would render `/ar/contact` inconsistent with every other number on the site.
`app/utils/format.ts` already pins `latn` for the same reason; this follows it.

## 6. Approved EN/AR copy — `contact.*` (51) + `seo.contact.*` (2)

Revised by the owner's phone/composition directive. `contact.fallback.*` is **retired** — the
standalone "Prefer email?" card is replaced by the left column's compact `contact.methods.*` list.
`contact.form.legend` is retired with it. `All fields are required.` is **removed as now-false**.

| Key | EN | AR |
|---|---|---|
| `contact.title` | Let’s talk about your next product or role | لنتحدث عن مشروعك أو فرصتك القادمة |
| `contact.description` | Share the context and a way to reach you, or contact me directly by email, phone, or WhatsApp. | شارك التفاصيل ووسيلة مناسبة للتواصل معك، أو تواصل معي مباشرة عبر البريد أو الهاتف أو واتساب. |
| `contact.breadcrumbLabel` | Breadcrumb | مسار التنقّل |
| `contact.form.name` | Name | الاسم |
| `contact.form.email` | Email | البريد الإلكتروني |
| `contact.form.subject` | Subject | الموضوع |
| `contact.form.body` | Message | الرسالة |
| `contact.form.requiredHint` | Name, subject, and message are required. Add either an email address or phone number. | الاسم والموضوع والرسالة مطلوبة. أضف البريد الإلكتروني أو رقم الهاتف. |
| `contact.form.submit` | Send message | إرسال الرسالة |
| `contact.form.submitting` | Sending… | جارٍ الإرسال… |
| `contact.form.websiteLabel` | Website | الموقع الإلكتروني |
| `contact.form.phone` | Phone number | رقم الهاتف |
| `contact.form.contactMethodHint` | Add an email address or phone number so I can reach you. | أضف بريدًا إلكترونيًا أو رقم هاتف حتى أتمكن من التواصل معك. |
| `contact.form.countryCode` | Country or dialing code | الدولة أو مفتاح الاتصال |
| `contact.form.otherCountry` | Other country | دولة أخرى |
| `contact.errors.nameRequired` | Enter your name. | أدخل اسمك. |
| `contact.errors.nameTooLong` | Name must be 200 characters or fewer. | يجب ألّا يزيد الاسم عن 200 حرف. |
| `contact.errors.emailRequired` | Enter your email address. | أدخل بريدك الإلكتروني. |
| `contact.errors.emailInvalid` | Enter a valid email address. | أدخل بريدًا إلكترونيًا صحيحًا. |
| `contact.errors.emailTooLong` | Email must be 320 characters or fewer. | يجب ألّا يزيد البريد الإلكتروني عن 320 حرفًا. |
| `contact.errors.subjectRequired` | Enter a subject. | أدخل موضوع الرسالة. |
| `contact.errors.subjectTooLong` | Subject must be 300 characters or fewer. | يجب ألّا يزيد الموضوع عن 300 حرف. |
| `contact.errors.bodyRequired` | Enter your message. | أدخل نص الرسالة. |
| `contact.errors.bodyTooLong` | Message must be 5000 characters or fewer. | يجب ألّا تزيد الرسالة عن 5000 حرف. |
| `contact.errors.contactMethodRequired` | Enter an email address or phone number. | أدخل بريدًا إلكترونيًا أو رقم هاتف. |
| `contact.errors.phoneInvalid` | Enter a valid international phone number. | أدخل رقم هاتف دوليًا صحيحًا. |
| `contact.success.title` | Message received | تم استلام الرسالة |
| `contact.success.body` | Thanks — your submission has been received. | شكرًا لك — تم استلام رسالتك. |
| `contact.error.validationTitle` | Check the form | راجع النموذج |
| `contact.error.validationBody` | Some fields need attention before this can be sent. | بعض الحقول تحتاج إلى تصحيح قبل الإرسال. |
| `contact.error.rateLimitTitle` | Too many messages | عدد كبير من الرسائل |
| `contact.error.rateLimitBody` | You've sent several messages recently. Please try again later, or email me directly. | لقد أرسلت عدة رسائل مؤخرًا. يُرجى المحاولة لاحقًا، أو مراسلتي مباشرة عبر البريد. |
| `contact.error.rateLimitBodyWithRetryAfter` | You've sent several messages recently. Try again {retryAfter}, or email me directly. | لقد أرسلت عدة رسائل مؤخرًا. حاول مرة أخرى {retryAfter}، أو راسلني مباشرة عبر البريد. |
| `contact.error.serverTitle` | The message didn't go through | تعذّر إرسال الرسالة |
| `contact.error.serverBody` | Something went wrong on my side, not yours. Try again, or email me directly. | حدث خطأ من جانبي، لا من جانبك. حاول مرة أخرى، أو راسلني مباشرة عبر البريد. |
| `contact.error.networkTitle` | Couldn't reach the server | تعذّر الوصول إلى الخادم |
| `contact.error.networkBody` | Check your connection and try again, or email me directly. | تحقّق من اتصالك وحاول مرة أخرى، أو راسلني مباشرة عبر البريد. |
| `contact.a11y.formLabel` | Contact form | نموذج التواصل |
| `contact.a11y.statusLabel` | Submission status | حالة الإرسال |
| `contact.methods.heading` | Reach me directly | تواصل معي مباشرة |
| `contact.methods.email` | Email | البريد الإلكتروني |
| `contact.methods.phone` | Phone | الهاتف |
| `contact.methods.whatsapp` | WhatsApp | واتساب |
| `contact.methods.countries.+20` | Egypt | مصر |
| `contact.methods.countries.+966` | Saudi Arabia | السعودية |
| `contact.methods.countries.+971` | United Arab Emirates | الإمارات |
| `contact.methods.countries.+965` | Kuwait | الكويت |
| `contact.methods.countries.+974` | Qatar | قطر |
| `contact.methods.countries.+973` | Bahrain | البحرين |
| `contact.methods.countries.+968` | Oman | عُمان |
| `contact.whatsappMessage` | Hi Eslam, I found you through your portfolio and would like to discuss a project or work opportunity. | مرحبًا إسلام، وصلت إليك من خلال موقعك وأرغب في التحدث معك بخصوص مشروع أو فرصة عمل. |

`seo.contact.title` / `seo.contact.description` are unchanged from the previous revision.

### No i18n key (API-supplied, rendered verbatim)

`settings.availabilityStatus`, `settings.contactEmail`, `settings.contactPhone`,
`settings.whatsappPhone`. Each direct-method row is gated on its OWN field; nothing is inferred
between `contactPhone` and `whatsappPhone`, and neither number is hard-coded.

## 7. Approved dashboard copy — DEFERRED to Web PR 2, not implemented here

Recorded so PR 2 needs no re-approval. **These keys must not enter `i18n/locales/*.json`
in this slice.** ★ marks an owner correction.

**List (24):** `navLabel` Messages/الرسائل · ★`unreadBadgeLabel` "Unread messages: {count}"/"الرسائل غير المقروءة: {count}" · `title` Messages/الرسائل · `description` "Contact submissions, unread first."/"رسائل نموذج التواصل، غير المقروءة أولًا." · `breadcrumbLabel` Breadcrumb/مسار التنقّل · `filter.label` Show/عرض · ★`filter.all` Inbox/الوارد · `filter.unread` Unread/غير المقروءة · `filter.read` Read/المقروءة · `filter.archived` Archived/المؤرشفة · `column.from` From/المُرسِل · `column.subject` Subject/الموضوع · `column.received` Received/تاريخ الوصول · `column.status` Status/الحالة · `status.unread` Unread/غير مقروءة · `status.read` Read/مقروءة · `status.archived` Archived/مؤرشفة · `open` Open/فتح · `previous` Previous/السابق · `next` Next/التالي · `paginationLabel` "Page {page} of {pages}"/"صفحة {page} من {pages}" · `emptyTitle` "No messages yet"/"لا توجد رسائل بعد" · `emptyBody` "Contact submissions will appear here."/"ستظهر هنا الرسائل الواردة من نموذج التواصل." · `emptyFilteredTitle` "No messages match this filter"/"لا توجد رسائل مطابقة لهذه التصفية"

**States (5):** ★`emptyFilteredBody` "Try another filter or return to the inbox."/"جرّب تصفية أخرى أو ارجع إلى الوارد." · `errorTitle` "Messages could not be loaded"/"تعذّر تحميل الرسائل" · `errorBody` "The request did not complete. This is usually temporary."/"لم يكتمل الطلب. غالبًا ما يكون هذا مؤقّتًا." · `forbiddenTitle` "You don't have access to messages"/"لا تملك صلاحية الاطّلاع على الرسائل" · `forbiddenBody` "This account is not permitted to read the contact inbox."/"هذا الحساب غير مصرّح له بقراءة صندوق رسائل التواصل."

**Detail (7):** `detail.backToList` "Back to messages"/"العودة إلى الرسائل" · `detail.from` From/المُرسِل · `detail.email` Email/البريد الإلكتروني · `detail.receivedAt` "Received {date}"/"وصلت في {date}" · `detail.messageHeading` Message/نص الرسالة · `detail.notFoundTitle` "Message not found"/"الرسالة غير موجودة" · ★`detail.notFoundBody` "This message doesn't exist or is no longer available."/"هذه الرسالة غير موجودة أو لم تعد متاحة."

**Actions (6):** ★`actions.markRead` "Mark as read"/"وضع علامة كمقروءة" · ★`actions.markUnread` "Mark as unread"/"وضع علامة كغير مقروءة" · `actions.archive` Archive/أرشفة · `actions.unarchive` "Restore from archive"/"استعادة من الأرشيف" · `actions.reply` "Reply by email"/"الرد عبر البريد" · `actions.replyHint` "Opens your email client — replies are not sent from the dashboard."/"يفتح برنامج البريد لديك — لا تُرسَل الردود من لوحة التحكم."

**Archive + write failures (6):** `archiveConfirm.title` "Archive this message?"/"أرشفة هذه الرسالة؟" · `archiveConfirm.body` "\"{subject}\" moves to the archive. Archived messages are permanently deleted 12 months after archiving."/"ستُنقل «{subject}» إلى الأرشيف. تُحذف الرسائل المؤرشفة نهائيًا بعد 12 شهرًا من أرشفتها." · `archiveConfirm.confirm` Archive/أرشفة · `archiveConfirm.cancel` Cancel/إلغاء · `updateErrorTitle` "The change didn't save"/"تعذّر حفظ التغيير" · `updateErrorBody` "Try again in a moment."/"حاول مرة أخرى بعد قليل."

## 8. Test architecture

**Prism stays the primary contract lane** — it proves the page renders and the POST shape is
contract-valid.

**Outcome branches extend the existing `scripts/e2e/scenario-server.ts`** with a POST
handler. No fifth Playwright server pair (issue #30).

Scenario selection uses a **request header set via `page.setExtraHTTPHeaders()`, scoped to
the `ssr-scenarios` Playwright project only**. Deliberately **not** the subject text: subject
is user-visible content that could plausibly occur in production, and selecting behaviour
from it would make a real visitor's message change server behaviour. The header cannot reach
the real API because the contract/Prism, scenario and real-API lanes are separate projects
with separate `baseURL`s.

## 9. D20-22 measurement and the zod contingency

`/contact` and `/ar/contact` join `lighthouserc.cjs` and `scripts/check-route-size.mjs`, and
the "accepted web-005 404" deferral comments are removed from both.

zod is currently imported **only** in `app/pages/dashboard/login.vue` — inside the
client-only dashboard segment, which is **not** in the public route matrix. So zod entering
`/contact` is genuinely new weight against the frozen 101 KiB app-owned budget, and the
contingency is live rather than theoretical.

If a frozen budget fails because of zod: keep `UForm`/`UFormField` and every accessibility
behaviour, replace **only** the schema with a feature-local validator passed to `UForm`'s
validate function, add no dependency, change no threshold.

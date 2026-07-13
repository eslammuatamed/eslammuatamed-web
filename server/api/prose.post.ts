import { z } from 'zod'

// Presentation infrastructure, not a business endpoint (doc 08 §1): a stateless Markdown → HTML
// transform that keeps the Shiki highlighter server-side (D20-3). Business data still comes from
// the NestJS API; this only renders the opaque Markdown it returns. `ContentProse` is the sole
// caller.
const bodySchema = z.object({
  source: z.string().max(262144) // 256 KiB — matches the API's Markdown field cap (doc 19 §5)
})

export default defineEventHandler(async (event) => {
  const { source } = await readValidatedBody(event, bodySchema.parse)
  return { html: await renderMarkdown(source) }
})

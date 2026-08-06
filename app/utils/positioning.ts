/**
 * The governed public title, flattened to a single line for machine-readable output.
 *
 * The approved professional title is a two-line composition and the line break is stored with the
 * value, so the hero can render it without hard-coding a title of its own. That break is a
 * typographic instruction for the page, not part of the job title itself — `Person.jobTitle` in
 * JSON-LD is consumed by search engines as plain text, where a literal newline would be noise.
 *
 * So the break stays in the data and is collapsed exactly where a machine reads it. Consecutive
 * whitespace collapses to one space and the ends are trimmed, which is what HTML does anyway for
 * every visual consumer that has not opted into `white-space: pre-line`.
 */
export function singleLineTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

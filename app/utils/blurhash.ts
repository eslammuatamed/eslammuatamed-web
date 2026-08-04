/**
 * Average colour of a BlurHash, for use as a low-quality image placeholder (FR-PUB-032).
 *
 * A full BlurHash decode needs a canvas and a client-side library. That is deliberate over-engineering
 * here: the placeholder's job is to occupy the reserved box with something better than a grey rectangle
 * until the real image paints, and the DC term — the first component, which IS the average colour —
 * gives exactly that for ~20 lines, with no dependency and no client-only code path. Space itself is
 * reserved by the descriptor's width/height, which is what actually keeps CLS at zero.
 *
 * Format (github.com/woltapp/blurhash): base83; `[0]` size flag, `[1]` quantised max AC,
 * `[2..6]` the DC term as a 4-character base83 integer packing three 8-bit sRGB channels.
 */
const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

function decodeBase83(value: string): number | null {
  let result = 0
  for (const char of value) {
    const index = BASE83.indexOf(char)
    if (index === -1) return null
    result = result * 83 + index
  }
  return result
}

/** sRGB channel (0-255) → linear, per the BlurHash reference implementation. */
function sRgbToLinear(channel: number): number {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function linearToSRgb(value: number): number {
  const v = Math.max(0, Math.min(1, value))
  const channel = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.round(channel * 255)
}

/**
 * Returns an `rgb(...)` string, or `null` when the hash is absent or malformed — callers fall back to a
 * token surface rather than rendering a broken style. A malformed hash is possible: it is CMS data.
 */
export function blurhashAverageColor(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 6) return null

  const dc = decodeBase83(hash.slice(2, 6))
  if (dc === null) return null

  // The DC term stores sRGB bytes; round-tripping through linear matches the reference decoder, which
  // averages in linear space.
  const r = linearToSRgb(sRgbToLinear((dc >> 16) & 255))
  const g = linearToSRgb(sRgbToLinear((dc >> 8) & 255))
  const b = linearToSRgb(sRgbToLinear(dc & 255))

  return `rgb(${r} ${g} ${b})`
}

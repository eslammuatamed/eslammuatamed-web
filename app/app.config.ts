/* Nuxt UI reads its semantic color scales from these Tailwind palettes; the doc 03 §2
   values are layered onto the resulting --ui-* variables in main.css (D14-3). Violet
   accent (D03-7), zinc neutrals — the palette the design system is drawn on (doc 03 §2). */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'zinc',
      success: 'green',
      warning: 'amber',
      error: 'red'
    },
    // Authored button language (007, D03-13) — restrained, not a filled-pill everywhere. Kept on the
    // token radius (control 6px). Medium weight + a compositor-only press (active:scale, no layout shift)
    // give a deliberate, premium feel across every button-like action; focus-visible is the global ring.
    // The solid violet fill always pairs with white text (violet-600 clears AA on white in both themes —
    // Nuxt UI's theme-flipped `text-inverted` would otherwise go dark-on-violet in dark mode).
    button: {
      slots: {
        base: 'font-medium transition active:scale-[0.98] motion-reduce:active:scale-100'
      },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'text-white hover:text-white' }
      ]
    }
  }
})

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
    },
    // Field-error text is darkened in LIGHT mode only. Nuxt UI's default resolves `text-error` to
    // red-500, which measures 3.71:1 against the light surface (#fb2c36 on #fcfcfc) — below the
    // 4.5:1 WCAG AA minimum for body text, and a real unfiltered-axe failure on the first public
    // route that renders form errors. red-700 clears it. Dark mode already passes on the dark
    // surface and is deliberately left alone, since lightening it there would reduce contrast.
    // Applies to every UFormField, so the dashboard's forms inherit the same correction.
    formField: {
      slots: {
        error: 'text-error-700 dark:text-error'
      }
    }
  }
})

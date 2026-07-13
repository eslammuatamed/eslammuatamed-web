/* Nuxt UI reads its semantic color scales from these Tailwind palettes; the doc 03 §2
   values are layered onto the resulting --ui-* variables in main.css (D14-3). Blue accent,
   zinc neutrals — the palette the design system was drawn on (doc 03 §2). */
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'zinc',
      success: 'green',
      warning: 'amber',
      error: 'red'
    }
  }
})

/**
 * Authoritative bundle provenance for the doc 20 §1 JS budgets.
 *
 * Enabled ONLY when `ANALYZE_BUNDLE=1`, so normal `nuxt build` output is bit-for-bit unaffected —
 * this plugin writes a sidecar file and never transforms, renames, or re-chunks anything.
 *
 * Why Rollup's `generateBundle` and not a filename heuristic: doc 20 §1 budgets "≤ 35 KB app-code",
 * and deciding what is app code from chunk names (`entry`, `vendor`, hashes) is guesswork. Rollup
 * knows exactly which module ids ended up in which chunk and how many bytes each contributed after
 * tree-shaking (`renderedLength`), which is the only defensible basis for the split.
 *
 * The emitted JSON is analysis input, never a runtime asset.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

export const BUNDLE_META_PATH = '.bundle-analysis/client-chunks.json'

export interface ChunkModuleRecord {
  /** Resolved module id, relative to the repo root where possible. */
  id: string
  /**
   * Bytes this module contributed to the chunk AFTER tree-shaking, BEFORE minification. Useful as a
   * relative weight only — the sum across a chunk's modules exceeds the chunk's final size.
   */
  renderedLength: number
}

export interface ChunkRecord {
  fileName: string
  isEntry: boolean
  isDynamicEntry: boolean
  /** Static imports — fetched eagerly with the chunk. */
  imports: string[]
  /** Dynamic imports — fetched only when the code path runs. */
  dynamicImports: string[]
  /** Total rendered code size of the chunk. */
  renderedLength: number
  modules: ChunkModuleRecord[]
}

/** Vite plugin that dumps client chunk→module provenance next to the build. */
export function bundleAnalysisPlugin(rootDir: string): Plugin {
  // Nuxt runs Vite twice (client, then SSR). Only the client bundle is "JS transferred per public
  // route", so the SSR pass is skipped. `config.build.ssr` is the stable signal for which pass this
  // is — captured here rather than probing plugin-context internals that vary between Vite versions.
  let isSsr = false

  return {
    name: 'eslammuatamed:bundle-analysis',
    apply: 'build',
    configResolved(config) {
      isSsr = Boolean(config.build.ssr)
    },
    generateBundle(_options, bundle) {
      if (isSsr) return

      const chunks: ChunkRecord[] = []
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        const modules: ChunkModuleRecord[] = Object.entries(output.modules).map(([id, info]) => ({
          // Relativise repo-internal ids so the output is stable across machines; leave
          // node_modules ids recognisable for package attribution.
          id: id.startsWith(rootDir) ? id.slice(rootDir.length + 1) : id,
          renderedLength: info.renderedLength
        }))
        chunks.push({
          fileName: output.fileName,
          isEntry: output.isEntry,
          isDynamicEntry: output.isDynamicEntry,
          imports: output.imports,
          dynamicImports: output.dynamicImports,
          renderedLength: output.code.length,
          modules: modules.sort((a, b) => b.renderedLength - a.renderedLength)
        })
      }

      const target = resolve(rootDir, BUNDLE_META_PATH)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(
        target,
        `${JSON.stringify({ generatedFrom: 'rollup generateBundle (client)', chunks: chunks.sort((a, b) => b.renderedLength - a.renderedLength) }, null, 2)}\n`
      )
      this.info(`bundle analysis written to ${BUNDLE_META_PATH} (${chunks.length} client chunks)`)
    }
  }
}

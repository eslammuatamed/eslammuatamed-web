import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CALIBRATION_PATHS, PROFILES } from './lib/lighthouse-governed-urls.cjs'
import { estimateFeasibility, summarizeReports, verifyEvidence, writeChecksums } from './reference-calibration-evidence.mjs'

const sandboxes = []
afterEach(() => sandboxes.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })))

function sandbox() {
  const path = mkdtempSync(join(tmpdir(), 'reference-calibration-'))
  sandboxes.push(path)
  return path
}

function reports({ omitLast = false, root = sandbox() } = {}) {
  let index = 0
  for (const profile of PROFILES) {
    mkdirSync(join(root, profile), { recursive: true })
    for (const path of CALIBRATION_PATHS) {
      for (let run = 0; run < 3; run++) {
        index++
        if (omitLast && index === 24) continue
        const origin = 'https://127.0.0.1:44000'
        writeFileSync(join(root, profile, `${index}.json`), JSON.stringify({
          requestedUrl: `${origin}${path}`,
          configSettings: { formFactor: profile },
          lighthouseVersion: '13.0.1',
          categories: {
            performance: { score: (90 + run) / 100 }, accessibility: { score: 1 },
            'best-practices': { score: 1 }, seo: { score: 1 }
          },
          audits: {
            'largest-contentful-paint': { numericValue: 1000 + run * 100 },
            'cumulative-layout-shift': { numericValue: 0.01 + run * 0.001 }
          }
        }))
      }
    }
  }
  return root
}

function evidencePackage() {
  const sha = 'a'.repeat(40)
  const root = join(sandbox(), sha)
  reports({ root })
  mkdirSync(join(root, 'environment'), { recursive: true })
  mkdirSync(join(root, 'summary'), { recursive: true })
  writeFileSync(join(root, 'environment', 'manifest.json'), JSON.stringify({ classification: 'CALIBRATION ONLY — NOT FE5-U7 ACCEPTANCE EVIDENCE', source: { sha, tree: 'b'.repeat(40) } }))
  writeFileSync(join(root, 'summary', 'calibration-summary.json'), JSON.stringify(summarizeReports(root)))
  const boundReports = PROFILES.flatMap(profile => readdirSync(join(root, profile)).map(name => {
    const path = join(root, profile, name)
    return { file: `${profile}/${name}`, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
  }))
  writeFileSync(join(root, 'summary', 'provenance.json'), JSON.stringify({
    identity: { head: sha, tree: 'b'.repeat(40) }, mode: 'calibration', expectedPaths: CALIBRATION_PATHS,
    reports: boundReports
  }))
  writeFileSync(join(root, 'summary', 'protocol-proof.json'), JSON.stringify({
    mode: 'calibration', preflight: [
      { path: '/', alpn: 'h2', status: 200 }, { path: '/ar', alpn: 'h2', status: 200 },
      { path: '/_nuxt/app.js', alpn: 'h2', status: 200 }
    ],
    measured: { mobile: { firstPartyByProtocol: { h2: 12 } }, desktop: { firstPartyByProtocol: { h2: 12 } } }
  }))
  writeFileSync(join(root, 'summary', 'prism-preflight.json'), JSON.stringify({ fixtures: { en: { aboutBioSha256: '1' }, ar: { aboutBioSha256: '2' } } }))
  writeChecksums(root)
  return root
}

describe('reference calibration evidence', () => {
  it('requires and summarizes exactly 24 raw reports', () => {
    const summary = summarizeReports(reports())
    expect(summary.auditCount).toBe(24)
    expect(summary.configurations).toHaveLength(8)
    expect(summary.configurations[0].metrics.performance.values).toHaveLength(3)
  })

  it('rejects a truncated calibration matrix', () => {
    expect(() => summarizeReports(reports({ omitLast: true }))).toThrow(/2\/3 calibration runs/)
  })

  it('computes an explicit 96-audit one-runner feasibility projection', () => {
    expect(estimateFeasibility({ setupSeconds: 120, auditSeconds: 300, packagingSeconds: 15, timeoutSeconds: 2700 }))
      .toMatchObject({ projectedSeconds: 1335, marginSeconds: 1365, fitsTimeout: true })
  })

  it('detects artifact tampering through SHA-256 verification', () => {
    const root = evidencePackage()
    expect(verifyEvidence(root)).toMatchObject({ sourceSha: 'a'.repeat(40) })
    writeFileSync(join(root, 'summary', 'calibration-summary.json'), JSON.stringify({ auditCount: 96 }))
    expect(() => verifyEvidence(root)).toThrow(/checksum mismatch/)
  })

  it('detects a missing checksummed artifact', () => {
    const root = sandbox()
    writeFileSync(join(root, 'orphan.json'), '{}')
    writeChecksums(root)
    rmSync(join(root, 'orphan.json'))
    expect(() => verifyEvidence(root)).toThrow(/is missing/)
  })

  it('rejects an empty direct HTTP/2 preflight even when checksums are current', () => {
    const root = evidencePackage()
    const path = join(root, 'summary', 'protocol-proof.json')
    const proof = JSON.parse(readFileSync(path, 'utf8'))
    proof.preflight = []
    writeFileSync(path, JSON.stringify(proof))
    writeChecksums(root)
    expect(() => verifyEvidence(root)).toThrow(/preflight proof is missing or invalid/)
  })
})

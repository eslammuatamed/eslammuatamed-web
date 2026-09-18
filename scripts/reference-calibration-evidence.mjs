#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { CALIBRATION_PATHS, PROFILES } from './lib/lighthouse-governed-urls.cjs'

const ROOT = '.lighthouseci'
const CLASSIFICATION = 'CALIBRATION ONLY — NOT FE5-U7 ACCEPTANCE EVIDENCE'
const START_SNAPSHOT = 'reference-environment-start.json'

const json = path => JSON.parse(readFileSync(path, 'utf8'))
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const command = (cmd, args = []) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() } catch { return 'unavailable' }
}
const installedVersion = path => {
  try { return json(path).version } catch { return 'unavailable' }
}
const pathOf = url => {
  const path = new URL(url).pathname
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

export function summarizeReports(reportRoot = ROOT) {
  const rows = []
  for (const profile of PROFILES) {
    const dir = join(reportRoot, profile)
    const files = readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'manifest.json').sort()
    for (const name of files) {
      const lhr = json(join(dir, name))
      rows.push({
        file: `${profile}/${name}`,
        profile: lhr?.configSettings?.formFactor,
        path: pathOf(lhr.requestedUrl),
        lighthouseVersion: lhr?.lighthouseVersion,
        performance: lhr?.categories?.performance?.score * 100,
        accessibility: lhr?.categories?.accessibility?.score * 100,
        bestPractices: lhr?.categories?.['best-practices']?.score * 100,
        seo: lhr?.categories?.seo?.score * 100,
        lcpMs: lhr?.audits?.['largest-contentful-paint']?.numericValue,
        cls: lhr?.audits?.['cumulative-layout-shift']?.numericValue
      })
    }
  }

  const expected = new Set(PROFILES.flatMap(profile => CALIBRATION_PATHS.map(path => `${profile} ${path}`)))
  const groups = new Map()
  for (const row of rows) {
    const key = `${row.profile} ${row.path}`
    if (!expected.has(key)) throw new Error(`unexpected calibration report: ${key}`)
    if (typeof row.lighthouseVersion !== 'string' || !row.lighthouseVersion) {
      throw new Error(`${row.file} has no Lighthouse version`)
    }
    if (![row.performance, row.accessibility, row.bestPractices, row.seo, row.lcpMs, row.cls].every(Number.isFinite)) {
      throw new Error(`${row.file} lacks numeric category, LCP, or CLS evidence`)
    }
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  for (const key of expected) {
    const count = groups.get(key)?.length ?? 0
    if (count !== 3) throw new Error(`${key} has ${count}/3 calibration runs`)
  }

  const configurations = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, runs]) => {
    const versions = [...new Set(runs.map(run => run.lighthouseVersion))]
    if (versions.length !== 1) throw new Error(`${key} mixes Lighthouse versions: ${versions.join(', ')}`)
    const metrics = {}
    for (const field of ['performance', 'accessibility', 'bestPractices', 'seo', 'lcpMs', 'cls']) {
      const values = runs.map(run => run[field])
      const mid = median(values)
      const range = Math.max(...values) - Math.min(...values)
      metrics[field] = { values, median: mid, min: Math.min(...values), max: Math.max(...values), range, relativeSpread: mid === 0 ? null : range / mid }
    }
    return { key, profile: runs[0].profile, path: runs[0].path, lighthouseVersion: versions[0], runs: runs.map(run => run.file), metrics }
  })
  const lighthouseVersions = [...new Set(rows.map(row => row.lighthouseVersion))]
  if (lighthouseVersions.length !== 1) throw new Error(`calibration package mixes Lighthouse versions: ${lighthouseVersions.join(', ')}`)
  return { schemaVersion: 1, classification: CLASSIFICATION, auditCount: rows.length, lighthouseVersion: lighthouseVersions[0], configurations }
}

export function estimateFeasibility({ auditSeconds, setupSeconds, packagingSeconds, timeoutSeconds = 2700 }) {
  for (const [name, value] of Object.entries({ auditSeconds, setupSeconds, packagingSeconds, timeoutSeconds })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`)
  }
  const projectedSeconds = setupSeconds + (auditSeconds * 4) + packagingSeconds
  return {
    method: 'observed 24-audit calibration duration scaled linearly to 96 audits on one runner, plus observed setup and packaging',
    calibrationAudits: 24,
    projectedAudits: 96,
    inputs: { auditSeconds, setupSeconds, packagingSeconds, timeoutSeconds },
    projectedSeconds,
    marginSeconds: timeoutSeconds - projectedSeconds,
    fitsTimeout: projectedSeconds <= timeoutSeconds,
    caveat: 'Projection is feasibility evidence only; it is not U7-G3 acceptance evidence.'
  }
}

function capacitySnapshot() {
  return {
    cpuModel: command('sh', ['-c', "awk -F: '/model name/{gsub(/^ /,\"\",$2); print $2; exit}' /proc/cpuinfo"]),
    logicalCpus: command('nproc'), memory: command('sh', ['-c', "awk '/MemTotal/{print $2 \" kB\"}' /proc/meminfo"]),
    kernel: command('uname', ['-a']), disk: command('df', ['-Pk', '.']),
    load: command('sh', ['-c', 'cat /proc/loadavg']),
    cpuStealJiffies: command('sh', ['-c', "awk 'NR==1 {print $9}' /proc/stat"])
  }
}

export function captureEnvironmentSnapshot() {
  const pkg = json('package.json')
  const lockHash = sha256('package-lock.json')
  const snapshot = {
    schemaVersion: 1,
    classification: CLASSIFICATION,
    observedAt: new Date().toISOString(),
    source: {
      sha: command('git', ['rev-parse', 'HEAD']), tree: command('git', ['rev-parse', 'HEAD^{tree}']),
      packageLockSha256: lockHash, packageLockGitBlob: command('git', ['rev-parse', 'HEAD:package-lock.json'])
    },
    github: {
      workflow: process.env.GITHUB_WORKFLOW ?? null, runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null, job: process.env.GITHUB_JOB ?? null,
      runnerName: process.env.RUNNER_NAME ?? null, runnerOs: process.env.RUNNER_OS ?? null,
      runnerArch: process.env.RUNNER_ARCH ?? null, imageOs: process.env.ImageOS ?? null,
      imageVersion: process.env.ImageVersion ?? null
    },
    capacity: capacitySnapshot(),
    toolchain: {
      node: process.version, npm: command('npm', ['--version']),
      lighthouse: installedVersion('node_modules/lighthouse/package.json'),
      lhci: installedVersion('node_modules/@lhci/cli/package.json'),
      chrome: command(process.env.CHROME_PATH ?? 'google-chrome', ['--version']),
      prism: pkg.devDependencies?.['@stoplight/prism-cli'] ?? 'unavailable'
    },
    fixtures: {
      openapiSha256: sha256('openapi/openapi.json'),
      localeProxySha256: sha256('scripts/e2e/prism-locale-proxy.mjs'),
      localeSelectionSha256: sha256('scripts/e2e/prism-locale-selection.mjs'),
      pageSeoFixturesSha256: sha256('scripts/e2e/page-seo-prism-fixtures.mjs')
    }
  }
  const essential = {
    sourceSha: snapshot.source.sha, sourceTree: snapshot.source.tree,
    cpuModel: snapshot.capacity.cpuModel, logicalCpus: snapshot.capacity.logicalCpus,
    memory: snapshot.capacity.memory, kernel: snapshot.capacity.kernel, disk: snapshot.capacity.disk,
    load: snapshot.capacity.load, cpuStealJiffies: snapshot.capacity.cpuStealJiffies,
    npm: snapshot.toolchain.npm, lighthouse: snapshot.toolchain.lighthouse,
    lhci: snapshot.toolchain.lhci, chrome: snapshot.toolchain.chrome
  }
  const missing = Object.entries(essential).filter(([, value]) => !value || value === 'unavailable').map(([name]) => name)
  if (missing.length > 0 || !/^[a-f0-9]{40}$/.test(snapshot.source.sha)) {
    throw new Error(`reference environment snapshot is incomplete: ${missing.join(', ') || 'sourceSha'}`)
  }
  return snapshot
}

function environmentManifest(provenance, reportRoot) {
  const start = json(join(reportRoot, START_SNAPSHOT))
  return {
    ...start,
    source: { ...start.source, buildIdentity: provenance.identity },
    postMeasurement: { observedAt: new Date().toISOString(), capacity: capacitySnapshot() }
  }
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

export function writeChecksums(root) {
  const target = join(root, 'SHA256SUMS')
  const lines = listFiles(root).filter(path => path !== target).sort()
    .map(path => `${sha256(path)}  ${relative(root, path)}`)
  writeFileSync(target, `${lines.join('\n')}\n`)
  return lines.length
}

export function verifyEvidence(root) {
  const checksumFile = join(root, 'SHA256SUMS')
  if (!existsSync(checksumFile)) throw new Error(`${checksumFile} is missing`)
  const lines = readFileSync(checksumFile, 'utf8').trim().split('\n').filter(Boolean)
  const listed = new Set()
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})[ ]{2}(.+)$/)
    if (!match) throw new Error(`malformed checksum line: ${line}`)
    if (isAbsolute(match[2]) || match[2].split('/').includes('..')) throw new Error(`unsafe checksum path: ${match[2]}`)
    const path = join(root, match[2])
    listed.add(match[2])
    if (!existsSync(path)) throw new Error(`checksummed artifact is missing: ${match[2]}`)
    if (sha256(path) !== match[1]) throw new Error(`checksum mismatch: ${match[2]}`)
  }
  if (listed.size !== lines.length) throw new Error('duplicate checksum path present')
  const actual = listFiles(root).filter(path => path !== checksumFile).map(path => relative(root, path))
  const unlisted = actual.filter(path => !listed.has(path))
  if (unlisted.length > 0) throw new Error(`unchecksummed artifact present: ${unlisted.join(', ')}`)
  const manifest = json(join(root, 'environment', 'manifest.json'))
  const summary = json(join(root, 'summary', 'calibration-summary.json'))
  const provenance = json(join(root, 'summary', 'provenance.json'))
  if (manifest.classification !== CLASSIFICATION || summary.classification !== CLASSIFICATION || summary.auditCount !== 24) {
    throw new Error('evidence is not a complete 24-audit calibration package')
  }
  if (manifest.source?.sha !== provenance.identity?.head || manifest.source?.tree !== provenance.identity?.tree || basename(root) !== manifest.source?.sha) {
    throw new Error('manifest, provenance, and SHA-bound package directory identify different source states')
  }
  if (provenance.mode !== 'calibration' || JSON.stringify(provenance.expectedPaths) !== JSON.stringify(CALIBRATION_PATHS)) {
    throw new Error('provenance does not identify the bounded calibration population')
  }
  const provenanceHashes = new Map((provenance.reports ?? []).map(report => [report.file, report.sha256]))
  for (const profile of PROFILES) {
    for (const name of readdirSync(join(root, profile)).filter(name => name.endsWith('.json'))) {
      const key = `${profile}/${name}`
      if (provenanceHashes.get(key) !== sha256(join(root, key))) throw new Error(`raw report is not bound by provenance: ${key}`)
    }
  }
  const recomputed = summarizeReports(root)
  if (JSON.stringify(recomputed.configurations) !== JSON.stringify(summary.configurations)) {
    throw new Error('calibration summary does not match the retained raw reports')
  }
  const protocol = json(join(root, 'summary', 'protocol-proof.json'))
  const preflightPaths = new Set((protocol.preflight ?? []).map(item => item.path))
  const hasRequiredPreflight = preflightPaths.has('/') && preflightPaths.has('/ar')
    && [...preflightPaths].some(path => path.startsWith('/_nuxt/'))
  if (protocol.mode !== 'calibration' || !Array.isArray(protocol.preflight) || !hasRequiredPreflight
    || protocol.preflight.some(item => item.alpn !== 'h2' || item.status < 200 || item.status >= 400)) {
    throw new Error('direct calibration HTTP/2 preflight proof is missing or invalid')
  }
  for (const profile of PROFILES) {
    const counts = protocol.measured?.[profile]?.firstPartyByProtocol
    if (!counts || !Number.isFinite(counts.h2) || counts.h2 <= 0 || Object.keys(counts).some(name => name !== 'h2')) {
      throw new Error(`${profile} measured-session HTTP/2 proof is missing or invalid`)
    }
  }
  const prism = json(join(root, 'summary', 'prism-preflight.json'))
  if (!prism.fixtures?.en?.aboutBioSha256 || !prism.fixtures?.ar?.aboutBioSha256 || prism.fixtures.en.aboutBioSha256 === prism.fixtures.ar.aboutBioSha256) {
    throw new Error('distinct EN/AR Prism fixture proof is missing')
  }
  return { files: lines.length, sourceSha: manifest.source.sha }
}

export function collectEvidence({ reportRoot = ROOT, outputRoot = join(ROOT, 'reference-calibration') } = {}) {
  for (const required of ['provenance.json', 'protocol-proof.json', 'prism-preflight.json', START_SNAPSHOT]) {
    if (!existsSync(join(reportRoot, required))) throw new Error(`${join(reportRoot, required)} is missing`)
  }
  const provenance = json(join(reportRoot, 'provenance.json'))
  const summary = summarizeReports(reportRoot)
  const sourceSha = provenance?.identity?.head
  if (!/^[a-f0-9]{40}$/.test(sourceSha ?? '')) throw new Error('provenance has no full source SHA')
  const root = join(outputRoot, sourceSha)
  rmSync(root, { recursive: true, force: true })
  mkdirSync(join(root, 'environment'), { recursive: true })
  mkdirSync(join(root, 'summary'), { recursive: true })
  for (const profile of PROFILES) {
    mkdirSync(join(root, profile), { recursive: true })
    for (const name of readdirSync(join(reportRoot, profile)).filter(name => name.endsWith('.json') && name !== 'manifest.json')) {
      cpSync(join(reportRoot, profile, name), join(root, profile, name))
    }
  }
  writeFileSync(join(root, 'environment', 'manifest.json'), `${JSON.stringify(environmentManifest(provenance, reportRoot), null, 2)}\n`)
  const timings = {
    setupSeconds: Number(process.env.REFERENCE_SETUP_SECONDS ?? 0),
    auditSeconds: Number(process.env.REFERENCE_AUDIT_SECONDS ?? 0),
    packagingSeconds: Number(process.env.REFERENCE_PACKAGING_SECONDS ?? 0),
    timeoutSeconds: Number(process.env.REFERENCE_TIMEOUT_SECONDS ?? 2700)
  }
  summary.feasibility = estimateFeasibility(timings)
  writeFileSync(join(root, 'summary', 'calibration-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  for (const name of ['provenance.json', 'protocol-proof.json', 'prism-preflight.json']) cpSync(join(reportRoot, name), join(root, 'summary', name))
  writeChecksums(root)
  return { root, ...verifyEvidence(root) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const mode = process.argv[2] ?? 'collect'
    const outputRoot = process.env.REFERENCE_EVIDENCE_DIR ?? join(ROOT, 'reference-calibration')
    const result = mode === 'snapshot'
      ? (() => {
          mkdirSync(ROOT, { recursive: true })
          const snapshot = captureEnvironmentSnapshot()
          writeFileSync(join(ROOT, START_SNAPSHOT), `${JSON.stringify(snapshot, null, 2)}\n`)
          return { path: join(ROOT, START_SNAPSHOT), sourceSha: snapshot.source.sha }
        })()
      : mode === 'collect'
      ? collectEvidence({ outputRoot })
      : mode === 'verify'
        ? verifyEvidence(process.argv[3] ?? join(outputRoot, command('git', ['rev-parse', 'HEAD'])))
        : (() => { throw new Error(`unknown mode ${mode}; expected snapshot, collect, or verify`) })()
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error(`[reference-calibration-evidence] ${error.message}`)
    process.exit(1)
  }
}

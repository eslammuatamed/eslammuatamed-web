import { readFileSync } from 'node:fs'
import { parse, stringify } from 'yaml'
import { describe, expect, it } from 'vitest'

const CI_WORKFLOW = '.github/workflows/ci.yml'
const REQUIRED_AUDIT = 'npm audit --audit-level=high'

function commandLines(run) {
  return String(run ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

function branchesFor(event) {
  if (!event || typeof event !== 'object') return []
  return Array.isArray(event.branches) ? event.branches : []
}

function requireFullGraphEnvironment(...scopes) {
  for (const scope of scopes) {
    const env = scope?.env ?? {}
    for (const [name, value] of Object.entries(env)) {
      const normalizedName = name.toUpperCase()
      const normalizedValue = String(value).trim().toLowerCase()
      if (normalizedName === 'NODE_ENV' && normalizedValue === 'production') {
        throw new Error('full-graph CI must not install or audit with NODE_ENV=production')
      }
      if (normalizedName === 'NPM_CONFIG_OMIT' && normalizedValue.split(/[\s,]+/).includes('dev')) {
        throw new Error('full-graph CI must not set NPM_CONFIG_OMIT=dev')
      }
    }
  }
}

function requireUnmodifiedShell(workflow, job, installStep, auditStep) {
  if (workflow.defaults?.run?.shell || job.defaults?.run?.shell) {
    throw new Error('full-graph install and HIGH+ audit must not inherit a custom shell')
  }
  if ('shell' in installStep || 'shell' in auditStep) {
    throw new Error('full-graph install and HIGH+ audit must use the unmodified default shell')
  }
}

function requireBranches(workflow) {
  const triggers = workflow.on
  if (!triggers || typeof triggers !== 'object') {
    throw new Error('CI must define pull_request and push event mappings')
  }

  const pullRequest = triggers.pull_request
  const push = triggers.push
  const pullRequestBranches = branchesFor(pullRequest)
  const pushBranches = branchesFor(push)

  for (const branch of ['dev', 'main']) {
    if (!pullRequestBranches.includes(branch)) {
      throw new Error(`CI pull_request coverage must include ${branch}`)
    }
  }
  if (!pushBranches.includes('dev')) {
    throw new Error('CI push coverage must include dev')
  }

  for (const [name, event] of [['pull_request', pullRequest], ['push', push]]) {
    if ('paths' in event || 'paths-ignore' in event) {
      throw new Error(`CI ${name} coverage must not be reduced by path filters`)
    }
  }
}

export function validateCiSecurityGateYaml(source) {
  const workflow = parse(source)
  requireBranches(workflow)

  const candidates = []
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    for (const [stepIndex, step] of (job.steps ?? []).entries()) {
      if (commandLines(step.run).some(line => /(?:^|\s)npm\s+audit(?:\s|$)/.test(line))) {
        candidates.push({ jobName, job, step, stepIndex })
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error('required blocking HIGH+ audit step absent')
  }
  if (candidates.length !== 1) {
    throw new Error(`expected exactly one HIGH+ audit step, found ${candidates.length}`)
  }

  const [{ jobName, job, step, stepIndex }] = candidates
  if ('if' in job || 'if' in step) {
    throw new Error(`HIGH+ audit in ${jobName} must run for every configured CI event`)
  }
  if ('continue-on-error' in job) {
    throw new Error('HIGH+ audit job must not contain continue-on-error')
  }
  if ('continue-on-error' in step) {
    throw new Error('HIGH+ audit must not contain continue-on-error')
  }

  const lines = commandLines(step.run)
  if (lines.some(line => /--omit(?:=|\s+)dev\b/.test(line))) {
    throw new Error('HIGH+ audit must include the full graph; --omit=dev is forbidden')
  }
  if (lines.length !== 1 || lines[0] !== REQUIRED_AUDIT) {
    throw new Error(`HIGH+ audit must be the exact blocking command: ${REQUIRED_AUDIT}`)
  }

  const installStep = job.steps
    .slice(0, stepIndex)
    .find(previous => commandLines(previous.run).includes('npm ci'))
  if (!installStep) {
    throw new Error('HIGH+ audit must run after a full npm ci in the same job')
  }
  if (commandLines(installStep.run).length !== 1 || commandLines(installStep.run)[0] !== 'npm ci') {
    throw new Error('HIGH+ audit must run after the exact full-graph install command: npm ci')
  }
  if ('if' in installStep || 'continue-on-error' in installStep) {
    throw new Error('full npm ci must be unconditional and blocking')
  }
  requireFullGraphEnvironment(workflow, job, installStep, step)
  requireUnmodifiedShell(workflow, job, installStep, step)
}

function fixture({
  audit = REQUIRED_AUDIT,
  continueOnError = false,
  includeAudit = true,
  install = 'npm ci',
  jobContinueOnError = false,
  jobEnv,
  auditShell,
  jobDefaultShell
} = {}) {
  const auditStep = {
    name: 'Audit dependencies (HIGH+)',
    run: audit,
    ...(auditShell ? { shell: auditShell } : {}),
    ...(continueOnError ? { 'continue-on-error': true } : {})
  }
  return stringify({
    name: 'CI',
    on: {
      pull_request: { branches: ['dev', 'main'] },
      push: { branches: ['dev'] }
    },
    jobs: {
      verify: {
        'runs-on': 'ubuntu-latest',
        ...(jobContinueOnError ? { 'continue-on-error': true } : {}),
        ...(jobEnv ? { env: jobEnv } : {}),
        ...(jobDefaultShell ? { defaults: { run: { shell: jobDefaultShell } } } : {}),
        steps: [
          { run: install },
          ...(includeAudit ? [auditStep] : []),
          { run: 'npm test' }
        ]
      }
    }
  })
}

describe('D19 HIGH+ CI contract', () => {
  it('is enforced by the repository CI workflow', () => {
    expect(() => validateCiSecurityGateYaml(readFileSync(CI_WORKFLOW, 'utf8'))).not.toThrow()
  })

  it('rejects a missing audit step', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ includeAudit: false })))
      .toThrow(/required blocking HIGH\+ audit step absent/)
  })

  it('rejects a production-only audit', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ audit: 'npm audit --omit=dev --audit-level=high' })))
      .toThrow(/--omit=dev is forbidden/)
  })

  it('rejects continue-on-error even when the command is otherwise exact', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ continueOnError: true })))
      .toThrow(/must not contain continue-on-error/)
  })

  it('rejects job-level continue-on-error', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ jobContinueOnError: true })))
      .toThrow(/job must not contain continue-on-error/)
  })

  it('rejects a dev-omitting install command', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ install: 'npm ci --omit=dev' })))
      .toThrow(/full npm ci|exact full-graph install command/)
  })

  it('rejects inherited npm omission configuration', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ jobEnv: { NPM_CONFIG_OMIT: 'dev' } })))
      .toThrow(/must not set NPM_CONFIG_OMIT=dev/)
  })

  it('rejects production NODE_ENV during install and audit', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ jobEnv: { NODE_ENV: 'production' } })))
      .toThrow(/must not install or audit with NODE_ENV=production/)
  })

  it('rejects a weaker audit severity', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ audit: 'npm audit --audit-level=moderate' })))
      .toThrow(/exact blocking command/)
  })

  it('rejects shell masking of an otherwise exact command', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ audit: `${REQUIRED_AUDIT} || true` })))
      .toThrow(/exact blocking command/)
  })

  it('rejects a masking custom shell on the audit step', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ auditShell: 'bash {0} || true' })))
      .toThrow(/unmodified default shell/)
  })

  it('rejects an inherited masking shell default', () => {
    expect(() => validateCiSecurityGateYaml(fixture({ jobDefaultShell: 'bash {0} || true' })))
      .toThrow(/must not inherit a custom shell/)
  })
})

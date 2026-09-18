import { readFileSync } from 'node:fs'
import { parse, stringify } from 'yaml'
import { describe, expect, it } from 'vitest'

const WORKFLOW = '.github/workflows/reference-calibration.yml'

export function validateReferenceCalibrationWorkflow(source) {
  const workflow = parse(source)
  const triggers = Object.keys(workflow.on ?? {})
  if (triggers.length !== 1 || triggers[0] !== 'workflow_dispatch') throw new Error('workflow must be manual workflow_dispatch only')
  if (workflow.permissions?.contents !== 'read' || Object.keys(workflow.permissions).length !== 1) throw new Error('workflow permissions must be contents: read only')
  const jobs = Object.entries(workflow.jobs ?? {})
  if (jobs.length !== 1) throw new Error('calibration must run as exactly one job')
  const [, job] = jobs[0]
  if (job['runs-on'] !== 'ubuntu-latest' || job.strategy?.matrix) throw new Error('calibration must use one GitHub-hosted ubuntu-latest runner without a matrix')
  if ('environment' in job || /\$\{\{\s*secrets\./.test(source)) throw new Error('calibration must not use deployment environments or repository secrets')
  if (job['timeout-minutes'] !== 45) throw new Error('calibration job timeout must remain 45 minutes')
  if (job.env?.LH_RUN_MODE !== 'calibration' || job.env?.REFERENCE_CALIBRATION_ONLY !== '1' || job.env?.LH_PROFILES !== 'mobile,desktop') {
    throw new Error('bounded calibration mode and both profiles must be explicit')
  }
  const steps = job.steps ?? []
  const allowedActions = new Set(['actions/checkout@v4', 'actions/setup-node@v4', 'actions/upload-artifact@v4'])
  const unapprovedActions = steps.map(step => step.uses).filter(uses => uses && !allowedActions.has(uses))
  if (unapprovedActions.length > 0) throw new Error(`calibration contains an unapproved action: ${unapprovedActions.join(', ')}`)
  const checkout = steps.find(step => step.uses === 'actions/checkout@v4')
  if (checkout?.with?.ref !== '${{ github.sha }}' || checkout.with['persist-credentials'] !== false) throw new Error('checkout must bind github.sha without persisted credentials')
  const commands = steps.map(step => String(step.run ?? '')).join('\n')
  const commandLines = commands.split('\n').map(line => line.trim()).filter(Boolean)
  for (const required of ['npm ci', 'npm audit --audit-level=high', 'npm run reference:calibration:snapshot', 'npm run lighthouse:ci', 'npm run reference:calibration:evidence', 'npm run reference:calibration:verify']) {
    if (!commandLines.includes(required)) throw new Error(`required blocking command missing: ${required}`)
  }
  if (commandLines.indexOf('npm run reference:calibration:snapshot') > commandLines.indexOf('npm run lighthouse:ci')) throw new Error('runner capacity snapshot must precede measurement')
  if (/(?:\bssh\b|\bscp\b|\brsync\b|git\s+push|npm\s+run\s+deploy|kubectl|terraform\s+apply)/.test(commands)) {
    throw new Error('calibration workflow must not publish, deploy, or access remote hosts')
  }
  if (commandLines.some(line => /(?:^|\s)(?:>|>>)/.test(line) && !/\$GITHUB_(?:ENV|STEP_SUMMARY)/.test(line))) {
    throw new Error('calibration workflow must not mutate tracked repository or U7 state')
  }
  const upload = steps.find(step => step.uses === 'actions/upload-artifact@v4')
  if (!upload || upload.with?.path !== '.lighthouseci/reference-calibration/${{ github.sha }}' || upload.with?.['if-no-files-found'] !== 'error') {
    throw new Error('complete SHA-bound calibration artifact upload is required')
  }
  if (!commands.includes('CALIBRATION ONLY — NOT FE5-U7 ACCEPTANCE EVIDENCE') || !commands.includes('4 paths × 2 profiles × 3 runs = 24 audits')) {
    throw new Error('calibration-only scope and bounded 24-audit count must be visible')
  }
}

const actual = () => parse(readFileSync(WORKFLOW, 'utf8'))

describe('D20-43 reference calibration workflow contract', () => {
  it('accepts the repository workflow', () => {
    expect(() => validateReferenceCalibrationWorkflow(readFileSync(WORKFLOW, 'utf8'))).not.toThrow()
  })

  it.each([
    ['non-manual trigger', workflow => { workflow.on.push = { branches: ['dev'] } }, /workflow_dispatch only/],
    ['runner matrix', workflow => { workflow.jobs['frontend-v1-reference-calibration'].strategy = { matrix: { profile: ['mobile', 'desktop'] } } }, /without a matrix/],
    ['self-hosted runner', workflow => { workflow.jobs['frontend-v1-reference-calibration']['runs-on'] = 'self-hosted' }, /GitHub-hosted/],
    ['acceptance-sized mode', workflow => { workflow.jobs['frontend-v1-reference-calibration'].env.LH_RUN_MODE = 'governed' }, /calibration mode/],
    ['deployment command', workflow => { workflow.jobs['frontend-v1-reference-calibration'].steps.push({ run: 'npm run deploy' }) }, /must not publish/],
    ['production environment', workflow => { workflow.jobs['frontend-v1-reference-calibration'].environment = 'production' }, /deployment environments/],
    ['repository secret', workflow => { workflow.jobs['frontend-v1-reference-calibration'].env.PRODUCTION_TOKEN = '${{ secrets.PRODUCTION_TOKEN }}' }, /repository secrets/],
    ['tracked U7 mutation', workflow => { workflow.jobs['frontend-v1-reference-calibration'].steps.push({ run: "echo '- [x] U7-A01' >> .specify/specs/frontend-v1/tasks.md" }) }, /must not mutate tracked/],
    ['SSH action', workflow => { workflow.jobs['frontend-v1-reference-calibration'].steps.push({ uses: 'appleboy/ssh-action@v1' }) }, /unapproved action/]
  ])('rejects %s', (_label, mutate, signal) => {
    const workflow = actual()
    mutate(workflow)
    expect(() => validateReferenceCalibrationWorkflow(stringify(workflow))).toThrow(signal)
  })
})

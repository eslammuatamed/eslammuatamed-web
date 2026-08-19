import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'

const APP = resolve(process.cwd(), 'app')
const MODULE_FILES = [
  'composables/admin-skill-fields.ts',
  'composables/admin-skill-form.ts',
  'composables/useAdminSkills.ts',
  'pages/dashboard/skills/index.vue'
]
const OTHER_DASHBOARD_FILES = [
  'composables/admin-article-fields.ts',
  'composables/admin-article-form.ts',
  'composables/admin-article-types.ts',
  'composables/admin-articles-query.ts',
  'composables/useAdminArticles.ts',
  'composables/admin-experience-fields.ts',
  'composables/admin-experience-form.ts',
  'composables/admin-experience-types.ts',
  'composables/useAdminExperiences.ts',
  'composables/admin-project-form.ts',
  'composables/admin-project-types.ts',
  'composables/admin-projects-query.ts',
  'composables/useAdminProjects.ts'
]
const FORBIDDEN = ['admin-skill-fields', 'admin-skill-form', 'useAdminSkills', 'ADMIN_SKILL_GROUPS']

function files(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...files(full))
    else if (/\.(ts|vue)$/.test(entry.name) && !/\.(spec|test)\.ts$/.test(entry.name)) found.push(full)
  }
  return found
}

const publicFiles = files(APP)
  .map(file => relative(APP, file).split('\\').join('/'))
  .filter(file => !file.includes('dashboard/'))
  .filter(file => !MODULE_FILES.includes(file))
  .filter(file => !OTHER_DASHBOARD_FILES.includes(file))

describe('the admin Skills module stays out of the public surface', () => {
  it('scans a non-vacuous public set including the public skills consumer', () => {
    expect(publicFiles.length).toBeGreaterThan(20)
    expect(publicFiles).toContain('pages/index.vue')
    expect(publicFiles).toContain('composables/useResumeData.ts')
  })

  it('finds no public reference to the admin module', () => {
    const offenders: string[] = []
    for (const file of publicFiles) {
      const source = readFileSync(join(APP, file), 'utf8')
      for (const name of FORBIDDEN) if (source.includes(name)) offenders.push(`${file} -> ${name}`)
    }
    expect(offenders).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  ALLOW_LOOPBACK_ENV,
  DEV_SITE_URL,
  SITE_URL_ENV,
  isArtifactBuild,
  resolveSiteUrl,
  siteUrlFromEnv
} from './site-url'

/**
 * Guards the build-time contract for the single public-origin value (D23-8). The regression this
 * locks down: a staging build silently baked `http://localhost:3000` into every canonical and
 * `og:url` because the old `nuxt.config.ts` fallback could not fail.
 */
describe('resolveSiteUrl', () => {
  const prod = { requirePublicOrigin: true }
  const dev = { requirePublicOrigin: false }

  describe('valid public origins', () => {
    it('accepts a valid HTTPS URL', () => {
      expect(resolveSiteUrl({ value: 'https://eslammuatamed.com', ...prod })).toBe('https://eslammuatamed.com')
    })

    it('strips a trailing slash so callers can concatenate paths safely', () => {
      expect(resolveSiteUrl({ value: 'https://eslammuatamed.com/', ...prod })).toBe('https://eslammuatamed.com')
      expect(resolveSiteUrl({ value: 'https://eslammuatamed.com///', ...prod })).toBe('https://eslammuatamed.com')
    })

    it('trims surrounding whitespace from the env value', () => {
      expect(resolveSiteUrl({ value: '  https://eslammuatamed.com \n', ...prod })).toBe('https://eslammuatamed.com')
    })

    it('preserves a subpath when the site is hosted below the root', () => {
      expect(resolveSiteUrl({ value: 'https://example.com/site/', ...prod })).toBe('https://example.com/site')
    })

    it('accepts the CI placeholder origin (used by the verify job)', () => {
      expect(resolveSiteUrl({ value: 'https://example.com', ...prod })).toBe('https://example.com')
    })
  })

  describe('production-like rejections', () => {
    it('rejects a missing value instead of falling back to localhost', () => {
      expect(() => resolveSiteUrl({ value: undefined, ...prod })).toThrow(/is not set/)
      expect(() => resolveSiteUrl({ value: undefined, ...prod })).toThrow(new RegExp(SITE_URL_ENV))
    })

    it('rejects an empty or whitespace-only value', () => {
      expect(() => resolveSiteUrl({ value: '', ...prod })).toThrow(/is not set/)
      expect(() => resolveSiteUrl({ value: '   ', ...prod })).toThrow(/is not set/)
    })

    it('rejects a malformed URL', () => {
      expect(() => resolveSiteUrl({ value: 'ht!tp://nope', ...prod })).toThrow(/not a valid absolute URL/)
      expect(() => resolveSiteUrl({ value: 'https://', ...prod })).toThrow(/not a valid absolute URL/)
    })

    it.each([
      ['bare hostname', 'eslammuatamed.com'],
      ['root-relative path', '/'],
      ['relative path', '/ar/blog'],
      ['scheme-relative', '//eslammuatamed.com']
    ])('rejects a relative value (%s)', (_label, value) => {
      expect(() => resolveSiteUrl({ value, ...prod })).toThrow(/not a valid absolute URL/)
    })

    it('rejects a non-HTTP protocol', () => {
      expect(() => resolveSiteUrl({ value: 'ftp://eslammuatamed.com', ...prod })).toThrow(/must use http or https/)
      expect(() => resolveSiteUrl({ value: 'file:///tmp/site', ...prod })).toThrow(/must use http or https/)
    })

    it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'http://0.0.0.0:3000', 'https://app.localhost'])(
      'rejects the loopback origin %s in a production-like build',
      (value) => {
        expect(() => resolveSiteUrl({ value, ...prod })).toThrow(/loopback host/)
      }
    )

    it('rejects insecure http for a real public host', () => {
      expect(() => resolveSiteUrl({ value: 'http://eslammuatamed.com', ...prod })).toThrow(/insecure http/)
    })

    it('rejects a query string or fragment', () => {
      expect(() => resolveSiteUrl({ value: 'https://eslammuatamed.com/?x=1', ...prod })).toThrow(/query string or fragment/)
      expect(() => resolveSiteUrl({ value: 'https://eslammuatamed.com/#a', ...prod })).toThrow(/query string or fragment/)
    })

    it('names the variable and gives an actionable example in every failure', () => {
      for (const value of [undefined, '', 'nope', 'http://localhost:3000', 'ftp://x.com']) {
        try {
          resolveSiteUrl({ value, ...prod })
          expect.unreachable(`expected ${String(value)} to throw`)
        } catch (error) {
          const message = (error as Error).message
          expect(message).toContain(SITE_URL_ENV)
          expect(message).toContain('https://eslammuatamed.com')
        }
      }
    })
  })

  describe('development behaviour', () => {
    it('falls back to the intentional localhost default when not production-like', () => {
      expect(resolveSiteUrl({ value: undefined, ...dev })).toBe(DEV_SITE_URL)
      expect(resolveSiteUrl({ value: '', ...dev })).toBe(DEV_SITE_URL)
    })

    it('allows a loopback origin in development', () => {
      expect(resolveSiteUrl({ value: 'http://localhost:4000', ...dev })).toBe('http://localhost:4000')
    })

    it('still rejects a malformed value in development — a typo is never intentional', () => {
      expect(() => resolveSiteUrl({ value: 'eslammuatamed.com', ...dev })).toThrow(/not a valid absolute URL/)
    })
  })

  describe('documented loopback escape hatch', () => {
    it('permits loopback in a production-like build only when explicitly opted in', () => {
      expect(resolveSiteUrl({ value: 'http://localhost:3000', requirePublicOrigin: true, allowLoopback: true }))
        .toBe('http://localhost:3000')
    })
  })

  describe('URL joining — the values the site actually emits', () => {
    // Guards EN/AR canonical construction: i18n appends the locale prefix to this origin, so a
    // trailing slash here would produce `https://eslammuatamed.com//ar`.
    it('produces correct EN and AR canonical URLs by concatenation', () => {
      const base = resolveSiteUrl({ value: 'https://eslammuatamed.com/', ...prod })
      expect(`${base}/`).toBe('https://eslammuatamed.com/')
      expect(`${base}/ar`).toBe('https://eslammuatamed.com/ar')
      expect(`${base}/blog/a-post`).toBe('https://eslammuatamed.com/blog/a-post')
      expect(`${base}/ar/blog/a-post`).toBe('https://eslammuatamed.com/ar/blog/a-post')
      expect(`${base}/sitemap_index.xml`).toBe('https://eslammuatamed.com/sitemap_index.xml')
    })
  })
})

describe('isArtifactBuild', () => {
  const argv = (...cmd: string[]) => ['/usr/bin/node', '/repo/node_modules/.bin/nuxt', ...cmd]

  it.each([['build'], ['generate']])('is true for the artifact-producing command %s', (cmd) => {
    expect(isArtifactBuild(argv(cmd))).toBe(true)
  })

  it('is true when the command carries flags', () => {
    expect(isArtifactBuild(argv('build', '--dotenv', 'ci.env'))).toBe(true)
  })

  it.each([['dev'], ['typecheck'], ['prepare'], ['preview']])('is false for %s', (cmd) => {
    expect(isArtifactBuild(argv(cmd))).toBe(false)
  })

  it('is false for the test runner', () => {
    expect(isArtifactBuild(['/usr/bin/node', '/repo/node_modules/.bin/vitest', 'run'])).toBe(false)
  })

  // Regression: keying strictness on NODE_ENV broke `npm run typecheck` for developers whose
  // gitignored .env points at localhost, because Nuxt runs typecheck with NODE_ENV=production.
  it('ignores a path segment that merely contains the word build', () => {
    expect(isArtifactBuild(['/usr/bin/node', '/home/dev/build-tools/nuxt', 'typecheck'])).toBe(false)
  })
})

describe('siteUrlFromEnv', () => {
  const buildArgv = ['/usr/bin/node', 'nuxt', 'build']
  const typecheckArgv = ['/usr/bin/node', 'nuxt', 'typecheck']

  it('requires a public origin for an artifact build', () => {
    expect(() => siteUrlFromEnv({} as NodeJS.ProcessEnv, buildArgv)).toThrow(/is not set/)
  })

  it('reads and validates the value from the env bag', () => {
    const env = { [SITE_URL_ENV]: 'https://eslammuatamed.com' } as unknown as NodeJS.ProcessEnv
    expect(siteUrlFromEnv(env, buildArgv)).toBe('https://eslammuatamed.com')
  })

  it('rejects a loopback origin for an artifact build', () => {
    const env = { [SITE_URL_ENV]: 'http://localhost:3000' } as unknown as NodeJS.ProcessEnv
    expect(() => siteUrlFromEnv(env, buildArgv)).toThrow(/loopback host/)
  })

  it('keeps the localhost default for non-build commands (dev, typecheck, tests)', () => {
    expect(siteUrlFromEnv({} as NodeJS.ProcessEnv, typecheckArgv)).toBe(DEV_SITE_URL)
    const localEnv = { [SITE_URL_ENV]: 'http://localhost:3000' } as unknown as NodeJS.ProcessEnv
    expect(siteUrlFromEnv(localEnv, typecheckArgv)).toBe('http://localhost:3000')
  })

  it('honours the loopback escape hatch from the env bag', () => {
    const env = {
      [SITE_URL_ENV]: 'http://localhost:3000',
      [ALLOW_LOOPBACK_ENV]: '1'
    } as unknown as NodeJS.ProcessEnv
    expect(siteUrlFromEnv(env, buildArgv)).toBe('http://localhost:3000')
  })
})

import { describe, expect, it } from 'vitest'
import { ApiError } from './api-error'
import { isNotFound, projectErrorParams } from './project-error'

// The case-study page maps a captured useAsyncData error to error-page params. The load-bearing rule is
// the same one the article page enforces: only a genuine 404 becomes a 404, so a transient 5xx or a
// transport failure is never masked as a deindexable "not found" (review MAJOR-1).
describe('projectErrorParams', () => {
  const problem = (status: number) => new ApiError({ type: 'about:blank', title: 'x', status })

  it('maps a genuine 404 to a not-found page', () => {
    expect(projectErrorParams(problem(404))).toEqual({ status: 404, statusText: 'Project not found' })
  })

  it('preserves a 5xx status instead of masking it as 404', () => {
    expect(projectErrorParams(problem(503))).toEqual({ status: 503, statusText: 'Failed to load project' })
  })

  it('maps a transport failure (status 0) to a 500 error page, never a 404', () => {
    expect(projectErrorParams(problem(0))).toEqual({ status: 500, statusText: 'Failed to load project' })
  })

  it('preserves a 400 from an unknown locale rather than reporting not-found', () => {
    expect(projectErrorParams(problem(400))).toEqual({ status: 400, statusText: 'Failed to load project' })
  })

  it('normalizes a Nuxt-wrapped error via its status code', () => {
    expect(projectErrorParams({ statusCode: 500, message: 'boom' })).toEqual({
      status: 500,
      statusText: 'Failed to load project'
    })
  })
})

// `isNotFound` gates redirect resolution. If it were loose, a 5xx would trigger a redirect lookup and
// the outage would surface as a 404; if it were strict-by-identity it would miss ofetch-shaped errors.
describe('isNotFound', () => {
  it('is true only for a genuine 404', () => {
    expect(isNotFound(new ApiError({ type: 'about:blank', title: 'x', status: 404 }))).toBe(true)
  })

  it.each([500, 503, 400, 422, 0])('is false for status %i', (status) => {
    expect(isNotFound(new ApiError({ type: 'about:blank', title: 'x', status }))).toBe(false)
  })

  it('recognizes an ofetch-shaped 404 carrying an RFC 7807 body', () => {
    expect(isNotFound({ response: { status: 404 }, data: { type: '/problems/not-found', title: 'Not Found', status: 404 } })).toBe(true)
  })
})

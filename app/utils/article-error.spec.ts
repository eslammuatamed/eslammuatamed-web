import { describe, expect, it } from 'vitest'
import { ApiError } from './api-error'
import { articleErrorParams } from './article-error'

// The article page maps a captured useAsyncData error to error-page params. The load-bearing rule:
// only a genuine 404 becomes a 404; every other failure keeps its real status so transient 5xx /
// transport errors are NOT masked as a deindexable "not found" (review MAJOR-1).
describe('articleErrorParams', () => {
  const problem = (status: number) => new ApiError({ type: 'about:blank', title: 'x', status })

  it('maps a genuine 404 to a not-found page', () => {
    expect(articleErrorParams(problem(404))).toEqual({ status: 404, statusText: 'Article not found' })
  })

  it('preserves a 5xx status instead of masking it as 404', () => {
    expect(articleErrorParams(problem(503))).toEqual({ status: 503, statusText: 'Failed to load article' })
  })

  it('maps a transport failure (status 0) to a 500 error page, never a 404', () => {
    expect(articleErrorParams(problem(0))).toEqual({ status: 500, statusText: 'Failed to load article' })
  })

  it('normalizes a Nuxt-wrapped error via its status code', () => {
    expect(articleErrorParams({ statusCode: 500, message: 'boom' })).toEqual({
      status: 500,
      statusText: 'Failed to load article'
    })
  })
})

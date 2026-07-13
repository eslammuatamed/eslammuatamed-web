import { describe, expect, it, vi } from 'vitest'
import { ApiError, requestWithRefreshRetry, toApiError } from './api-error'

describe('toApiError', () => {
  it('normalizes an RFC 7807 problem body, exposing field errors', () => {
    const error = toApiError({
      response: { status: 422 },
      data: {
        type: 'https://api.example.com/problems/validation',
        title: 'Validation failed',
        status: 422,
        detail: '1 field failed validation.',
        errors: [{ field: 'email', message: 'Enter a valid email address.' }]
      }
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.message).toBe('Validation failed')
    expect(error.fieldErrorMap()).toEqual({ email: 'Enter a valid email address.' })
  })

  it('synthesizes an ApiError from a bodyless transport failure', () => {
    const error = toApiError({ message: 'Failed to fetch' })

    expect(error.status).toBe(0)
    expect(error.message).toBe('Failed to fetch')
    expect(error.fieldErrors).toEqual([])
  })

  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError({ type: 'about:blank', title: 'Boom', status: 500 })
    expect(toApiError(original)).toBe(original)
  })
})

describe('requestWithRefreshRetry', () => {
  it('replays the request once when a 401 is followed by a successful refresh', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: 'ok' })
    const refresh = vi.fn().mockResolvedValue(true)

    const result = await requestWithRefreshRetry(send, refresh, { retry: true })

    expect(result).toEqual({ data: 'ok' })
    expect(send).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not replay when the refresh fails, throwing a normalized ApiError', async () => {
    const send = vi.fn().mockRejectedValue({
      response: { status: 401 },
      data: { title: 'Unauthorized', status: 401 }
    })
    const refresh = vi.fn().mockResolvedValue(false)

    await expect(requestWithRefreshRetry(send, refresh, { retry: true })).rejects.toBeInstanceOf(
      ApiError
    )
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('never refreshes on a non-401 failure', async () => {
    const send = vi.fn().mockRejectedValue({ response: { status: 500 } })
    const refresh = vi.fn()

    await expect(requestWithRefreshRetry(send, refresh, { retry: true })).rejects.toBeInstanceOf(
      ApiError
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('skips the retry entirely for auth routes (retry disabled)', async () => {
    const send = vi.fn().mockRejectedValue({ response: { status: 401 } })
    const refresh = vi.fn()

    await expect(requestWithRefreshRetry(send, refresh, { retry: false })).rejects.toBeInstanceOf(
      ApiError
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})

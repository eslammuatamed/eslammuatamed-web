import type { FieldError, ProblemDetail } from '~/types/models'

/**
 * The one error shape every API call surfaces (principle 12, doc 06 §6). Constructed from an
 * RFC 7807 problem+json body when the API sends one, or synthesized from a transport failure.
 * Pure and Nuxt-free so it unit-tests without a runtime.
 */
export class ApiError extends Error {
  readonly status: number
  readonly type: string
  readonly detail?: string
  readonly instance?: string
  readonly fieldErrors: readonly FieldError[]
  /**
   * Raw `Retry-After` from a throttled response, when the browser could read it.
   *
   * Carried on the error rather than left in the response because the throttle is only ever
   * observed here. It stays a RAW string: the header is contract-documented as delta-seconds
   * (D10-15) but arrives from the network, so parsing and validating it belongs to the consumer
   * that renders it, not to this shape. `undefined` is a real runtime state, not a defensive
   * branch — before D10-15 added `Retry-After` to the CORS exposed-header allowlist, browser JS
   * read `null` for it on every cross-origin 429.
   */
  readonly retryAfter?: string

  constructor(
    problem: Pick<ProblemDetail, 'title' | 'status' | 'type'> & Partial<ProblemDetail>,
    options: { retryAfter?: string } = {}
  ) {
    super(problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.type = problem.type
    this.detail = problem.detail
    this.instance = problem.instance
    this.fieldErrors = problem.errors ?? []
    this.retryAfter = options.retryAfter
  }

  /** First message per field — maps a 422 onto UForm's field-error shape (doc 11 §4). */
  fieldErrorMap(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const error of this.fieldErrors) {
      if (!(error.field in map)) map[error.field] = error.message
    }
    return map
  }
}

function isProblemDetail(value: unknown): value is ProblemDetail {
  return (
    typeof value === 'object'
    && value !== null
    && 'title' in value
    && 'status' in value
    && typeof (value as { status: unknown }).status === 'number'
  )
}

function statusOf(error: unknown): number {
  if (error instanceof ApiError) return error.status
  const shaped = error as { response?: { status?: number }; statusCode?: number; status?: number }
  return shaped.response?.status ?? shaped.statusCode ?? shaped.status ?? 0
}

export function isUnauthorized(error: unknown): boolean {
  return statusOf(error) === 401
}

/** Normalize any thrown value (ofetch `FetchError`, `ApiError`, or unknown) into `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  const shaped = error as { data?: unknown; message?: string }
  const status = statusOf(error)
  const options = { retryAfter: retryAfterOf(error) }

  if (isProblemDetail(shaped.data)) {
    return new ApiError({ ...shaped.data, status: shaped.data.status || status }, options)
  }

  return new ApiError({
    type: 'about:blank',
    title: shaped.message ?? 'Request failed',
    status
  }, options)
}

/**
 * Reads `Retry-After` off an ofetch `FetchError`'s response.
 *
 * Returns `undefined` when there is no response (a transport failure) or the header is absent —
 * which, on a cross-origin 429, is also what a browser sees whenever the server has not listed the
 * header in `Access-Control-Expose-Headers`.
 */
function retryAfterOf(error: unknown): string | undefined {
  const response = (error as { response?: { headers?: Headers } }).response
  return response?.headers?.get('retry-after') ?? undefined
}

/**
 * Run `send`; on a single 401 attempt `refresh` once and replay (silent-refresh, flow F-D1).
 * Any failure that escapes is normalized to `ApiError`. Split out from `useApi` so the retry
 * decision is testable without a Nuxt context.
 */
export async function requestWithRefreshRetry<T>(
  send: () => Promise<T>,
  refresh: () => Promise<boolean>,
  options: { retry: boolean }
): Promise<T> {
  try {
    return await send()
  } catch (error) {
    if (options.retry && isUnauthorized(error)) {
      const refreshed = await refresh()
      if (refreshed) return send()
    }
    throw toApiError(error)
  }
}

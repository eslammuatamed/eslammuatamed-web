import type { AuthUser, AuthSession, RefreshSession, Envelope, LoginCredentials } from '~/types/models'

/**
 * Session state for the client-only dashboard (doc 11 §1). The access token lives in memory
 * only (D11-1) — never localStorage, never a readable cookie — so XSS can't exfiltrate a
 * credential at rest. The refresh token is an httpOnly cookie the API owns; a reload restores
 * the session via one silent `refresh()` round-trip.
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => accessToken.value !== null)

  function setSession(session: AuthSession): void {
    accessToken.value = session.accessToken
    user.value = session.user
  }

  function clearSession(): void {
    accessToken.value = null
    user.value = null
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    const { data } = await useApi()<Envelope<AuthSession>>('/auth/login', {
      method: 'POST',
      body: credentials
    })
    setSession(data)
  }

  /** Silent refresh (flow F-D1). The contract's refresh response rotates the access token only and
   *  carries no user (unlike login), so we set just the token and leave any existing `user` intact.
   *  Resolves to whether a session is now active — never throws. */
  async function refresh(): Promise<boolean> {
    try {
      const { data } = await useApi()<Envelope<RefreshSession>>('/auth/refresh', { method: 'POST' })
      accessToken.value = data.accessToken
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await useApi()('/auth/logout', { method: 'POST' })
    } finally {
      clearSession()
    }
  }

  return { accessToken, user, isAuthenticated, login, refresh, logout }
})

// Dashboard route guard, attached per-page via definePageMeta (doc 06 §7) — never global, so no
// dashboard logic leaks onto public routes. Client-side guards are UX; the API is the real
// authorizer (D11-2). On first entry with no in-memory token, try one silent refresh (D11-1).
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    await auth.refresh()
  }

  if (!auth.isAuthenticated) {
    return navigateTo('/dashboard/login')
  }
})

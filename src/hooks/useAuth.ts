import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

/** Subscribes the app to Firebase auth state once, on mount. */
export function useAuthInit() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])
}

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  return { user, loading }
}

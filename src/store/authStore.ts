import { create } from 'zustand'
import type { AppUser } from '@/types/user'
import { subscribeToAuth } from '@/services/authService'

interface AuthState {
  user: AppUser | null
  loading: boolean
  initialized: boolean
  setUser: (user: AppUser | null) => void
  init: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  init: () => {
    set({ initialized: true })
    const unsub = subscribeToAuth((user) => {
      set({ user, loading: false })
    })
    return unsub
  },
}))

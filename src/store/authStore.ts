import { create } from 'zustand'
import type { AppUser } from '@/types/user'
import { subscribeToAuth, ensureUserProfile } from '@/services/authService'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface AuthState {
  user: AppUser | null
  loading: boolean
  initialized: boolean
  setUser: (user: AppUser | null) => void
  init: () => () => void
}

export const useAuthStore = create<AuthState>((set) => {
  let docUnsub: (() => void) | null = null

  return {
    user: null,
    loading: true,
    initialized: false,
    setUser: (user) => set({ user }),
    init: () => {
      set({ initialized: true })
      
      const authUnsub = subscribeToAuth(async (authUser) => {
        if (docUnsub) {
          docUnsub()
          docUnsub = null
        }

        if (!authUser) {
          set({ user: null, loading: false })
          return
        }

        try {
          await ensureUserProfile(authUser.uid, authUser.email, authUser.displayName)
          
          if (db) {
            docUnsub = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
              if (docSnap.exists()) {
                const profile = docSnap.data()
                set({
                  user: {
                    ...authUser,
                    role: profile.role || 'user',
                    status: profile.status || 'pending',
                    displayName: profile.displayName || authUser.displayName,
                  },
                  loading: false,
                })
              } else {
                set({
                  user: {
                    ...authUser,
                    role: 'user',
                    status: 'pending',
                  },
                  loading: false,
                })
              }
            }, (error) => {
              console.error('Error listening to user profile:', error)
              set({ user: authUser, loading: false })
            })
          } else {
            set({ user: authUser, loading: false })
          }
        } catch (err) {
          console.error('Error ensuring user profile:', err)
          set({ user: authUser, loading: false })
        }
      })

      return () => {
        authUnsub()
        if (docUnsub) {
          docUnsub()
        }
      }
    },
  }
})

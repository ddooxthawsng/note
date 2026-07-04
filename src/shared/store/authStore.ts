import { create } from 'zustand'
import type { AppUser } from '@/shared/types/user'
import { subscribeToAuth, ensureUserProfile } from '@/shared/services/authService'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'

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
          localStorage.removeItem('gemini_api_key')
          set({ user: null, loading: false })
          return
        }

        try {
          await ensureUserProfile(authUser.uid, authUser.email, authUser.displayName)
          
          if (db) {
            docUnsub = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
              if (docSnap.exists()) {
                const profile = docSnap.data()
                if (profile.geminiApiKey) {
                  localStorage.setItem('gemini_api_key', profile.geminiApiKey)
                } else {
                  localStorage.removeItem('gemini_api_key')
                }
                set({
                  user: {
                    ...authUser,
                    role: profile.role || 'user',
                    status: profile.status || 'pending',
                    displayName: profile.displayName || authUser.displayName,
                    geminiApiKey: profile.geminiApiKey || null,
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

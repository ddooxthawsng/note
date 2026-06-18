import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import type { AppUser } from '@/types/user'

function requireAuth() {
  if (!auth) throw new Error('Firebase not configured. Fill .env.local first.')
  return auth
}

export function mapUser(u: User | null): AppUser | null {
  if (!u) return null
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  }
}

export async function signUp(email: string, password: string, displayName: string) {
  const a = requireAuth()
  const cred = await createUserWithEmailAndPassword(a, email, password)
  if (displayName) await updateProfile(cred.user, { displayName })
  return mapUser(cred.user)
}

export async function signIn(email: string, password: string) {
  const a = requireAuth()
  const cred = await signInWithEmailAndPassword(a, email, password)
  return mapUser(cred.user)
}

export async function signInWithGoogle() {
  const a = requireAuth()
  const cred = await signInWithPopup(a, new GoogleAuthProvider())
  return mapUser(cred.user)
}

export async function logOut() {
  await signOut(requireAuth())
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(requireAuth(), email)
}

export async function updateDisplayName(displayName: string) {
  const a = requireAuth()
  if (!a.currentUser) throw new Error('Not signed in')
  await updateProfile(a.currentUser, { displayName })
  return mapUser(a.currentUser)
}

export function subscribeToAuth(cb: (user: AppUser | null) => void) {
  if (!auth) {
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(auth, (u) => cb(mapUser(u)))
}

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
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
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

export async function ensureUserProfile(uid: string, email: string | null, displayName: string | null) {
  if (!db) return
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)

  if (!userSnap.exists()) {
    // Check if this is the first user in the collection
    const usersColl = collection(db, 'users')
    const q = query(usersColl, limit(1))
    const snap = await getDocs(q)
    const isEmpty = snap.empty

    const role = isEmpty ? 'admin' : 'user'
    const status = isEmpty ? 'approved' : 'pending'

    await setDoc(userRef, {
      uid,
      email,
      displayName: displayName || email?.split('@')[0] || 'User',
      role,
      status,
      createdAt: Date.now(),
    })
  }
}

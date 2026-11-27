import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { auth, db } from '@/shared/lib/firebase'
import type { AppUser } from '@/shared/types/user'

export const PRIMARY_ADMIN_EMAIL = 'ddooxthawsng@gmail.com'

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
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  if (Capacitor.isNativePlatform()) {
    await signInWithRedirect(a, provider)
    return null
  }
  const cred = await signInWithPopup(a, provider)
  return mapUser(cred.user)
}

export async function consumeRedirectResult() {
  if (!auth) return null
  try {
    const res = await getRedirectResult(auth)
    return res ? mapUser(res.user) : null
  } catch (err) {
    console.error('Redirect sign-in error:', err)
    return null
  }
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
  if (db) {
    await setDoc(doc(db, 'users', a.currentUser.uid), { displayName, updatedAt: Date.now() }, { merge: true })
  }
  return mapUser(a.currentUser)
}

export async function updateGeminiApiKey(geminiApiKey: string) {
  const a = requireAuth()
  if (!a.currentUser) throw new Error('Not signed in')
  if (!db) throw new Error('Firebase not configured. Fill .env.local first.')
  await setDoc(
    doc(db, 'users', a.currentUser.uid),
    { geminiApiKey: geminiApiKey || null, updatedAt: Date.now() },
    { merge: true },
  )
}

export async function saveSharedGeminiConfig(geminiApiKey: string, updatedBy?: string | null) {
  const cleanKey = geminiApiKey.trim()
  if (cleanKey) localStorage.setItem('gemini_api_key', cleanKey)
  else localStorage.removeItem('gemini_api_key')
  if (!db) return
  await setDoc(
    doc(db, 'appConfig', 'gemini'),
    {
      apiKey: cleanKey || null,
      updatedBy: updatedBy ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export function subscribeToSharedGeminiConfig(cb?: (apiKey: string) => void) {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'appConfig', 'gemini'),
    (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as { apiKey?: string | null }
      const key = typeof data.apiKey === 'string' ? data.apiKey : ''
      if (key) localStorage.setItem('gemini_api_key', key)
      else localStorage.removeItem('gemini_api_key')
      cb?.(key)
    },
    () => {
      // Ignore permission errors before approval
    },
  )
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
  const isPrimaryAdmin = email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL

  if (!userSnap.exists()) {
    const role = isPrimaryAdmin ? 'admin' : 'user'
    const status = isPrimaryAdmin ? 'approved' : 'pending'

    await setDoc(userRef, {
      uid,
      email: email?.trim().toLowerCase() ?? null,
      displayName: displayName || email?.split('@')[0] || 'User',
      role,
      status,
      createdAt: Date.now(),
    })
  } else if (isPrimaryAdmin) {
    const data = userSnap.data()
    if (data.role !== 'admin' || data.status !== 'approved') {
      await setDoc(userRef, { role: 'admin', status: 'approved', updatedAt: Date.now() }, { merge: true })
    }
  }
}

export interface ApprovedUser {
  uid: string
  email: string
  displayName: string
  role: 'admin' | 'user'
}

export function subscribeToApprovedUsers(cb: (users: ApprovedUser[]) => void) {
  if (!db) {
    cb([])
    return () => {}
  }
  const q = query(collection(db, 'users'), where('status', '==', 'approved'))
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data() as { email?: string; displayName?: string; role?: 'admin' | 'user' }
          if (!data.email) return null
          return {
            uid: d.id,
            email: data.email.trim().toLowerCase(),
            displayName: data.displayName || data.email.split('@')[0] || 'User',
            role: data.role || 'user',
          } satisfies ApprovedUser
        })
        .filter((u): u is ApprovedUser => Boolean(u))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
      cb(list)
    },
    () => cb([]),
  )
}

export function getAuthProviderInfo() {
  const current = auth?.currentUser
  if (!current) return { hasPassword: false, hasGoogle: false, email: null as string | null }
  const providers = current.providerData.map((p) => p.providerId)
  return {
    hasPassword: providers.includes('password'),
    hasGoogle: providers.includes('google.com'),
    email: current.email,
  }
}

export async function linkEmailPassword(password: string) {
  const a = requireAuth()
  const current = a.currentUser
  if (!current || !current.email) throw new Error('No signed-in account with an email address.')
  const cred = EmailAuthProvider.credential(current.email, password)
  await linkWithCredential(current, cred)
}

export async function changeEmailPassword(currentPassword: string, newPassword: string) {
  const a = requireAuth()
  const current = a.currentUser
  if (!current || !current.email) throw new Error('No signed-in account with an email address.')
  const cred = EmailAuthProvider.credential(current.email, currentPassword)
  await reauthenticateWithCredential(current, cred)
  await updatePassword(current, newPassword)
}

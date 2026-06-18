export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export interface UserProfile {
  email: string
  displayName: string
  photoURL: string
  bio: string
  theme: 'light' | 'dark'
  language: string
  createdAt: number | null
  updatedAt: number | null
}

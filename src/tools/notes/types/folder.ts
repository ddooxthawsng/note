import type { Timestamp } from 'firebase/firestore'

/** Shape of a folder stored in Firestore. */
export interface FolderDoc {
  userId: string
  ownerEmail?: string | null
  name: string
  parentId: string | null
  order?: number | null
  sharedWith?: string[]
  createdAt: Timestamp | null
}

/** Client-side Folder with normalized timestamps. */
export interface Folder extends Omit<FolderDoc, 'createdAt'> {
  id: string
  createdAt: number | null
  order: number | null
  sharedWith?: string[]
  ownerEmail?: string | null
}

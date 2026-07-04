import type { Timestamp } from 'firebase/firestore'

/** Shape of a folder stored in Firestore. */
export interface FolderDoc {
  userId: string
  name: string
  createdAt: Timestamp | null
}

/** Client-side Folder with normalized timestamps. */
export interface Folder extends Omit<FolderDoc, 'createdAt'> {
  id: string
  createdAt: number | null
}

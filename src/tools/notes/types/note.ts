import type { Timestamp } from 'firebase/firestore'

export type NoteType = 'note' | 'list' | 'table' | 'sketch'

export interface NoteHistoryEntry {
  title: string
  content: string
  folderId: string | null
  tags: string[]
  type: NoteType
  wordCount: number
  color: string | null
  isShared?: boolean
  updatedAt: number | null
  savedAt: number
}

/** Firestore document shape (timestamps are Firestore Timestamps). */
export interface NoteDoc {
  userId: string
  title: string
  content: string // Tiptap HTML
  folderId: string | null
  tags: string[]
  isPinned: boolean
  isFavorite: boolean
  type: NoteType
  wordCount: number
  color: string | null
  isDeleted: boolean
  isShared?: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  deletedAt: Timestamp | null
  order?: number | null
  history?: NoteHistoryEntry[]
}

/** App-side note (id attached, timestamps normalized to millis). */
export interface Note extends Omit<NoteDoc, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id: string
  createdAt: number | null
  updatedAt: number | null
  deletedAt: number | null
  order?: number | null
  isShared?: boolean
}

export type NewNoteInput = Partial<
  Pick<NoteDoc, 'title' | 'content' | 'folderId' | 'tags' | 'type' | 'color'>
>

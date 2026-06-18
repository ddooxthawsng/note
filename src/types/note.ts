import type { Timestamp } from 'firebase/firestore'

export type NoteType = 'note' | 'list' | 'table' | 'sketch'

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
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  deletedAt: Timestamp | null
  order?: number | null
}

/** App-side note (id attached, timestamps normalized to millis). */
export interface Note extends Omit<NoteDoc, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id: string
  createdAt: number | null
  updatedAt: number | null
  deletedAt: number | null
  order?: number | null
}

export type NewNoteInput = Partial<
  Pick<NoteDoc, 'title' | 'content' | 'folderId' | 'tags' | 'type' | 'color'>
>

import type { Timestamp } from 'firebase/firestore'
import type { TelegramManifest } from '@/tools/telegram/telegramCore'

export type NoteType = 'note' | 'list' | 'table' | 'sketch'

export interface NoteAttachment {
  id: string
  manifest: TelegramManifest
}

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
  sharedWith?: string[]
  lastEditedBy?: string | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  deletedAt: Timestamp | null
  order?: number | null
  history?: NoteHistoryEntry[]
  attachments?: NoteAttachment[]
}

/** App-side note (id attached, timestamps normalized to millis). */
export interface Note extends Omit<NoteDoc, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  id: string
  createdAt: number | null
  updatedAt: number | null
  deletedAt: number | null
  order?: number | null
  isShared?: boolean
  sharedWith?: string[]
  lastEditedBy?: string | null
}

export type NewNoteInput = Partial<
  Pick<NoteDoc, 'title' | 'content' | 'folderId' | 'tags' | 'type' | 'color' | 'attachments'>
>

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Note, NoteDoc, NewNoteInput } from '@/types/note'

const COLLECTION = 'notes'

function requireDb() {
  if (!db) throw new Error('Firebase not configured. Fill .env.local first.')
  return db
}

function toMillis(t: unknown): number | null {
  return t instanceof Timestamp ? t.toMillis() : null
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): Note {
  const d = snap.data() as NoteDoc
  return {
    id: snap.id,
    userId: d.userId,
    title: d.title ?? '',
    content: d.content ?? '',
    folderId: d.folderId ?? null,
    tags: d.tags ?? [],
    isPinned: d.isPinned ?? false,
    isFavorite: d.isFavorite ?? false,
    type: d.type ?? 'note',
    wordCount: d.wordCount ?? 0,
    color: d.color ?? null,
    isDeleted: d.isDeleted ?? false,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
    deletedAt: toMillis(d.deletedAt),
  }
}

export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

/** Live subscription to a user's non-deleted notes, newest first. */
export function subscribeToNotes(
  userId: string,
  cb: (notes: Note[]) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  const q = query(
    collection(database, COLLECTION),
    where('userId', '==', userId),
    where('isDeleted', '==', false),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromSnapshot)),
    (err) => onError?.(err),
  )
}

export async function createNote(userId: string, input: NewNoteInput = {}) {
  const database = requireDb()
  const content = input.content ?? ''
  const payload = {
    userId,
    title: input.title ?? 'Untitled Note',
    content,
    folderId: input.folderId ?? null,
    tags: input.tags ?? [],
    isPinned: false,
    isFavorite: false,
    type: input.type ?? 'note',
    wordCount: countWords(content),
    color: input.color ?? null,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  }
  const ref = await addDoc(collection(database, COLLECTION), payload)
  return ref.id
}

export async function getNote(noteId: string): Promise<Note | null> {
  const database = requireDb()
  const snap = await getDoc(doc(database, COLLECTION, noteId))
  if (!snap.exists()) return null
  return fromSnapshot(snap as QueryDocumentSnapshot<DocumentData>)
}

export async function updateNote(noteId: string, patch: Partial<NoteDoc>) {
  const database = requireDb()
  const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() }
  if (typeof patch.content === 'string') data.wordCount = countWords(patch.content)
  await updateDoc(doc(database, COLLECTION, noteId), data)
}

/** Soft delete: move to trash (recoverable). */
export async function softDeleteNote(noteId: string) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, noteId), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function togglePin(noteId: string, isPinned: boolean) {
  await updateNote(noteId, { isPinned })
}

export async function toggleFavorite(noteId: string, isFavorite: boolean) {
  await updateNote(noteId, { isFavorite })
}

/** Live subscription to a user's trashed notes, most recently deleted first. */
export function subscribeToTrash(
  userId: string,
  cb: (notes: Note[]) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  const q = query(
    collection(database, COLLECTION),
    where('userId', '==', userId),
    where('isDeleted', '==', true),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromSnapshot)),
    (err) => onError?.(err),
  )
}

/** Restore a soft-deleted note back to the active list. */
export async function restoreNote(noteId: string) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, noteId), {
    isDeleted: false,
    deletedAt: null,
    updatedAt: serverTimestamp(),
  })
}

/** Permanently remove a note document. Irreversible. */
export async function permanentDeleteNote(noteId: string) {
  const database = requireDb()
  await deleteDoc(doc(database, COLLECTION, noteId))
}

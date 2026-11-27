import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'
import type { Note, NoteDoc, NewNoteInput, NoteHistoryEntry } from '@/tools/notes/types/note'

const COLLECTION = 'notes'
// ponytail: inline history; move to subcollection if Firestore 1MiB doc limit bites.
const MAX_HISTORY = 30
const HISTORY_FIELDS = ['title', 'content', 'type'] as const

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
    isShared: d.isShared ?? false,
    sharedWith: d.sharedWith ?? [],
    lastEditedBy: d.lastEditedBy ?? null,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
    deletedAt: toMillis(d.deletedAt),
    order: d.order ?? null,
    history: d.history ?? [],
    attachments: d.attachments ?? [],
  }
}

function sameValue(a: unknown, b: unknown) {
  return Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a ?? []) === JSON.stringify(b ?? []) : a === b
}

function shouldSaveHistory(current: NoteDoc, patch: Partial<NoteDoc>) {
  return HISTORY_FIELDS.some((key) => key in patch && !sameValue(patch[key], current[key]))
}

function historyEntry(d: NoteDoc): NoteHistoryEntry {
  return {
    title: d.title ?? '',
    content: d.content ?? '',
    folderId: d.folderId ?? null,
    tags: d.tags ?? [],
    type: d.type ?? 'note',
    wordCount: d.wordCount ?? countWords(d.content ?? ''),
    color: d.color ?? null,
    isShared: d.isShared ?? false,
    updatedAt: toMillis(d.updatedAt),
    savedAt: Date.now(),
  }
}

export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

/** Live subscription to a user's own non-deleted notes + notes shared with them. */
export function subscribeToNotes(
  userId: string,
  userEmail: string | null | undefined,
  cb: (notes: Note[]) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  let ownNotes: Note[] = []
  let sharedNotes: Note[] = []

  const emit = () => {
    const merged = new Map<string, Note>()
    for (const n of ownNotes) merged.set(n.id, n)
    for (const n of sharedNotes) merged.set(n.id, n)
    cb(Array.from(merged.values()))
  }

  const ownQuery = query(
    collection(database, COLLECTION),
    where('userId', '==', userId),
    where('isDeleted', '==', false),
  )
  const unsubOwn = onSnapshot(
    ownQuery,
    (snap) => {
      ownNotes = snap.docs.map(fromSnapshot)
      emit()
    },
    (err) => onError?.(err),
  )

  const normalizedEmail = userEmail?.trim().toLowerCase()
  if (!normalizedEmail) {
    return unsubOwn
  }

  const sharedQuery = query(
    collection(database, COLLECTION),
    where('sharedWith', 'array-contains', normalizedEmail),
    where('isDeleted', '==', false),
  )
  const unsubShared = onSnapshot(
    sharedQuery,
    (snap) => {
      sharedNotes = snap.docs.map(fromSnapshot)
      emit()
    },
    (err) => onError?.(err),
  )

  return () => {
    unsubOwn()
    unsubShared()
  }
}

/** Live subscription to a single note for real-time collaborative editing. */
export function subscribeToNote(
  noteId: string,
  cb: (note: Note | null) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  return onSnapshot(
    doc(database, COLLECTION, noteId),
    (snap) => {
      if (!snap.exists()) {
        cb(null)
        return
      }
      cb(fromSnapshot(snap as QueryDocumentSnapshot<DocumentData>))
    },
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
    isShared: false,
    sharedWith: [],
    lastEditedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
    order: Date.now(),
    history: [],
    attachments: input.attachments ?? [],
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
  const ref = doc(database, COLLECTION, noteId)
  const data: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() }
  if (typeof patch.content === 'string') data.wordCount = countWords(patch.content)
  if (!HISTORY_FIELDS.some((key) => key in patch)) {
    await updateDoc(ref, data)
    return
  }
  await runTransaction(database, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Note not found')
    const current = snap.data() as NoteDoc
    if (shouldSaveHistory(current, patch)) {
      data.history = [historyEntry(current), ...(current.history ?? [])].slice(0, MAX_HISTORY)
    }
    tx.update(ref, data)
  })
}

export async function saveNotesOrder(
  positions: Array<{ id: string; order: number; isPinned: boolean }>,
) {
  const database = requireDb()
  // ponytail: one batch is enough for the current UI; split if a view can exceed 500 notes.
  const batch = writeBatch(database)
  positions.forEach(({ id, order, isPinned }) => {
    batch.update(doc(database, COLLECTION, id), { order, isPinned })
  })
  await batch.commit()
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
  const noteRef = doc(database, COLLECTION, noteId)
  const snap = await getDoc(noteRef)
  const batch = writeBatch(database)
  batch.delete(noteRef)
  if (snap.exists()) {
    const attachments = (snap.data() as NoteDoc).attachments ?? []
    attachments.forEach((attachment) => batch.delete(doc(database, 'telegramFiles', attachment.id)))
  }
  await batch.commit()
}

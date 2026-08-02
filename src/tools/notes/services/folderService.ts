import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'
import type { Folder, FolderDoc } from '@/tools/notes/types/folder'

const COLLECTION = 'folders'

function requireDb() {
  if (!db) throw new Error('Firebase not configured. Fill .env.local first.')
  return db
}

function toMillis(t: unknown): number | null {
  return t instanceof Timestamp ? t.toMillis() : null
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): Folder {
  const d = snap.data() as FolderDoc
  return {
    id: snap.id,
    userId: d.userId,
    name: d.name ?? '',
    parentId: d.parentId ?? null,
    order: d.order ?? null,
    createdAt: toMillis(d.createdAt),
  }
}

/** Live subscription to a user's folders. */
export function subscribeToFolders(
  userId: string,
  cb: (folders: Folder[]) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COLLECTION), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromSnapshot).sort((a, b) =>
      (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0) || a.name.localeCompare(b.name),
    )),
    (err) => onError?.(err),
  )
}

export async function createFolder(userId: string, name: string, parentId: string | null = null) {
  const database = requireDb()
  const payload = {
    userId,
    name,
    parentId,
    order: Date.now(),
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(database, COLLECTION), payload)
  return { id: ref.id, userId, name, parentId, order: payload.order, createdAt: Date.now() }
}

export async function updateFolderPosition(folderId: string, parentId: string | null, order: number) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, folderId), { parentId, order })
}

export async function updateFolder(folderId: string, name: string) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, folderId), { name })
}

export async function deleteFolder(folderId: string) {
  const database = requireDb()
  await deleteDoc(doc(database, COLLECTION, folderId))
}

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
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
    ownerEmail: d.ownerEmail ?? null,
    name: d.name ?? '',
    parentId: d.parentId ?? null,
    order: d.order ?? null,
    sharedWith: d.sharedWith ?? [],
    createdAt: toMillis(d.createdAt),
  }
}

function sortFolders(list: Folder[]) {
  return [...list].sort(
    (a, b) => (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0) || a.name.localeCompare(b.name),
  )
}

/** Live subscription to a user's own folders + folders shared with them. */
export function subscribeToFolders(
  userId: string,
  userEmail: string | null | undefined,
  cb: (folders: Folder[]) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  let ownFolders: Folder[] = []
  let sharedFolders: Folder[] = []

  const emit = () => {
    const merged = new Map<string, Folder>()
    for (const f of ownFolders) merged.set(f.id, f)
    for (const f of sharedFolders) merged.set(f.id, f)
    cb(sortFolders(Array.from(merged.values())))
  }

  const ownQuery = query(collection(database, COLLECTION), where('userId', '==', userId))
  const unsubOwn = onSnapshot(
    ownQuery,
    (snap) => {
      ownFolders = snap.docs.map(fromSnapshot)
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
  )
  const unsubShared = onSnapshot(
    sharedQuery,
    (snap) => {
      sharedFolders = snap.docs.map(fromSnapshot)
      emit()
    },
    (err) => onError?.(err),
  )

  return () => {
    unsubOwn()
    unsubShared()
  }
}

export async function createFolder(
  userId: string,
  name: string,
  parentId: string | null = null,
  ownerEmail: string | null = null,
) {
  const database = requireDb()
  const payload = {
    userId,
    ownerEmail: ownerEmail?.trim().toLowerCase() ?? null,
    name,
    parentId,
    order: Date.now(),
    sharedWith: [] as string[],
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(database, COLLECTION), payload)
  return {
    id: ref.id,
    userId,
    ownerEmail: payload.ownerEmail,
    name,
    parentId,
    order: payload.order,
    sharedWith: [],
    createdAt: Date.now(),
  }
}

export async function updateFolderPosition(folderId: string, parentId: string | null, order: number) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, folderId), { parentId, order })
}

export async function updateFolder(folderId: string, name: string) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, folderId), { name })
}

/** Update folder collaborators and sync sharedWith onto all notes inside that folder. */
export async function updateFolderShare(
  folderId: string,
  sharedWith: string[],
  ownerEmail?: string | null,
) {
  const database = requireDb()
  const cleanEmails = Array.from(new Set(sharedWith.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  const folderPatch: Record<string, unknown> = { sharedWith: cleanEmails }
  if (ownerEmail !== undefined) {
    folderPatch.ownerEmail = ownerEmail?.trim().toLowerCase() ?? null
  }
  await updateDoc(doc(database, COLLECTION, folderId), folderPatch)

  // Sync sharedWith on notes inside this folder owned by current user
  const notesSnap = await getDocs(query(collection(database, 'notes'), where('folderId', '==', folderId)))
  if (!notesSnap.empty) {
    const batch = writeBatch(database)
    notesSnap.docs.forEach((d) => {
      batch.update(d.ref, { sharedWith: cleanEmails })
    })
    await batch.commit()
  }
}

export async function deleteFolder(folderId: string) {
  const database = requireDb()
  await deleteDoc(doc(database, COLLECTION, folderId))
}

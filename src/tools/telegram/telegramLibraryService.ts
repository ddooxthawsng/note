import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'
import { rustSha256Hex } from '@/shared/wasm/rustCore'
import { parseManifest, type TelegramManifest } from '@/tools/telegram/telegramCore'

const COLLECTION = 'telegramFiles'

export interface TelegramLibraryItem {
  id: string
  manifest: TelegramManifest
  savedAt: number | null
  source: { type: 'drive' | 'note'; noteId?: string }
  folderId: string | null
}

export interface TelegramFolderItem {
  id: string
  name: string
  parentId: string | null
  createdAt: number | null
}

function requireDb() {
  if (!db) throw new Error('Firebase not configured. Fill .env.local first.')
  return db
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): TelegramLibraryItem {
  const data = snap.data() as { manifest: TelegramManifest; savedAt?: unknown; source?: TelegramLibraryItem['source']; folderId?: string | null }
  return {
    id: snap.id,
    manifest: parseManifest(JSON.stringify(data.manifest)),
    savedAt: data.savedAt instanceof Timestamp ? data.savedAt.toMillis() : null,
    source: data.source ?? { type: 'drive' },
    folderId: data.folderId ?? null,
  }
}

export function subscribeToTelegramFiles(
  userId: string,
  cb: (items: TelegramLibraryItem[]) => void,
  onError?: (error: Error) => void,
) {
  const database = requireDb()
  const q = query(collection(database, COLLECTION), where('userId', '==', userId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromSnapshot)),
    (error) => onError?.(error),
  )
}

export async function saveTelegramFile(
  userId: string,
  manifest: TelegramManifest,
  source?: { type: 'drive' | 'note'; noteId?: string },
  folderId: string | null = null,
) {
  const database = requireDb()
  const id = await telegramFileId(userId, manifest)
  const cleanManifest = JSON.parse(JSON.stringify(manifest)) as TelegramManifest
  await setDoc(doc(database, COLLECTION, id), {
    userId,
    manifest: cleanManifest,
    source: source ?? { type: 'drive' },
    folderId,
    savedAt: serverTimestamp(),
  })
  return id
}

export async function deleteTelegramFile(id: string) {
  await deleteDoc(doc(requireDb(), COLLECTION, id))
}

export async function moveTelegramFile(id: string, folderId: string | null) {
  await updateDoc(doc(requireDb(), COLLECTION, id), { folderId })
}

const FOLDER_COLLECTION = 'telegramFolders'

export function subscribeToTelegramFolders(
  userId: string,
  cb: (items: TelegramFolderItem[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(requireDb(), FOLDER_COLLECTION), where('userId', '==', userId))
  return onSnapshot(q, (snap) => cb(snap.docs.map((item) => {
    const data = item.data() as { name?: string; parentId?: string | null; createdAt?: unknown }
    return {
      id: item.id,
      name: data.name?.trim() || 'Untitled folder',
      parentId: data.parentId ?? null,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))), (error) => onError?.(error))
}

export async function createTelegramFolder(userId: string, name: string, parentId: string | null) {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Folder name required.')
  const ref = await addDoc(collection(requireDb(), FOLDER_COLLECTION), {
    userId,
    name: cleanName,
    parentId,
    createdAt: serverTimestamp(),
  })
  return { id: ref.id, name: cleanName, parentId, createdAt: Date.now() } satisfies TelegramFolderItem
}

export async function renameTelegramFolder(id: string, name: string) {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Folder name required.')
  await updateDoc(doc(requireDb(), FOLDER_COLLECTION, id), { name: cleanName })
}

export async function deleteTelegramFolder(id: string) {
  await deleteDoc(doc(requireDb(), FOLDER_COLLECTION, id))
}

export async function telegramFileId(userId: string, manifest: TelegramManifest) {
  const identity = JSON.stringify([
    userId,
    manifest.fileName,
    manifest.size,
    manifest.parts.map((part) => part.fileId),
  ])
  const wasmHash = rustSha256Hex(identity)
  if (wasmHash !== null) return wasmHash
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

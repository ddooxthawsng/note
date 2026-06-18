import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Task, TaskDoc, NewTaskInput } from '@/types/task'

const COLLECTION = 'tasks'

function requireDb() {
  if (!db) throw new Error('Firebase not configured. Fill .env.local first.')
  return db
}

function toMillis(t: unknown): number | null {
  return t instanceof Timestamp ? t.toMillis() : null
}

function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): Task {
  const d = snap.data() as TaskDoc
  return {
    id: snap.id,
    userId: d.userId,
    title: d.title ?? '',
    isCompleted: d.isCompleted ?? false,
    dueDate: d.dueDate ?? null,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  }
}

/** Live subscription to a user's tasks, newest first. */
export function subscribeToTasks(
  userId: string,
  cb: (tasks: Task[]) => void,
  onError?: (err: Error) => void,
) {
  const database = requireDb()
  const q = query(
    collection(database, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromSnapshot)),
    (err) => onError?.(err),
  )
}

export async function createTask(userId: string, input: NewTaskInput) {
  const database = requireDb()
  const payload = {
    userId,
    title: input.title,
    isCompleted: false,
    dueDate: input.dueDate ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(database, COLLECTION), payload)
  return ref.id
}

export async function toggleTaskCompletion(taskId: string, isCompleted: boolean) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, taskId), {
    isCompleted,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTask(taskId: string) {
  const database = requireDb()
  await deleteDoc(doc(database, COLLECTION, taskId))
}

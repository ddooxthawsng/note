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
import { db } from '@/shared/lib/firebase'
import type { Task, TaskDoc, NewTaskInput } from '@/tools/notes/tasks/types/task'

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
    priority: d.priority ?? 'medium',
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
    priority: input.priority ?? 'medium',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(database, COLLECTION), payload)
  return ref.id
}

export async function updateTask(
  taskId: string,
  patch: Partial<Pick<TaskDoc, 'title' | 'dueDate' | 'priority' | 'isCompleted'>>,
) {
  const database = requireDb()
  await updateDoc(doc(database, COLLECTION, taskId), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function toggleTaskCompletion(taskId: string, isCompleted: boolean) {
  await updateTask(taskId, { isCompleted })
}

export async function deleteTask(taskId: string) {
  const database = requireDb()
  await deleteDoc(doc(database, COLLECTION, taskId))
}

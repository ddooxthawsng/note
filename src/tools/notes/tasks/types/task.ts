import type { Timestamp } from 'firebase/firestore'

/** Shape of a task stored in Firestore. */
export interface TaskDoc {
  userId: string
  title: string
  isCompleted: boolean
  dueDate: string | null // ISO Date string (YYYY-MM-DD) or null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** Client-side Task with normalized timestamps. */
export interface Task extends Omit<TaskDoc, 'createdAt' | 'updatedAt'> {
  id: string
  createdAt: number | null
  updatedAt: number | null
}

export type NewTaskInput = Pick<TaskDoc, 'title'> & Partial<Pick<TaskDoc, 'dueDate'>>

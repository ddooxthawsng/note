import type { Timestamp } from 'firebase/firestore'

export type TaskPriority = 'low' | 'medium' | 'high'

/** Shape of a task stored in Firestore. */
export interface TaskDoc {
  userId: string
  title: string
  isCompleted: boolean
  dueDate: string | null // ISO Date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm) or null
  priority?: TaskPriority
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** Client-side Task with normalized timestamps. */
export interface Task extends Omit<TaskDoc, 'createdAt' | 'updatedAt'> {
  id: string
  createdAt: number | null
  updatedAt: number | null
}

export type NewTaskInput = Pick<TaskDoc, 'title'> & Partial<Pick<TaskDoc, 'dueDate' | 'priority'>>

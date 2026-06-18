import { create } from 'zustand'
import type { Task } from '@/types/task'
import { subscribeToTasks } from '@/services/taskService'

export type TaskFilter = 'all' | 'active' | 'completed'

interface TaskState {
  tasks: Task[]
  loading: boolean
  error: string | null
  filter: TaskFilter
  unsub: (() => void) | null
  setFilter: (filter: TaskFilter) => void
  subscribe: (userId: string) => void
  unsubscribe: () => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: true,
  error: null,
  filter: 'all',
  unsub: null,
  setFilter: (filter) => set({ filter }),
  subscribe: (userId) => {
    get().unsub?.()
    set({ loading: true, error: null })
    const unsub = subscribeToTasks(
      userId,
      (tasks) => set({ tasks, loading: false }),
      (err) => set({ error: err.message, loading: false }),
    )
    set({ unsub })
  },
  unsubscribe: () => {
    get().unsub?.()
    set({ unsub: null, tasks: [], loading: true })
  },
}))

/** Selector to get filtered tasks. */
export function selectFilteredTasks(state: TaskState): Task[] {
  const { tasks, filter } = state
  if (filter === 'active') return tasks.filter((t) => !t.isCompleted)
  if (filter === 'completed') return tasks.filter((t) => t.isCompleted)
  return tasks
}

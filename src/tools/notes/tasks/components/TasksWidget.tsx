import { useState } from 'react'
import { Trash2, CheckCircle2, Circle, ListTodo, Plus, Loader2 } from 'lucide-react'
import { isPast, isToday, parseISO, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTaskStore, selectFilteredTasks, type TaskFilter } from '@/tools/notes/tasks/store/taskStore'
import { createTask, toggleTaskCompletion, deleteTask } from '@/tools/notes/tasks/services/taskService'

export default function TasksWidget() {
  const { user } = useAuth()
  const tasks = useTaskStore(selectFilteredTasks)
  const loading = useTaskStore((s) => s.loading)
  const filter = useTaskStore((s) => s.filter)
  const setFilter = useTaskStore((s) => s.setFilter)
  const removeTask = useTaskStore((s) => s.removeTask)

  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title.trim()) return

    setAdding(true)
    try {
      await createTask(user.uid, {
        title: title.trim(),
        dueDate: null, // Quick tasks have no due date by default
      })
      setTitle('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(taskId: string, currentStatus: boolean) {
    try {
      await toggleTaskCompletion(taskId, !currentStatus)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleDelete(task: (typeof tasks)[number]) {
    if (!user || task.userId !== user.uid) {
      toast.error('Cannot delete task: owner mismatch')
      return
    }

    try {
      await deleteTask(task.id)
      removeTask(task.id)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function getDueDateBadge(dateStr: string | null, isCompleted: boolean) {
    if (!dateStr) return null
    const date = parseISO(dateStr)
    const isOverdue = isPast(date) && !isToday(date) && !isCompleted
    const label = format(date, 'MMM d')

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-0.5 rounded bg-error/10 px-1.5 py-0.5 text-[10px] font-semibold text-error animate-pulse">
          Overdue
        </span>
      )
    }
    return (
      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        isCompleted ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : 'bg-primary/10 text-primary'
      }`}>
        {label}
      </span>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-canvas-card p-4 shadow-sm dark:border-gray-800 dark:bg-dark-elevated h-[400px] 2xl:h-full overflow-hidden">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-[18px] font-medium text-ink dark:text-gray-100">
          <ListTodo size={18} className="text-primary" /> Tasks
        </h2>
        <div className="flex gap-0.5 rounded-md bg-canvas p-0.5 dark:bg-dark">
          {(['all', 'active', 'completed'] as TaskFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-0.5 text-xs font-medium capitalize transition ${
                filter === f
                  ? 'bg-canvas-card text-ink shadow-sm dark:bg-dark-elevated dark:text-white font-semibold'
                  : 'text-ink-muted hover:text-ink dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {f === 'completed' ? 'Done' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add */}
      <form onSubmit={handleCreate} className="mb-3.5 flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-200"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="flex items-center justify-center rounded-md bg-primary p-2 text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-40"
        >
          {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        </button>
      </form>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-canvas dark:bg-dark" />
          ))
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-ink-muted">
            <ListTodo size={32} className="mb-2 opacity-40" />
            <p className="font-semibold">No tasks found</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`group flex items-center justify-between gap-3 rounded-lg border border-hairline/80 p-2.5 transition duration-150 hover:border-primary/50 dark:border-gray-800 ${
                task.isCompleted ? 'bg-canvas-soft/30 dark:bg-dark/10' : 'bg-canvas dark:bg-dark'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <button
                  type="button"
                  onClick={() => handleToggle(task.id, task.isCompleted)}
                  className={`flex shrink-0 transition-transform active:scale-90 ${
                    task.isCompleted ? 'text-success' : 'text-ink-muted hover:text-primary'
                  }`}
                >
                  {task.isCompleted ? (
                    <CheckCircle2 size={18} className="fill-success/5" />
                  ) : (
                    <Circle size={18} />
                  )}
                </button>
                <div className="flex flex-col truncate">
                  <span
                    className={`text-sm font-medium truncate transition ${
                      task.isCompleted
                        ? 'text-ink-muted/75 line-through dark:text-gray-500'
                        : 'text-ink-body dark:text-gray-200 font-semibold'
                    }`}
                  >
                    {task.title}
                  </span>
                  {task.dueDate && (
                    <div className="mt-0.5">{getDueDateBadge(task.dueDate, task.isCompleted)}</div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(task)}
                className="opacity-0 group-hover:opacity-100 hover:text-error transition p-0.5 text-ink-muted"
                aria-label="Delete task"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

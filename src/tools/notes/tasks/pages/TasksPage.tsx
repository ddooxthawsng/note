import { useState } from 'react'
import { Calendar, Trash2, CheckCircle2, Circle, ListTodo, Plus, Loader2, Mic, MicOff, Sparkles, Wand2 } from 'lucide-react'
import { isPast, isToday, parseISO, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTaskStore, selectFilteredTasks, type TaskFilter } from '@/tools/notes/tasks/store/taskStore'
import { createTask, toggleTaskCompletion, deleteTask } from '@/tools/notes/tasks/services/taskService'
import { scheduleTaskNotification, cancelTaskNotification } from '@/shared/utils/notifications'
import { useSpeechToText } from '@/shared/hooks/useSpeechToText'
import { askGeminiToParseTasks } from '@/shared/utils/ai'
import { cn } from '@/shared/utils/cn'

export default function TasksPage() {
  const { user } = useAuth()
  const tasks = useTaskStore(selectFilteredTasks)
  const loading = useTaskStore((s) => s.loading)
  const filter = useTaskStore((s) => s.filter)
  const setFilter = useTaskStore((s) => s.setFilter)
  const removeTask = useTaskStore((s) => s.removeTask)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [adding, setAdding] = useState(false)

  // AI Task Builder States
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showAiBuilder, setShowAiBuilder] = useState(false)

  // Speech to Text for standard task
  const {
    isListening,
    toggleListening,
    isSupported: speechSupported,
  } = useSpeechToText((transcript) => {
    setTitle((prev) => (prev ? prev + ' ' + transcript : transcript))
  })

  // Speech to Text for AI Builder prompt
  const {
    isListening: isAiListening,
    toggleListening: toggleAiListening,
    isSupported: aiSpeechSupported,
  } = useSpeechToText((transcript) => {
    setAiPrompt((prev) => (prev ? prev + ' ' + transcript : transcript))
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) {
      return toast.error('Task title cannot be empty')
    }

    setAdding(true)
    try {
      const taskId = await createTask(userIdString(), {
        title: title.trim(),
        dueDate: dueDate || null,
      })
      if (dueDate) {
        await scheduleTaskNotification(taskId, title.trim(), dueDate)
      }
      toast.success('Task created!')
      setTitle('')
      setDueDate('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleAiGenerate() {
    if (!user || !aiPrompt.trim()) return
    setAiGenerating(true)
    try {
      const parsedTasks = await askGeminiToParseTasks(aiPrompt.trim())
      if (parsedTasks.length === 0) {
        toast.error('AI could not identify any tasks. Try rephrasing.')
        return
      }

      let createdCount = 0
      for (const t of parsedTasks) {
        const taskId = await createTask(userIdString(), {
          title: t.title,
          dueDate: t.dueDate,
        })
        if (t.dueDate) {
          await scheduleTaskNotification(taskId, t.title, t.dueDate)
        }
        createdCount++
      }

      toast.success(`Successfully created ${createdCount} tasks using AI!`)
      setAiPrompt('')
      setShowAiBuilder(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAiGenerating(false)
    }
  }

  function userIdString(): string {
    return user?.uid || ''
  }

  async function handleToggle(taskId: string, currentStatus: boolean) {
    try {
      await toggleTaskCompletion(taskId, !currentStatus)
      if (!currentStatus) {
        await cancelTaskNotification(taskId)
      } else {
        const task = tasks.find((t) => t.id === taskId)
        if (task?.dueDate) {
          await scheduleTaskNotification(taskId, task.title, task.dueDate)
        }
      }
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
      await cancelTaskNotification(task.id)
      toast.success('Task deleted')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function getDueDateBadge(dateStr: string | null, isCompleted: boolean) {
    if (!dateStr) return null
    const date = parseISO(dateStr)
    const isOverdue = isPast(date) && !isCompleted

    let label = ''
    try {
      if (dateStr.includes('T')) {
        label = format(date, 'MMM d, yyyy h:mm a')
      } else {
        label = format(date, 'MMM d, yyyy')
      }
    } catch {
      label = dateStr
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-error text-white px-2 py-0.5 text-xs font-semibold animate-pulse shadow-sm">
          <Calendar size={12} />
          Overdue: {label}
        </span>
      )
    }

    if (isToday(date) && !isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-warning/20 text-warning px-2 py-0.5 text-xs font-semibold border border-warning/30">
          <Calendar size={12} />
          Today: {label}
        </span>
      )
    }

    return (
      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
        isCompleted ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' : 'bg-primary/10 text-primary'
      }`}>
        <Calendar size={12} />
        Due: {label}
      </span>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-6 animate-fade-in-up">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-gray-500">{tasks.length} tasks matching filters</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-150 p-1 dark:bg-gray-800">
          {(['all', 'active', 'completed'] as TaskFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 capitalize ${
                filter === f
                  ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* AI Task Builder Toggle */}
      <div className="mb-4 flex justify-between items-center">
        <button
          type="button"
          onClick={() => setShowAiBuilder(!showAiBuilder)}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          <Sparkles size={16} />
          {showAiBuilder ? 'Hide AI Task Builder' : 'Try AI Task Builder (Natural Language)'}
        </button>
      </div>

      {/* AI Task Builder Accordion */}
      {showAiBuilder && (
        <div className="mb-6 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 shadow-sm animate-slide-down">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-primary">
            <Sparkles size={15} /> AI Task Builder
          </h3>
          <p className="mb-3 text-xs text-ink-muted">Type or speak a prompt (e.g. "I need to design logo today at 3pm, write code tomorrow, and review code next Monday at 10:00"). AI will parse and create these tasks with correct times automatically.</p>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={isAiListening ? "Listening..." : "Tell AI what tasks you want to create..."}
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-canvas px-4 py-2 pr-10 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark text-sm"
              />
              {aiSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleAiListening}
                  className={cn(
                    "absolute right-3 top-3 rounded-full p-1.5 transition-colors",
                    isAiListening
                      ? "bg-error/10 text-error animate-pulse"
                      : "text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                  title="Talk to text"
                >
                  {isAiListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
              >
                {aiGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                Generate Tasks with AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Form */}
      <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isListening ? "Listening..." : "What needs to be done?"}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-4 pr-10 py-2 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors",
                  isListening
                    ? "bg-error/10 text-error animate-pulse"
                    : "text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
                title="Talk to text"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800"
            />
            <button
              type="submit"
              disabled={adding}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary-600 active:scale-95 disabled:opacity-60"
            >
              {adding ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Plus size={16} /> Add
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Tasks List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
          <ListTodo size={48} className="mb-3 opacity-50" />
          <p className="text-lg font-medium">No tasks yet</p>
          <p className="text-sm">Create a task to start tracking your to-dos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`group flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-primary hover:shadow-md dark:border-gray-800 dark:bg-gray-900 ${
                task.isCompleted ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(task.id, task.isCompleted)}
                  className={`flex shrink-0 transition-transform active:scale-90 ${
                    task.isCompleted ? 'text-success' : 'text-gray-400 hover:text-primary'
                  }`}
                >
                  {task.isCompleted ? (
                    <CheckCircle2 size={22} className="fill-success/10" />
                  ) : (
                    <Circle size={22} />
                  )}
                </button>
                <div className="flex flex-col">
                  <span
                    className={`font-medium transition-all duration-200 ${
                      task.isCompleted
                        ? 'text-gray-400 line-through dark:text-gray-500'
                        : 'text-gray-800 dark:text-gray-200 font-semibold'
                    }`}
                  >
                    {task.title}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {getDueDateBadge(task.dueDate, task.isCompleted)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(task)}
                className="opacity-0 transition-opacity hover:text-error group-hover:opacity-100 focus:opacity-100 p-1"
                aria-label="Delete task"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

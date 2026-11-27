import { useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Edit3,
  Flag,
  ListTodo,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useTaskStore, selectFilteredTasks, type TaskFilter } from '@/tools/notes/tasks/store/taskStore'
import { createTask, deleteTask, toggleTaskCompletion, updateTask } from '@/tools/notes/tasks/services/taskService'
import type { Task, TaskPriority } from '@/tools/notes/tasks/types/task'
import { cancelTaskNotification, scheduleTaskNotification } from '@/shared/utils/notifications'
import { useSpeechToText } from '@/shared/hooks/useSpeechToText'
import { askGeminiToParseTasks } from '@/shared/utils/ai'
import { cn } from '@/shared/utils/cn'
import { useUiStore } from '@/shared/store/uiStore'
import CustomSelect from '@/shared/components/CustomSelect'

const PRIORITY_STYLES: Record<TaskPriority, { label: string; badge: string }> = {
  high: { label: 'High', badge: 'bg-error/15 text-error border-error/30' },
  medium: { label: 'Medium', badge: 'bg-warning/15 text-warning border-warning/30' },
  low: { label: 'Low', badge: 'bg-primary/10 text-primary border-primary/25' },
}

export default function TasksPage() {
  const { user } = useAuth()
  const showMicControls = useUiStore((s) => s.showMicControls)
  const allTasks = useTaskStore((s) => s.tasks)
  const tasks = useTaskStore(selectFilteredTasks)
  const loading = useTaskStore((s) => s.loading)
  const filter = useTaskStore((s) => s.filter)
  const setFilter = useTaskStore((s) => s.setFilter)
  const removeTask = useTaskStore((s) => s.removeTask)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium')

  // AI Task Builder States
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showAiBuilder, setShowAiBuilder] = useState(false)

  const {
    isListening,
    toggleListening,
    isSupported: speechSupported,
  } = useSpeechToText((transcript) => {
    setTitle((prev) => (prev ? prev + ' ' + transcript : transcript))
  })

  const {
    isListening: isAiListening,
    toggleListening: toggleAiListening,
    isSupported: aiSpeechSupported,
  } = useSpeechToText((transcript) => {
    setAiPrompt((prev) => (prev ? prev + ' ' + transcript : transcript))
  })

  const stats = useMemo(() => {
    const total = allTasks.length
    const completed = allTasks.filter((t) => t.isCompleted).length
    const active = total - completed
    const overdue = allTasks.filter((t) => !t.isCompleted && t.dueDate && isPast(parseISO(t.dueDate))).length
    const pct = total ? Math.round((completed / total) * 100) : 0
    return { total, completed, active, overdue, pct }
  }, [allTasks])

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (priorityFilter !== 'all' && (t.priority ?? 'medium') !== priorityFilter) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, search, priorityFilter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) {
      return toast.error('Task title cannot be empty')
    }

    setAdding(true)
    try {
      const taskId = await createTask(user.uid, {
        title: title.trim(),
        dueDate: dueDate || null,
        priority,
      })
      if (dueDate) {
        await scheduleTaskNotification(taskId, title.trim(), dueDate)
      }
      toast.success('Task created!')
      setTitle('')
      setDueDate('')
      setPriority('medium')
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
        const taskId = await createTask(user.uid, {
          title: t.title,
          dueDate: t.dueDate,
          priority: 'medium',
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

  async function handleToggle(taskId: string, currentStatus: boolean) {
    try {
      await toggleTaskCompletion(taskId, !currentStatus)
      if (!currentStatus) {
        await cancelTaskNotification(taskId)
      } else {
        const task = allTasks.find((t) => t.id === taskId)
        if (task?.dueDate) {
          await scheduleTaskNotification(taskId, task.title, task.dueDate)
        }
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditDueDate(task.dueDate ?? '')
    setEditPriority(task.priority ?? 'medium')
  }

  async function saveEdit(taskId: string) {
    if (!editTitle.trim()) {
      toast.error('Task title cannot be empty')
      return
    }
    try {
      await updateTask(taskId, {
        title: editTitle.trim(),
        dueDate: editDueDate || null,
        priority: editPriority,
      })
      setEditingId(null)
      toast.success('Task updated')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleDelete(task: Task) {
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

  async function handleClearCompleted() {
    const completed = allTasks.filter((t) => t.isCompleted)
    if (!completed.length) return
    try {
      await Promise.all(
        completed.map(async (t) => {
          await deleteTask(t.id)
          removeTask(t.id)
          await cancelTaskNotification(t.id)
        }),
      )
      toast.success(`Cleared ${completed.length} completed task(s)`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleCopyTask(text: string) {
    await navigator.clipboard.writeText(text)
    toast.success('Copied task!')
  }

  function getDueDateBadge(dateStr: string | null, isCompleted: boolean) {
    if (!dateStr) return null
    const date = parseISO(dateStr)
    const isOverdue = isPast(date) && !isCompleted

    let label = ''
    try {
      label = dateStr.includes('T') ? format(date, 'MMM d, yyyy h:mm a') : format(date, 'MMM d, yyyy')
    } catch {
      label = dateStr
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-error text-white px-2.5 py-0.5 text-[11px] font-semibold animate-pulse shadow-sm">
          <Calendar size={11} />
          Overdue: {label}
        </span>
      )
    }

    if (isToday(date) && !isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 text-warning px-2.5 py-0.5 text-[11px] font-semibold border border-warning/30">
          <Calendar size={11} />
          Today: {label}
        </span>
      )
    }

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
          isCompleted ? 'bg-canvas-soft text-ink-muted dark:bg-dark' : 'bg-primary/10 text-primary',
        )}
      >
        <Calendar size={11} />
        Due: {label}
      </span>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 animate-fade-in-up">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        {/* Header + Stats */}
        <div className="rounded-2xl border border-hairline/80 bg-canvas-card/80 p-4 sm:p-5 backdrop-blur-xl shadow-sm dark:border-gray-800/80 dark:bg-dark-elevated/80">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-normal text-ink dark:text-gray-100">Tasks</h1>
              <p className="text-sm text-ink-muted">
                {stats.active} active · {stats.completed} completed
                {stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border border-hairline bg-canvas/80 p-1 dark:border-gray-800 dark:bg-dark/80">
                {(['all', 'active', 'completed'] as TaskFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all capitalize',
                      filter === f
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-ink-muted hover:text-ink dark:hover:text-gray-100',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {stats.completed > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearCompleted()}
                  className="rounded-xl border border-hairline bg-canvas/80 px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-error/40 hover:text-error dark:border-gray-800 dark:bg-dark/80"
                >
                  Clear completed ({stats.completed})
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
              <span>Completion progress</span>
              <span className="font-semibold text-ink dark:text-gray-200">{stats.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-canvas-soft dark:bg-dark">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent-teal transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* AI Task Builder Toggle & Accordion */}
        <div>
          <button
            type="button"
            onClick={() => setShowAiBuilder(!showAiBuilder)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
          >
            <Sparkles size={16} />
            {showAiBuilder ? 'Hide AI Task Builder' : 'Try AI Task Builder (Natural Language)'}
          </button>

          {showAiBuilder && (
            <div className="mt-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 backdrop-blur-md shadow-sm animate-slide-down">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-primary">
                <Sparkles size={15} /> AI Task Builder
              </h3>
              <p className="mb-3 text-xs text-ink-muted">
                Type or speak a prompt (e.g. "Design logo today at 3pm, review code tomorrow at 10am"). AI will parse and create tasks automatically.
              </p>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={isAiListening ? 'Listening...' : 'Tell AI what tasks you want to create...'}
                    rows={3}
                    className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark"
                  />
                  {showMicControls && aiSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleAiListening}
                      className={cn(
                        'absolute right-3 top-3 rounded-full p-1.5 transition-colors',
                        isAiListening ? 'bg-error/10 text-error animate-pulse' : 'text-ink-muted hover:bg-canvas-card dark:hover:bg-dark-elevated',
                      )}
                      title="Talk to text"
                    >
                      {isAiListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
                  >
                    {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {aiGenerating ? 'Parsing & Creating...' : 'Generate Tasks'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Task Form */}
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2.5 rounded-2xl border border-hairline/80 bg-canvas-card/85 p-3.5 backdrop-blur-xl shadow-sm dark:border-gray-800/80 dark:bg-dark-elevated/85 md:flex-row md:items-center"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={isListening ? 'Listening...' : 'What needs to be done?'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-100"
            />
            {showMicControls && speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  'absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors',
                  isListening ? 'bg-error/10 text-error animate-pulse' : 'text-ink-muted hover:bg-canvas-soft dark:hover:bg-dark-elevated',
                )}
                title="Dictate task"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CustomSelect
              value={priority}
              onChange={(val) => setPriority(val as TaskPriority)}
              ariaLabel="Priority"
              options={[
                { value: 'high', label: '🔴 High' },
                { value: 'medium', label: '🟡 Medium' },
                { value: 'low', label: '🔵 Low' },
              ]}
              className="min-w-[125px]"
            />
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-xl border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-200"
            />
            <button
              type="submit"
              disabled={adding || !title.trim()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
            >
              {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add
            </button>
          </div>
        </form>

        {/* Search & Priority Filter Bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-xl border border-hairline bg-canvas/80 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated/80"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize transition',
                  priorityFilter === p
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-hairline bg-canvas/70 text-ink-muted hover:text-ink dark:border-gray-800 dark:bg-dark-elevated/70',
                )}
              >
                {p === 'all' ? 'All priorities' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-ink-muted">
            <Loader2 className="mb-2 animate-spin text-primary" size={28} />
            Loading tasks...
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-canvas-card/50 py-16 text-center text-ink-muted backdrop-blur-sm dark:border-gray-800 dark:bg-dark-elevated/50">
            <ListTodo size={44} className="mb-3 text-ink-muted/30" />
            <h3 className="font-semibold text-ink dark:text-gray-200">No tasks found</h3>
            <p className="mt-1 text-sm">Create a task above or let AI generate a checklist for you.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visibleTasks.map((task) => {
              const p = task.priority ?? 'medium'
              const isEditing = editingId === task.id
              return (
                <div
                  key={task.id}
                  className={cn(
                    'group flex flex-col gap-3 rounded-2xl border border-hairline/80 bg-canvas-card/85 p-3.5 backdrop-blur-xl transition-all duration-200 hover:border-primary/40 hover:shadow-md dark:border-gray-800/80 dark:bg-dark-elevated/85 sm:flex-row sm:items-center sm:justify-between',
                    task.isCompleted && 'opacity-65',
                  )}
                >
                  {isEditing ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="min-w-[180px] flex-1 rounded-lg border border-primary bg-canvas px-3 py-1.5 text-sm outline-none dark:bg-dark"
                        autoFocus
                      />
                      <CustomSelect
                        size="sm"
                        value={editPriority}
                        onChange={(val) => setEditPriority(val as TaskPriority)}
                        ariaLabel="Edit priority"
                        options={[
                          { value: 'high', label: '🔴 High' },
                          { value: 'medium', label: '🟡 Medium' },
                          { value: 'low', label: '🔵 Low' },
                        ]}
                      />
                      <input
                        type="datetime-local"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs dark:border-gray-800 dark:bg-dark"
                      />
                      <button
                        type="button"
                        onClick={() => void saveEdit(task.id)}
                        className="rounded-lg bg-primary p-2 text-white hover:bg-primary-hover"
                        title="Save"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-hairline p-2 text-ink-muted hover:text-ink dark:border-gray-800"
                        title="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button
                          onClick={() => handleToggle(task.id, task.isCompleted)}
                          className="mt-0.5 shrink-0 text-ink-muted transition hover:text-primary active:scale-90"
                          aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {task.isCompleted ? (
                            <CheckCircle2 size={21} className="text-success" />
                          ) : (
                            <Circle size={21} />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                'break-words text-sm font-medium transition-all',
                                task.isCompleted ? 'line-through text-ink-muted' : 'text-ink dark:text-gray-100',
                              )}
                            >
                              {task.title}
                            </p>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', PRIORITY_STYLES[p].badge)}>
                              <Flag size={10} /> {PRIORITY_STYLES[p].label}
                            </span>
                            {getDueDateBadge(task.dueDate, task.isCompleted)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => void handleCopyTask(task.title)}
                          title="Copy task text"
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-soft hover:text-primary dark:hover:bg-dark"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          title="Edit task"
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-soft hover:text-primary dark:hover:bg-dark"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task)}
                          title="Delete task"
                          className="rounded-lg p-1.5 text-ink-muted hover:bg-error/10 hover:text-error"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

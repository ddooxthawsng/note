import { useParams } from 'react-router-dom'
import { Plus, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNoteStore, selectVisibleNotes } from '@/store/noteStore'
import { useFolderStore } from '@/store/folderStore'
import { useUiStore } from '@/store/uiStore'
import { useAuth } from '@/hooks/useAuth'
import { createNote } from '@/services/noteService'
import NotesList from '@/components/NotesList'
import TasksWidget from '@/components/TasksWidget'
import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

export default function DashboardPage() {
  const { folderId } = useParams<{ folderId?: string }>()
  const { user } = useAuth()
  const folders = useFolderStore((s) => s.folders)
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)

  const allVisibleNotes = useNoteStore(selectVisibleNotes)
  const notes = folderId
    ? allVisibleNotes.filter((n) => n.folderId === folderId)
    : allVisibleNotes

  const loading = useNoteStore((s) => s.loading)
  const search = useNoteStore((s) => s.search)
  const sortBy = useNoteStore((s) => s.sortBy)
  const setSortBy = useNoteStore((s) => s.setSortBy)

  const [sortOpen, setSortOpen] = useState(false)

  async function handleNew() {
    if (!user) return
    try {
      const id = await createNote(user.uid, { folderId: folderId || null })
      setEditingNoteId(id)
      toast.success('New note created!')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Ctrl + V global listener for quick note creation
  useEffect(() => {
    if (!user) return

    async function handlePaste(e: ClipboardEvent) {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.closest('.ProseMirror'))
      ) {
        return
      }

      const text = e.clipboardData?.getData('text')
      if (!text || !text.trim()) return

      try {
        const lines = text.trim().split('\n')
        const firstLine = lines[0]?.trim()
        const title = firstLine && firstLine.length < 50 ? firstLine : 'Pasted Note'
        const contentHtml = `<p>${text.replace(/\n/g, '<br>')}</p>`

        const id = await createNote(user!.uid, {
          title,
          content: contentHtml,
          folderId: folderId || null,
        })
        setEditingNoteId(id)
        toast.success('Note pasted and created!')
      } catch (err) {
        toast.error((err as Error).message)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [user, folderId, setEditingNoteId])

  const currentFolder = folders.find((f) => f.id === folderId)
  const titleText = folderId
    ? currentFolder
      ? `${currentFolder.name}`
      : 'Folder Notes'
    : search
      ? `Results for "${search}"`
      : 'All Notes'

  const sortOptions = [
    { value: 'updatedAt', label: 'Last modified' },
    { value: 'createdAt', label: 'Date created' },
    { value: 'title', label: 'Title' },
  ]
  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || 'Last modified'

  return (
    <div className="mx-auto w-full max-w-[1600px] p-6 flex flex-col h-auto lg:h-full overflow-visible lg:overflow-hidden animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-serif font-normal text-ink dark:text-gray-100 tracking-tight">{titleText}</h1>
          <p className="text-sm text-ink-muted">{notes.length} notes</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Custom Select Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center justify-between gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none dark:border-gray-800 dark:bg-dark-elevated text-ink-body dark:text-gray-300 min-w-[135px] text-left hover:bg-canvas-soft dark:hover:bg-dark transition-colors"
            >
              <span>{currentSortLabel}</span>
              <ChevronDown size={14} className="text-ink-muted shrink-0" />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 w-40 rounded-md border border-hairline bg-canvas p-1 shadow-lg dark:border-gray-800 dark:bg-dark-elevated animate-scale-in">
                  {sortOptions.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => {
                        setSortBy(o.value as 'updatedAt' | 'createdAt' | 'title')
                        setSortOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center rounded px-2.5 py-1.5 text-left text-xs font-medium transition",
                        sortBy === o.value
                          ? "bg-primary text-white"
                          : "text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark hover:text-ink"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleNew}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:scale-95 shadow-sm"
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 lg:flex-row items-stretch overflow-visible lg:overflow-hidden min-h-0">
        <div className="flex-1 overflow-visible lg:overflow-y-auto pr-0 lg:pr-2 pb-6 flex flex-col">
          <NotesList notes={notes} loading={loading} />
        </div>
        <div className="w-full lg:w-96 shrink-0 flex flex-col h-auto lg:h-full">
          <TasksWidget />
        </div>
      </div>
    </div>
  )
}

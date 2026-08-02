import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, Search, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useFolderStore } from '@/tools/notes/store/folderStore'
import { selectVisibleNotes, useNoteStore } from '@/tools/notes/store/noteStore'
import { useTaskStore } from '@/tools/notes/tasks/store/taskStore'
import { createNote } from '@/tools/notes/services/noteService'
import ContextMenu from '@/tools/notes/components/ContextMenu'
import EditorModal from '@/tools/notes/components/Editor/EditorModal'
import NotesSidebar from '@/tools/notes/components/NotesSidebar'
import QuickCapture from '@/tools/notes/components/QuickCapture'
import { useUiStore } from '@/shared/store/uiStore'
import { cn } from '@/shared/utils/cn'
import type { NoteViewMode } from '@/tools/notes/components/NoteCard'

const NOTE_VIEW_MODE_KEY = 'notes_view_mode'
const NOTE_COLUMNS_KEY = 'notes_columns'
const SIDEBAR_COLLAPSED_KEY = 'notes_sidebar_collapsed'
const SIDEBAR_DEFAULT_COLLAPSED_KEY = 'notes_sidebar_default_collapsed'
const LAST_FOLDER_KEY = 'notes_last_folder'

export default function NotesToolLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const subscribeNotes = useNoteStore((s) => s.subscribe)
  const unsubscribeNotes = useNoteStore((s) => s.unsubscribe)
  const search = useNoteStore((s) => s.search)
  const setSearch = useNoteStore((s) => s.setSearch)
  const sortBy = useNoteStore((s) => s.sortBy)
  const setSortBy = useNoteStore((s) => s.setSortBy)
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)
  const allVisibleNotes = useNoteStore(selectVisibleNotes)
  const allNotes = useNoteStore((s) => s.notes)
  const folders = useFolderStore((s) => s.folders)
  const foldersLoading = useFolderStore((s) => s.loading)
  const subscribeFolders = useFolderStore((s) => s.subscribe)
  const unsubscribeFolders = useFolderStore((s) => s.unsubscribe)
  const subscribeTasks = useTaskStore((s) => s.subscribe)
  const unsubscribeTasks = useTaskStore((s) => s.unsubscribe)
  const [sortOpen, setSortOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const restoredFolder = useRef(false)
  const [sidebarDefaultCollapsed, setSidebarDefaultCollapsed] = useState(() => (
    localStorage.getItem(SIDEBAR_DEFAULT_COLLAPSED_KEY) === 'true'
  ))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved != null) return saved === 'true'
    return localStorage.getItem(SIDEBAR_DEFAULT_COLLAPSED_KEY) === 'true'
  })
  const [viewMode, setViewMode] = useState<NoteViewMode>(() => (
    localStorage.getItem(NOTE_VIEW_MODE_KEY) === 'title' ? 'title' : 'normal'
  ))
  const [columns, setColumns] = useState(() => {
    const saved = Number(localStorage.getItem(NOTE_COLUMNS_KEY))
    return [1, 2, 3, 4].includes(saved) ? saved : 3
  })

  const showNoteActions = !location.pathname.endsWith('/tasks') && !location.pathname.endsWith('/trash')
  const folderId = location.pathname.match(/\/tools\/notes\/folder\/([^/]+)/)?.[1] ?? null
  const currentFolder = folders.find((folder) => folder.id === folderId)
  const titleText = folderId
    ? currentFolder?.name || 'Folder Notes'
    : location.pathname.endsWith('/favorites')
      ? 'Favorites'
      : search
        ? `Results for "${search}"`
        : 'All Notes'
  const notesCount = location.pathname.endsWith('/favorites')
    ? allNotes.filter((note) => note.isFavorite).length
    : folderId
      ? allVisibleNotes.filter((note) => note.folderId === folderId).length
      : allVisibleNotes.length
  const countLabel = location.pathname.endsWith('/favorites') ? `${notesCount} starred` : `${notesCount} notes`

  const sortOptions = [
    { value: 'custom', label: 'Custom order' },
    { value: 'updatedAt', label: 'Last modified' },
    { value: 'createdAt', label: 'Date created' },
    { value: 'title', label: 'Title' },
  ]
  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || 'Last modified'

  useEffect(() => {
    if (user) {
      subscribeNotes(user.uid)
      subscribeFolders(user.uid)
      subscribeTasks(user.uid)
    }
    return () => {
      unsubscribeNotes()
      unsubscribeFolders()
      unsubscribeTasks()
    }
  }, [user, subscribeNotes, unsubscribeNotes, subscribeFolders, unsubscribeFolders, subscribeTasks, unsubscribeTasks])

  useEffect(() => {
    if (!user || foldersLoading || restoredFolder.current) return
    restoredFolder.current = true
    if (location.pathname !== '/tools/notes') return
    const savedFolderId = localStorage.getItem(`${LAST_FOLDER_KEY}:${user.uid}`)
    if (savedFolderId && folders.some((folder) => folder.id === savedFolderId)) {
      navigate(`/tools/notes/folder/${savedFolderId}`, { replace: true })
    }
  }, [folders, foldersLoading, location.pathname, navigate, user])

  useEffect(() => {
    if (user && folderId) localStorage.setItem(`${LAST_FOLDER_KEY}:${user.uid}`, folderId)
  }, [folderId, user])

  useEffect(() => {
    localStorage.setItem(NOTE_VIEW_MODE_KEY, viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem(NOTE_COLUMNS_KEY, String(columns))
  }, [columns])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_DEFAULT_COLLAPSED_KEY, String(sidebarDefaultCollapsed))
  }, [sidebarDefaultCollapsed])

  async function handleNew() {
    if (!user) return
    try {
      const id = await createNote(user.uid, { folderId })
      setEditingNoteId(id)
      toast.success('New note created!')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <NotesSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />
      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        <div className="border-b border-hairline bg-canvas px-4 py-3 dark:border-gray-800 dark:bg-dark">
          <div className="flex flex-wrap items-center gap-2">
            {showNoteActions && (
              <div className="min-w-[130px] pr-2">
                <h1 className="font-serif text-xl font-medium leading-tight text-ink dark:text-gray-100">{titleText}</h1>
                <p className="text-xs text-ink-muted">{countLabel}</p>
              </div>
            )}
            <div className="relative min-w-[220px] flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full rounded-md border border-hairline bg-canvas-soft py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-200 dark:focus:border-primary"
            />
            </div>

            {showNoteActions && (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSortOpen(!sortOpen)}
                    className="flex min-w-[135px] items-center justify-between gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-left text-sm text-ink-body outline-none transition hover:bg-canvas-soft dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-300 dark:hover:bg-dark"
                  >
                    <span>{currentSortLabel}</span>
                    <ChevronDown size={14} className="shrink-0 text-ink-muted" />
                  </button>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                      <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-hairline bg-canvas p-1 shadow-lg animate-scale-in dark:border-gray-800 dark:bg-dark-elevated">
                        {sortOptions.map((o) => (
                          <button
                            key={o.value}
                            onClick={() => {
                              setSortBy(o.value as 'custom' | 'updatedAt' | 'createdAt' | 'title')
                              setSortOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-center rounded px-2.5 py-1.5 text-left text-xs font-medium transition',
                              sortBy === o.value
                                ? 'bg-primary text-white'
                                : 'text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark hover:text-ink',
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="flex items-center gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink-body transition hover:bg-canvas-soft dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-300 dark:hover:bg-dark"
                    aria-label="Note view settings"
                  >
                    <SlidersHorizontal size={15} />
                    View
                  </button>
                  {settingsOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-hairline bg-canvas p-3 shadow-lg animate-scale-in dark:border-gray-800 dark:bg-dark-elevated">
                        <div className="mb-3">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">Display</p>
                          <div className="flex rounded-md border border-hairline bg-canvas-soft p-0.5 dark:border-gray-800 dark:bg-dark">
                            {[
                              ['normal', 'Full'],
                              ['title', 'Title'],
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setViewMode(value as NoteViewMode)}
                                className={cn(
                                  'flex-1 rounded px-2 py-1.5 text-sm font-medium transition',
                                  viewMode === value
                                    ? 'bg-primary text-white'
                                    : 'text-ink-body hover:bg-canvas dark:text-gray-300 dark:hover:bg-dark-elevated',
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">Notes per row</p>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setColumns(value)}
                                className={cn(
                                  'rounded-md border border-hairline px-2 py-1.5 text-sm font-semibold transition dark:border-gray-800',
                                  columns === value
                                    ? 'bg-primary text-white'
                                    : 'bg-canvas-soft text-ink-body hover:bg-canvas dark:bg-dark dark:text-gray-300 dark:hover:bg-dark-elevated',
                                )}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSidebarDefaultCollapsed((value) => !value)}
                          className="mt-3 flex w-full items-center justify-between rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-sm font-medium text-ink-body transition hover:bg-canvas dark:border-gray-800 dark:bg-dark dark:text-gray-300 dark:hover:bg-dark-elevated"
                        >
                          <span>Start collapsed</span>
                          <span className={cn(
                            'rounded px-2 py-0.5 text-xs font-semibold',
                            sidebarDefaultCollapsed ? 'bg-primary text-white' : 'bg-canvas text-ink-muted dark:bg-dark-elevated',
                          )}>
                            {sidebarDefaultCollapsed ? 'On' : 'Off'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleNew}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover active:scale-95"
                >
                  <Plus size={16} /> New
                </button>
              </>
            )}
          </div>
        </div>
        <Outlet context={{ viewMode, columns }} />
      </section>
      <EditorModal />
      <ContextMenu />
      <QuickCapture />
    </div>
  )
}

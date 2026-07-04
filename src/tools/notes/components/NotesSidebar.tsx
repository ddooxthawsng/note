import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FileText, Folder, ListTodo, PanelLeftClose, PanelLeftOpen, Plus, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useUiStore } from '@/shared/store/uiStore'
import { cn } from '@/shared/utils/cn'
import { confirmDialog, promptDialog } from '@/shared/utils/dialog'
import { createFolder, deleteFolder } from '@/tools/notes/services/folderService'
import { createNote, updateNote } from '@/tools/notes/services/noteService'
import { useFolderStore } from '@/tools/notes/store/folderStore'
import { useNoteStore } from '@/tools/notes/store/noteStore'

const links = [
  { to: '/tools/notes', label: 'All Notes', icon: FileText, end: true },
  { to: '/tools/notes/favorites', label: 'Favorites', icon: Star, end: false },
  { to: '/tools/notes/tasks', label: 'Tasks', icon: ListTodo, end: false },
  { to: '/tools/notes/trash', label: 'Trash', icon: Trash2, end: false },
]

export default function NotesSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { user } = useAuth()
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const folders = useFolderStore((s) => s.folders)
  const addFolder = useFolderStore((s) => s.addFolder)
  const notes = useNoteStore((s) => s.notes)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  async function handleNewNote() {
    if (!user) return
    try {
      const id = await createNote(user.uid)
      setEditingNoteId(id)
      toast.success('New note created!')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleNewFolder() {
    if (!user) return
    const name = await promptDialog('New Folder', 'Enter new folder name:')
    if (!name || !name.trim()) return
    try {
      const folder = await createFolder(user.uid, name.trim())
      addFolder(folder)
      toast.success('Folder created!')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleDeleteFolder(e: React.MouseEvent, folderId: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    const confirmed = await confirmDialog(
      'Delete Folder',
      `Are you sure you want to delete "${name}"? Notes in this folder will not be deleted.`,
      'Delete',
    )
    if (!confirmed) return
    try {
      await deleteFolder(folderId)
      toast.success('Folder deleted!')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleNoteDrop(e: React.DragEvent, folderId: string, folderName: string) {
    e.preventDefault()
    setDragOverFolderId(null)
    const noteId = e.dataTransfer.getData('text/plain')
    if (!noteId) return
    try {
      await updateNote(noteId, { folderId })
      toast.success(`Note moved to "${folderName}"`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function getFolderNoteCount(folderId: string) {
    return notes.filter((n) => n.folderId === folderId && !n.isDeleted).length
  }

  return (
    <aside className={cn(
      "flex shrink-0 flex-col border-r border-hairline bg-canvas p-3 transition-[width] duration-200 dark:border-gray-800 dark:bg-dark-soft",
      collapsed ? "w-16" : "w-72",
    )}>
      <div className="mb-3 flex items-center justify-between gap-2">
        {!collapsed && <span className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Menu</span>}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="ml-auto rounded-md p-1.5 text-ink-muted transition hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated dark:hover:text-gray-100"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <button
        onClick={handleNewNote}
        className="mb-4 flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:scale-95"
        title="New Note"
      >
        <Plus size={16} /> {!collapsed && 'New Note'}
      </button>

      {!collapsed && <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Notes
      </div>}
      <nav className="flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
                collapsed && 'justify-center px-2',
                isActive && 'bg-primary/10 font-semibold text-primary dark:bg-primary/20 dark:text-primary',
              )
            }
            title={label}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && <div className="mt-6 flex flex-1 flex-col overflow-hidden">
        <div className="mb-2 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <span>Folders</span>
          <button
            onClick={handleNewFolder}
            aria-label="Add folder"
            className="rounded p-0.5 hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated dark:hover:text-gray-100"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-0.5 overflow-y-auto pr-1">
          {folders.map((f) => (
            <NavLink
              key={f.id}
              to={`/tools/notes/folder/${f.id}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverFolderId(f.id)
              }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => handleNoteDrop(e, f.id, f.name)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  type: 'folder',
                  targetId: f.id,
                  data: f,
                })
              }}
              className={({ isActive }) =>
                cn(
                  'group flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
                  isActive && 'bg-primary/10 font-semibold text-primary dark:bg-primary/20 dark:text-primary',
                  dragOverFolderId === f.id && 'border border-dashed border-primary bg-primary/5 animate-pulse',
                )
              }
            >
              <div className="flex items-center gap-2.5 truncate">
                <Folder size={16} className={cn('shrink-0 text-ink-muted', dragOverFolderId === f.id && 'text-primary')} />
                <span className="truncate">{f.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-canvas-soft px-1.5 py-0.5 text-xs font-medium text-ink-muted group-hover:bg-white dark:bg-dark-elevated dark:group-hover:bg-dark">
                  {getFolderNoteCount(f.id)}
                </span>
                <button
                  onClick={(e) => handleDeleteFolder(e, f.id, f.name)}
                  aria-label="Delete folder"
                  className="rounded p-0.5 text-ink-muted opacity-0 transition-all hover:bg-canvas-card hover:text-error group-hover:opacity-100 dark:hover:bg-dark-elevated"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </NavLink>
          ))}
          {folders.length === 0 && (
            <span className="px-3 py-2 text-xs italic text-ink-muted">No folders created</span>
          )}
        </div>
      </div>
      }
    </aside>
  )
}

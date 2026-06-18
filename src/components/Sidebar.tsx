import { NavLink } from 'react-router-dom'
import { FileText, Star, ListTodo, Trash2, Settings, Plus, Folder } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import { useUiStore } from '@/store/uiStore'
import { useAuth } from '@/hooks/useAuth'
import { createNote, updateNote } from '@/services/noteService'
import { useFolderStore } from '@/store/folderStore'
import { useNoteStore } from '@/store/noteStore'
import { createFolder, deleteFolder } from '@/services/folderService'
import { useState } from 'react'
import { confirmDialog, promptDialog } from '@/utils/dialog'

const links = [
  { to: '/', label: 'All Notes', icon: FileText, end: true },
  { to: '/favorites', label: 'Favorites', icon: Star, end: false },
  { to: '/tasks', label: 'Tasks', icon: ListTodo, end: false },
  { to: '/trash', label: 'Trash', icon: Trash2, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export default function Sidebar() {
  const { user } = useAuth()
  const open = useUiStore((s) => s.sidebarOpen)
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  
  const folders = useFolderStore((s) => s.folders)
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
      await createFolder(user.uid, name.trim())
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
      'Delete'
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

  if (!open) return null

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-hairline bg-canvas-soft p-3 dark:border-gray-800 dark:bg-dark transition-all duration-300">
      <button
        onClick={handleNewNote}
        className="mb-4 flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-white transition duration-200 hover:bg-primary-hover active:scale-95 shadow-sm"
      >
        <Plus size={16} /> New Note
      </button>

      {/* Main Nav Links */}
      <nav className="flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
                isActive && 'bg-primary/10 font-semibold text-primary dark:bg-primary/20 dark:text-primary',
              )
            }
          >
            <Icon size={18} className="transition-transform group-hover:scale-110 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Folders Section */}
      <div className="mt-6 flex flex-col flex-1 overflow-hidden">
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
              to={`/folder/${f.id}`}
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
                <Folder size={16} className={cn("text-ink-muted shrink-0", dragOverFolderId === f.id && "text-primary")} />
                <span className="truncate">{f.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="rounded-full bg-canvas px-1.5 py-0.5 text-xs text-ink-muted group-hover:bg-white dark:bg-dark-elevated dark:group-hover:bg-dark font-medium">
                  {getFolderNoteCount(f.id)}
                </span>
                <button
                  onClick={(e) => handleDeleteFolder(e, f.id, f.name)}
                  aria-label="Delete folder"
                  className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-error transition-all p-0.5 rounded hover:bg-canvas-card dark:hover:bg-dark-elevated"
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
    </aside>
  )
}

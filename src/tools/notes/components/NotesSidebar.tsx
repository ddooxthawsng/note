import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowDownUp, ChevronDown, ChevronRight, FileText, Folder, ListTodo, PanelLeftClose, PanelLeftOpen, Plus, Share2, Star, Trash2, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useUiStore } from '@/shared/store/uiStore'
import { cn } from '@/shared/utils/cn'
import { confirmDialog, promptDialog } from '@/shared/utils/dialog'
import { createFolder, deleteFolder, updateFolderPosition, updateFolderShare } from '@/tools/notes/services/folderService'
import { createNote, updateNote } from '@/tools/notes/services/noteService'
import { useFolderStore } from '@/tools/notes/store/folderStore'
import { useNoteStore } from '@/tools/notes/store/noteStore'
import CollaboratorPicker from '@/tools/notes/components/CollaboratorPicker'
import type { Folder as FolderType } from '@/tools/notes/types/folder'

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
  const [folderReorderEnabled, setFolderReorderEnabled] = useState(false)
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null)
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set())
  const [sharingFolderId, setSharingFolderId] = useState<string | null>(null)
  const sharingFolder: FolderType | undefined = folders.find((f) => f.id === sharingFolderId)

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

  async function handleNewFolder(parentId: string | null = null) {
    if (!user) return
    const name = await promptDialog('New Folder', 'Enter new folder name:')
    if (!name || !name.trim()) return
    try {
      const folder = await createFolder(user.uid, name.trim(), parentId, user.email)
      addFolder(folder)
      if (parentId) {
        setCollapsedFolderIds((ids) => {
          const next = new Set(ids)
          next.delete(parentId)
          return next
        })
      }
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

  function folderOrder(folder: (typeof folders)[number]) {
    return folder.order ?? folder.createdAt ?? 0
  }

  function isDescendant(folderId: string, ancestorId: string) {
    let current = folders.find((folder) => folder.id === folderId)
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true
      current = folders.find((folder) => folder.id === current?.parentId)
    }
    return false
  }

  async function handleFolderDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    e.stopPropagation()
    setFolderDropTargetId(null)
    if (!folderReorderEnabled) return

    const draggedId = e.dataTransfer.getData('application/x-folder-id')
    const dragged = folders.find((folder) => folder.id === draggedId)
    const target = folders.find((folder) => folder.id === targetId)
    if (!dragged || !target || dragged.id === target.id || isDescendant(target.id, dragged.id)) return

    const rect = e.currentTarget.getBoundingClientRect()
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    const siblings = folders
      .filter((folder) => folder.parentId === target.parentId && folder.id !== dragged.id)
      .sort((a, b) => folderOrder(a) - folderOrder(b))
    const targetIndex = siblings.findIndex((folder) => folder.id === target.id)
    if (targetIndex < 0) return

    const insertAt = targetIndex + (position === 'after' ? 1 : 0)
    const previous = siblings[insertAt - 1]
    const next = siblings[insertAt]
    const order = previous && next
      ? (folderOrder(previous) + folderOrder(next)) / 2
      : previous
        ? folderOrder(previous) + 1
        : next
          ? folderOrder(next) - 1
          : Date.now()

    try {
      await updateFolderPosition(dragged.id, target.parentId ?? null, order)
      toast.success('Folders reordered!')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  function getFolderNoteCount(folderId: string) {
    return notes.filter((n) => n.folderId === folderId && !n.isDeleted).length
  }

  const existingFolderIds = new Set(folders.map((folder) => folder.id))
  const rootFolders = folders.filter((folder) => !folder.parentId || !existingFolderIds.has(folder.parentId))

  function renderFolder(folder: (typeof folders)[number], depth = 0): React.ReactNode {
    const children = folders.filter((item) => item.parentId === folder.id)
    const collapsed = collapsedFolderIds.has(folder.id)
    return (
      <div key={folder.id}>
        <div
          className={cn(
            'group flex items-center rounded-md text-sm text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
            dragOverFolderId === folder.id && 'border border-dashed border-primary bg-primary/5 animate-pulse',
            folderDropTargetId === folder.id && 'border-2 border-dashed border-primary bg-primary/5',
            folderReorderEnabled && 'cursor-grab',
          )}
          style={{ paddingLeft: `${depth * 14}px` }}
          draggable={folderReorderEnabled}
          onDragStart={(e) => {
            if (!folderReorderEnabled) return
            e.dataTransfer.setData('application/x-folder-id', folder.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => setFolderDropTargetId(null)}
          onDragOver={(e) => {
            const types = Array.from(e.dataTransfer.types)
            if (folderReorderEnabled && types.includes('application/x-folder-id')) {
              e.preventDefault()
              e.stopPropagation()
              setFolderDropTargetId(folder.id)
            } else if (!types.includes('application/x-folder-id')) {
              e.preventDefault()
              setDragOverFolderId(folder.id)
            }
          }}
          onDragLeave={() => {
            setDragOverFolderId(null)
            setFolderDropTargetId(null)
          }}
          onDrop={(e) => {
            if (e.dataTransfer.types.includes('application/x-folder-id')) {
              void handleFolderDrop(e, folder.id)
            } else {
              void handleNoteDrop(e, folder.id, folder.name)
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', targetId: folder.id, data: folder })
          }}
        >
          <button
            type="button"
            onClick={() => setCollapsedFolderIds((ids) => {
              const next = new Set(ids)
              next.has(folder.id) ? next.delete(folder.id) : next.add(folder.id)
              return next
            })}
            aria-label={collapsed ? 'Expand folder' : 'Collapse folder'}
            className={cn('shrink-0 rounded p-1 text-ink-muted', children.length === 0 && 'invisible')}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <NavLink
            to={`/tools/notes/folder/${folder.id}`}
            className={({ isActive }) => cn(
              'flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5',
              isActive && 'bg-primary/10 font-semibold text-primary dark:bg-primary/20 dark:text-primary',
            )}
          >
            <Folder size={16} className={cn('shrink-0 text-ink-muted', dragOverFolderId === folder.id && 'text-primary')} />
            <span className="truncate">{folder.name}</span>
            {((folder.sharedWith?.length ?? 0) > 0 || (user && folder.userId !== user.uid)) && (
              <Users size={12} className="shrink-0 text-primary" aria-label="Shared folder" />
            )}
          </NavLink>
          <span className="rounded-full bg-canvas-soft px-1.5 py-0.5 text-xs font-medium text-ink-muted dark:bg-dark-elevated">
            {getFolderNoteCount(folder.id)}
          </span>
          <button
            type="button"
            onClick={() => setSharingFolderId(folder.id)}
            aria-label={`Share folder ${folder.name}`}
            title="Chia sẻ thư mục"
            className={cn(
              'rounded p-1 transition hover:text-primary',
              (folder.sharedWith?.length ?? 0) > 0 ? 'text-primary opacity-100' : 'text-ink-muted opacity-0 group-hover:opacity-100',
            )}
          >
            <Share2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => handleNewFolder(folder.id)}
            aria-label={`Add subfolder to ${folder.name}`}
            title="Add subfolder"
            className="rounded p-1 text-ink-muted opacity-60 transition hover:text-primary hover:opacity-100"
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
            aria-label="Delete folder"
            className="rounded p-1 text-ink-muted opacity-0 transition hover:text-error group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
        {!collapsed && children.map((child) => renderFolder(child, depth + 1))}
      </div>
    )
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFolderReorderEnabled((enabled) => !enabled)}
              aria-label={folderReorderEnabled ? 'Finish reordering folders' : 'Reorder folders'}
              aria-pressed={folderReorderEnabled}
              title={folderReorderEnabled ? 'Finish reordering folders' : 'Reorder folders'}
              className={cn(
                'rounded p-0.5 transition hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated dark:hover:text-gray-100',
                folderReorderEnabled && 'bg-primary/15 text-primary',
              )}
            >
              <ArrowDownUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleNewFolder()}
              aria-label="Add folder"
              className="rounded p-0.5 hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated dark:hover:text-gray-100"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 overflow-y-auto pr-1">
          {rootFolders.map((folder) => renderFolder(folder))}
          {folders.length === 0 && (
            <span className="px-3 py-2 text-xs italic text-ink-muted">No folders created</span>
          )}
        </div>
      </div>
      }

      {sharingFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setSharingFolderId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-hairline bg-canvas/95 p-5 shadow-2xl backdrop-blur-xl dark:border-gray-800 dark:bg-dark-elevated/95 animate-scale-in"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 truncate font-serif text-lg font-medium text-ink dark:text-gray-100">
                  <Share2 size={18} className="shrink-0 text-primary" />
                  Chia sẻ thư mục: {sharingFolder.name}
                </h3>
                <p className="text-xs text-ink-muted">
                  Tất cả ghi chú trong thư mục này sẽ được đồng bộ chia sẻ cho người được chọn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSharingFolderId(null)}
                className="rounded-md p-1 text-ink-muted hover:bg-canvas-card dark:hover:bg-dark"
              >
                <X size={16} />
              </button>
            </div>

            <CollaboratorPicker
              sharedWith={sharingFolder.sharedWith ?? []}
              canEdit={sharingFolder.userId === user?.uid}
              onChange={async (nextEmails) => {
                try {
                  await updateFolderShare(sharingFolder.id, nextEmails, user?.email)
                  toast.success('Đã cập nhật chia sẻ thư mục!')
                } catch (err) {
                  toast.error((err as Error).message)
                }
              }}
              emptyText="Thư mục chưa chia sẻ với ai. Chọn từ danh sách tài khoản đã duyệt ở trên."
            />
          </div>
        </div>
      )}
    </aside>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/store/uiStore'
import { useFolderStore } from '@/store/folderStore'
import { togglePin, toggleFavorite, softDeleteNote, updateNote, restoreNote, permanentDeleteNote } from '@/services/noteService'
import { deleteFolder, updateFolder } from '@/services/folderService'
import { Edit3, Pin, Star, Trash2, Folder, ChevronRight, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmDialog, promptDialog } from '@/utils/dialog'

export default function ContextMenu() {
  const contextMenu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)
  const folders = useFolderStore((s) => s.folders)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [showSubmenu, setShowSubmenu] = useState(false)

  useEffect(() => {
    if (!contextMenu) return
    
    // Set position and check screen boundaries
    const menuWidth = 220
    const menuHeight = 250
    let posX = contextMenu.x
    let posY = contextMenu.y

    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 10
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 10
    }

    setCoords({ x: Math.max(10, posX), y: Math.max(10, posY) })
    setShowSubmenu(false)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return

    function handleClose() {
      setContextMenu(null)
    }

    document.addEventListener('click', handleClose)
    document.addEventListener('contextmenu', handleClose)
    return () => {
      document.removeEventListener('click', handleClose)
      document.removeEventListener('contextmenu', handleClose)
    }
  }, [contextMenu, setContextMenu])

  if (!contextMenu) return null

  const { type, targetId, data } = contextMenu

  async function handleAction(fn: () => Promise<void>, successMsg: string) {
    try {
      await fn()
      toast.success(successMsg)
    } catch (e) {
      toast.error((e as Error).message)
    }
    setContextMenu(null)
  }

  function handleEdit() {
    if (type === 'note') {
      setEditingNoteId(targetId)
    }
    setContextMenu(null)
  }

  async function handleRenameFolder() {
    if (type !== 'folder' || !data?.name) return
    const newName = await promptDialog('Rename Folder', 'Rename folder to:', data.name)
    if (!newName || !newName.trim() || newName.trim() === data.name) {
      setContextMenu(null)
      return
    }
    await handleAction(() => updateFolder(targetId, newName.trim()), 'Folder renamed')
  }

  async function handleDeleteFolder() {
    if (type !== 'folder') return
    const confirmed = await confirmDialog(
      'Delete Folder',
      `Are you sure you want to delete folder "${data?.name}"? Notes in it will be preserved.`,
      'Delete'
    )
    if (!confirmed) {
      setContextMenu(null)
      return
    }
    await handleAction(() => deleteFolder(targetId), 'Folder deleted')
  }

  return (
    <div
      ref={menuRef}
      style={{ top: coords.y, left: coords.x }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 animate-fade-in rounded-xl border border-gray-200/50 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-gray-800/50 dark:bg-gray-900/95 select-none"
    >
      {type === 'note' && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleEdit}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
          >
            <Edit3 size={15} /> Edit Note
          </button>
          
          <button
            onClick={() => handleAction(() => togglePin(targetId, !data?.isPinned), data?.isPinned ? 'Unpinned' : 'Pinned')}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
          >
            <Pin size={15} className={data?.isPinned ? 'fill-primary text-primary' : ''} /> 
            {data?.isPinned ? 'Unpin Note' : 'Pin Note'}
          </button>

          <button
            onClick={() => handleAction(() => toggleFavorite(targetId, !data?.isFavorite), data?.isFavorite ? 'Removed from favorites' : 'Added to favorites')}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
          >
            <Star size={15} className={data?.isFavorite ? 'fill-warning text-warning' : ''} /> 
            {data?.isFavorite ? 'Unfavorite' : 'Favorite'}
          </button>

          {/* Move to folder submenu */}
          <div
            className="relative"
            onMouseEnter={() => setShowSubmenu(true)}
            onMouseLeave={() => setShowSubmenu(false)}
          >
            <button
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
            >
              <div className="flex items-center gap-2">
                <Folder size={15} /> Move to folder
              </div>
              <ChevronRight size={14} className="text-gray-400" />
            </button>
            {showSubmenu && (
              <div className="absolute left-full top-0 ml-1 w-48 rounded-xl border border-gray-200/50 bg-white/95 p-1 shadow-lg backdrop-blur-md dark:border-gray-800/50 dark:bg-gray-900/95">
                <button
                  onClick={() => handleAction(() => updateNote(targetId, { folderId: null }), 'Moved to root')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
                >
                  No folder (Unassign)
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleAction(() => updateNote(targetId, { folderId: f.id }), `Moved to ${f.name}`)}
                    className="flex w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
                  >
                    <Folder size={12} className="shrink-0 text-gray-400" />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

          <button
            onClick={() => handleAction(() => softDeleteNote(targetId), 'Moved to Trash')}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-error hover:bg-error/5"
          >
            <Trash2 size={15} /> Move to Trash
          </button>
        </div>
      )}

      {type === 'folder' && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleRenameFolder}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-880"
          >
            <Edit3 size={15} /> Rename Folder
          </button>
          
          <button
            onClick={handleDeleteFolder}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-error hover:bg-error/5"
          >
            <Trash2 size={15} /> Delete Folder
          </button>
        </div>
      )}

      {type === 'trash-note' && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => handleAction(() => restoreNote(targetId), 'Restored note')}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-primary hover:bg-primary/5"
          >
            <RotateCcw size={15} /> Restore Note
          </button>
          
          <button
            onClick={async () => {
              const confirmed = await confirmDialog('Delete Note', 'Permanently delete this note? This cannot be undone.', 'Delete')
              if (confirmed) {
                handleAction(() => permanentDeleteNote(targetId), 'Deleted permanently')
              } else {
                setContextMenu(null)
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-error hover:bg-error/5"
          >
            <Trash2 size={15} /> Delete Permanently
          </button>
        </div>
      )}
    </div>
  )
}

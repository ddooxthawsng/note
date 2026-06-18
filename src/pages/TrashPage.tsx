import { useEffect, useState } from 'react'
import { RotateCcw, Trash2, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  subscribeToTrash,
  restoreNote,
  permanentDeleteNote,
} from '@/services/noteService'
import type { Note } from '@/types/note'
import { useUiStore } from '@/store/uiStore'
import { confirmDialog } from '@/utils/dialog'

export default function TrashPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const setContextMenu = useUiStore((s) => s.setContextMenu)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToTrash(
      user.uid,
      (n) => {
        setNotes(n)
        setLoading(false)
      },
      (e) => {
        toast.error(e.message)
        setLoading(false)
      },
    )
    return unsub
  }, [user])

  async function handleRestore(id: string) {
    try {
      await restoreNote(id)
      toast.success('Restored')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handlePurge(id: string) {
    const confirmed = await confirmDialog('Delete Note', 'Permanently delete this note? This cannot be undone.', 'Delete')
    if (!confirmed) return
    try {
      await permanentDeleteNote(id)
      toast.success('Deleted permanently')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Trash</h1>
      <p className="mb-6 text-sm text-gray-500">
        Deleted notes. Restore them, or remove permanently.
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Trash2 size={48} className="mb-3 opacity-50" />
          <p className="text-lg font-medium">Trash is empty</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {notes.map((n) => (
            <li
              key={n.id}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  type: 'trash-note',
                  targetId: n.id,
                  data: n,
                })
              }}
              className="flex items-center gap-3 p-3 cursor-context-menu hover:bg-gray-50 dark:hover:bg-gray-850"
            >
              <FileText size={18} className="shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{n.title || 'Untitled Note'}</p>
                <p className="text-xs text-gray-400">
                  Deleted {n.deletedAt ? formatDistanceToNow(n.deletedAt, { addSuffix: true }) : ''}
                </p>
              </div>
              <button
                onClick={() => handleRestore(n.id)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
              >
                <RotateCcw size={15} /> Restore
              </button>
              <button
                onClick={() => handlePurge(n.id)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-error hover:bg-error/10"
              >
                <Trash2 size={15} /> Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

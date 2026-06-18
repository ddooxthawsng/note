import type { Note } from '@/types/note'
import NoteCard from './NoteCard'
import { FileText, Pin } from 'lucide-react'
import { togglePin } from '@/services/noteService'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'

export default function NotesList({
  notes,
  loading,
  emptyHint,
}: {
  notes: Note[]
  loading: boolean
  emptyHint?: string
}) {
  const isDraggingNote = useUiStore((s) => s.isDraggingNote)
  const [dragOverSection, setDragOverSection] = useState<'pinned' | 'others' | null>(null)

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-hairline bg-canvas-card/60 dark:border-gray-800 dark:bg-dark-elevated/50"
          />
        ))}
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-ink-muted">
        <FileText size={48} className="mb-3 opacity-50 text-ink-muted" />
        <p className="text-lg font-medium text-ink dark:text-gray-100">No notes yet</p>
        <p className="text-sm">{emptyHint ?? 'Click "New Note" to create your first note.'}</p>
      </div>
    )
  }

  const pinnedNotes = notes.filter((n) => n.isPinned)
  const otherNotes = notes.filter((n) => !n.isPinned)

  async function handleDrop(e: React.DragEvent, isPinnedTarget: boolean) {
    e.preventDefault()
    setDragOverSection(null)
    const noteId = e.dataTransfer.getData('text/plain')
    if (!noteId) return

    const noteObj = notes.find((n) => n.id === noteId)
    if (!noteObj || noteObj.isPinned === isPinnedTarget) return

    try {
      await togglePin(noteId, isPinnedTarget)
      toast.success(isPinnedTarget ? 'Pinned note' : 'Unpinned note')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-full">
      {/* Pinned Section */}
      {(pinnedNotes.length > 0 || isDraggingNote) && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverSection('pinned')
          }}
          onDragLeave={() => setDragOverSection(null)}
          onDrop={(e) => handleDrop(e, true)}
          className={cn(
            "rounded-xl p-3 transition-all duration-200 border border-transparent min-h-[60px]",
            dragOverSection === 'pinned' && "border-dashed border-primary bg-primary/5 scale-[1.005]",
            pinnedNotes.length === 0 && isDraggingNote && "border-dashed border-hairline bg-canvas-soft dark:border-gray-800 dark:bg-dark-elevated/40"
          )}
        >
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <Pin size={13} className="text-primary fill-primary/10" />
            <span>Pinned</span>
          </div>
          
          {pinnedNotes.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center text-xs font-medium text-ink-muted/80">
              Drag and drop note card here to Pin
            </div>
          )}
        </div>
      )}

      {/* Others Section */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOverSection('others')
        }}
        onDragLeave={() => setDragOverSection(null)}
        onDrop={(e) => handleDrop(e, false)}
        className={cn(
          "rounded-xl p-3 transition-all duration-200 border border-transparent flex-1 flex flex-col min-h-[250px]",
          dragOverSection === 'others' && "border-dashed border-primary bg-primary/5 scale-[1.005]"
        )}
      >
        {pinnedNotes.length > 0 && (
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <span>Others</span>
          </div>
        )}

        {otherNotes.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {otherNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : pinnedNotes.length > 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs font-medium text-ink-muted/80 border border-dashed border-hairline dark:border-gray-800 rounded-xl min-h-[100px]">
            Drag here to unpin notes
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

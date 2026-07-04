import type { Note } from '@/tools/notes/types/note'
import NoteCard, { type NoteViewMode } from './NoteCard'
import { FileText, Pin } from 'lucide-react'
import { togglePin } from '@/tools/notes/services/noteService'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useUiStore } from '@/shared/store/uiStore'
import { cn } from '@/shared/utils/cn'

export default function NotesList({
  notes,
  loading,
  emptyHint,
  viewMode = 'normal',
  columns = 3,
}: {
  notes: Note[]
  loading: boolean
  emptyHint?: string
  viewMode?: NoteViewMode
  columns?: number
}) {
  const isDraggingNote = useUiStore((s) => s.isDraggingNote)
  const [dragOverSection, setDragOverSection] = useState<'pinned' | 'others' | null>(null)
  const gridClass = viewMode === 'title' ? "grid gap-2" : "grid gap-3"
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  if (loading) {
    return (
      <div className={gridClass} style={gridStyle}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn("animate-pulse rounded-xl border border-hairline bg-canvas-card/60 dark:border-gray-800 dark:bg-dark-elevated/50", viewMode === 'title' ? "h-14" : "h-40")}
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
    <div className="space-y-5">
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
            "flow-root rounded-xl p-2 transition-all duration-200 border border-transparent min-h-[60px]",
            dragOverSection === 'pinned' && "border-dashed border-primary bg-primary/5 scale-[1.005]",
            pinnedNotes.length === 0 && isDraggingNote && "border-dashed border-hairline bg-canvas-soft dark:border-gray-800 dark:bg-dark-elevated/40"
          )}
        >
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <Pin size={13} className="text-primary fill-primary/10" />
            <span>Pinned</span>
          </div>
          
          {pinnedNotes.length > 0 ? (
            <div className={gridClass} style={gridStyle}>
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} viewMode={viewMode} />
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
          "flow-root rounded-xl p-2 transition-all duration-200 border border-transparent min-h-[250px]",
          dragOverSection === 'others' && "border-dashed border-primary bg-primary/5 scale-[1.005]"
        )}
      >
        {pinnedNotes.length > 0 && (
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <span>Others</span>
          </div>
        )}

        {otherNotes.length > 0 ? (
          <div className={gridClass} style={gridStyle}>
            {otherNotes.map((note) => (
              <NoteCard key={note.id} note={note} viewMode={viewMode} />
            ))}
          </div>
        ) : pinnedNotes.length > 0 ? (
          <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-hairline text-xs font-medium text-ink-muted/80 dark:border-gray-800">
            Drag here to unpin notes
          </div>
        ) : (
          <div className={gridClass} style={gridStyle}>
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

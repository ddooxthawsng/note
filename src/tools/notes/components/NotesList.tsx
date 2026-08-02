import type { Note } from '@/tools/notes/types/note'
import NoteCard, { type NoteViewMode } from './NoteCard'
import { FileText, Pin } from 'lucide-react'
import { saveNotesOrder } from '@/tools/notes/services/noteService'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useNoteStore } from '@/tools/notes/store/noteStore'
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
  const [dragOverSection, setDragOverSection] = useState<'pinned' | 'others' | null>(null)
  const gridClass = viewMode === 'title' ? "grid gap-2" : "grid gap-3"
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
  const dropAxis = viewMode === 'title' || columns === 1 ? 'vertical' : 'horizontal'

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

  function noteOrder(note: Note) {
    return note.order ?? note.updatedAt ?? note.createdAt ?? 0
  }

  async function persistOrder(orderedNotes: Note[]) {
    const ranks = notes.map(noteOrder).sort((a, b) => b - a)
    for (let index = 1; index < ranks.length; index += 1) {
      if (ranks[index] >= ranks[index - 1]) ranks[index] = ranks[index - 1] - 0.001
    }
    await saveNotesOrder(orderedNotes.map((note, index) => ({
      id: note.id,
      order: ranks[index],
      isPinned: note.isPinned,
    })))
    useNoteStore.getState().setSortBy('custom')
  }

  async function moveNote(
    draggedId: string,
    targetId: string | null,
    position: 'before' | 'after',
    targetPinned: boolean,
  ) {
    const dragged = notes.find((note) => note.id === draggedId)
    if (!dragged) return

    const reordered = notes.filter((note) => note.id !== draggedId)
    const moved = { ...dragged, isPinned: targetPinned }
    let insertAt: number
    if (targetId) {
      const targetIndex = reordered.findIndex((note) => note.id === targetId)
      if (targetIndex < 0) return
      insertAt = targetIndex + (position === 'after' ? 1 : 0)
    } else if (targetPinned) {
      insertAt = reordered.filter((note) => note.isPinned).length
    } else {
      insertAt = reordered.length
    }
    reordered.splice(insertAt, 0, moved)

    try {
      await persistOrder(reordered)
      toast.success(targetPinned !== dragged.isPinned
        ? targetPinned ? 'Pinned note' : 'Unpinned note'
        : 'Notes reordered!')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleSectionDrop(e: React.DragEvent, isPinnedTarget: boolean) {
    e.preventDefault()
    setDragOverSection(null)
    const noteId = e.dataTransfer.getData('application/x-note-id') || e.dataTransfer.getData('text/plain')
    if (!noteId) return
    await moveNote(noteId, null, 'after', isPinnedTarget)
  }

  const renderNote = (note: Note) => (
    <NoteCard
      key={note.id}
      note={note}
      viewMode={viewMode}
      dropAxis={dropAxis}
      onNoteDrop={(draggedId, targetId, position) => moveNote(
        draggedId,
        targetId,
        position,
        note.isPinned,
      )}
    />
  )

  return (
    <div className="space-y-5">
      {/* Pinned Section */}
      {pinnedNotes.length > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverSection('pinned')
          }}
          onDragLeave={() => setDragOverSection(null)}
          onDrop={(e) => handleSectionDrop(e, true)}
          className={cn(
            "flow-root rounded-xl p-2 transition-all duration-200 border border-transparent min-h-[60px]",
            dragOverSection === 'pinned' && "border-dashed border-primary bg-primary/5 scale-[1.005]",
          )}
        >
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <Pin size={13} className="text-primary fill-primary/10" />
            <span>Pinned</span>
          </div>
          
          <div className={gridClass} style={gridStyle}>
            {pinnedNotes.map(renderNote)}
          </div>
        </div>
      )}

      {/* Others Section */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOverSection('others')
        }}
        onDragLeave={() => setDragOverSection(null)}
        onDrop={(e) => handleSectionDrop(e, false)}
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
            {otherNotes.map(renderNote)}
          </div>
        ) : pinnedNotes.length > 0 ? (
          <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-hairline text-xs font-medium text-ink-muted/80 dark:border-gray-800">
            Drag here to unpin notes
          </div>
        ) : (
          <div className={gridClass} style={gridStyle}>
            {notes.map(renderNote)}
          </div>
        )}
      </div>
    </div>
  )
}

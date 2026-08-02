import { Paperclip, Pin, Star, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import type { Note } from '@/tools/notes/types/note'
import { cn } from '@/shared/utils/cn'
import { softDeleteNote, togglePin, toggleFavorite } from '@/tools/notes/services/noteService'
import { useUiStore } from '@/shared/store/uiStore'
import { useState } from 'react'

export type NoteViewMode = 'normal' | 'title'

function preview(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const cardColors: Record<string, string> = {
  red: 'bg-[#fce8e6] border-[#fad2cf] text-[#c5221f] dark:bg-[#3c2422] dark:border-[#5f2e2a] dark:text-[#f28b82]',
  amber: 'bg-[#fef3d6] border-[#feebb7] text-[#b06000] dark:bg-[#3d2f1f] dark:border-[#624a2f] dark:text-[#fdd663]',
  teal: 'bg-[#e6f4ea] border-[#ceead6] text-[#137333] dark:bg-[#223328] dark:border-[#2c4e38] dark:text-[#81c995]',
  blue: 'bg-[#e8f0fe] border-[#d2e3fc] text-[#1a73e8] dark:bg-[#202d3d] dark:border-[#293d56] dark:text-[#8ab4f8]',
  purple: 'bg-[#f3e8fd] border-[#ebd4fc] text-[#a800d7] dark:bg-[#30203d] dark:border-[#422d56] dark:text-[#d7aefb]',
}

type DropPosition = 'before' | 'after'

export default function NoteCard({
  note,
  viewMode = 'normal',
  dropAxis = 'horizontal',
  onNoteDrop,
}: {
  note: Note
  viewMode?: NoteViewMode
  dropAxis?: 'horizontal' | 'vertical'
  onNoteDrop: (draggedId: string, targetId: string, position: DropPosition) => Promise<void>
}) {
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null)
  const titleOnly = viewMode === 'title'

  async function withCatch(fn: () => Promise<void>) {
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div
      onClick={() => setEditingNoteId(note.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          type: 'note',
          targetId: note.id,
          data: note,
        })
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', note.id)
        e.dataTransfer.setData('application/x-note-id', note.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer.types)
        if (!types.includes('application/x-note-id') && !types.includes('text/plain')) return
        e.preventDefault()
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        const before = dropAxis === 'vertical'
          ? e.clientY < rect.top + rect.height / 2
          : e.clientX < rect.left + rect.width / 2
        setDropPosition(before ? 'before' : 'after')
      }}
      onDragLeave={() => {
        setDropPosition(null)
      }}
      onDrop={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        const position: DropPosition = (dropAxis === 'vertical'
          ? e.clientY < rect.top + rect.height / 2
          : e.clientX < rect.left + rect.width / 2)
          ? 'before'
          : 'after'
        setDropPosition(null)

        const draggedId = e.dataTransfer.getData('application/x-note-id') || e.dataTransfer.getData('text/plain')
        if (!draggedId || draggedId === note.id) return
        await onNoteDrop(draggedId, note.id, position)
      }}
      className={cn(
        'group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border transition duration-200 hover:shadow-sm hover:scale-[1.01] active:scale-[0.99] animate-fade-in-up select-none',
        titleOnly ? 'h-12 p-3' : 'h-32 p-3.5',
        note.color
          ? cardColors[note.color] || 'border-hairline bg-canvas-card dark:border-gray-800 dark:bg-dark-elevated'
          : 'border-hairline bg-canvas-card dark:border-gray-800 dark:bg-dark-elevated hover:border-primary/60 dark:hover:border-primary/60',
        dropPosition && 'border-primary bg-primary/5 scale-[1.02]',
        dropPosition === 'before' && dropAxis === 'horizontal' && 'border-l-4 border-l-primary',
        dropPosition === 'after' && dropAxis === 'horizontal' && 'border-r-4 border-r-primary',
        dropPosition === 'before' && dropAxis === 'vertical' && 'border-t-4 border-t-primary',
        dropPosition === 'after' && dropAxis === 'vertical' && 'border-b-4 border-b-primary',
      )}
    >
      <div className={cn('flex items-start justify-between gap-2', !titleOnly && 'mb-1.5')}>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {note.isPinned && <Pin size={14} className="shrink-0 fill-primary/10 text-primary" />}
          <h3
            title={note.title || 'Untitled Note'}
            className="overflow-hidden break-words font-serif text-[17px] font-medium text-ink dark:text-gray-100"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 1,
            }}
          >
            {note.title || 'Untitled Note'}
          </h3>
        </div>

        <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
          <button
            aria-label="Pin"
            onClick={(e) => {
              e.stopPropagation()
              withCatch(() => togglePin(note.id, !note.isPinned))
            }}
            className={cn('rounded p-1 hover:bg-canvas dark:hover:bg-dark', note.isPinned && 'text-primary')}
          >
            <Pin size={15} />
          </button>
          <button
            aria-label="Favorite"
            onClick={(e) => {
              e.stopPropagation()
              withCatch(() => toggleFavorite(note.id, !note.isFavorite))
            }}
            className={cn('rounded p-1 hover:bg-canvas dark:hover:bg-dark', note.isFavorite && 'text-warning')}
          >
            <Star size={15} />
          </button>
          <button
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation()
              withCatch(async () => {
                await softDeleteNote(note.id)
                toast.success('Moved to trash')
              })
            }}
            className="rounded p-1 text-ink-muted hover:bg-canvas hover:text-error dark:hover:bg-dark"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {!titleOnly && (
        <>
          <p
            title={preview(note.content)}
            className="mb-3 flex-1 overflow-hidden break-words text-sm text-ink-muted dark:text-gray-400"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {preview(note.content) || 'No content yet...'}
          </p>

          <div className="flex items-center justify-between text-xs text-ink-muted/80 dark:text-gray-500">
            <span>
              {note.updatedAt
                ? formatDistanceToNow(note.updatedAt, { addSuffix: true })
                : 'just now'}
            </span>
            <span className="flex items-center gap-2">
              {!!note.attachments?.length && <span className="flex items-center gap-1"><Paperclip size={12} />{note.attachments.length}</span>}
              <span>{note.wordCount} words</span>
            </span>
          </div>

          {note.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {note.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full border border-hairline/80 bg-canvas px-2.5 py-0.5 text-[11px] font-medium text-ink-muted dark:border-gray-800 dark:bg-dark">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

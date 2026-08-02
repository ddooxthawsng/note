import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileText, RotateCcw, Search, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import {
  permanentDeleteNote,
  restoreNote,
  subscribeToTrash,
} from '@/tools/notes/services/noteService'
import type { Note } from '@/tools/notes/types/note'
import { useUiStore } from '@/shared/store/uiStore'
import { confirmDialog } from '@/shared/utils/dialog'

function plainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function TrashPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const setContextMenu = useUiStore((s) => s.setContextMenu)

  useEffect(() => {
    if (!user) return
    return subscribeToTrash(
      user.uid,
      (nextNotes) => {
        setNotes(nextNotes)
        setSelected((current) => {
          const available = new Set(nextNotes.map((note) => note.id))
          return new Set([...current].filter((id) => available.has(id)))
        })
        setLoading(false)
      },
      (error) => {
        toast.error(error.message)
        setLoading(false)
      },
    )
  }, [user])

  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return [...notes]
      .filter((note) => !needle || `${note.title} ${plainText(note.content)}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  }, [notes, query])

  const allVisibleSelected = visibleNotes.length > 0 && visibleNotes.every((note) => selected.has(note.id))

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleNotes.forEach((note) => next.delete(note.id))
      else visibleNotes.forEach((note) => next.add(note.id))
      return next
    })
  }

  async function restore(ids: string[]) {
    if (!ids.length || busy) return
    setBusy(true)
    const results = await Promise.allSettled(ids.map(restoreNote))
    const restored = results.filter((result) => result.status === 'fulfilled').length
    const failed = results.length - restored
    if (restored) toast.success(`${restored} note${restored === 1 ? '' : 's'} restored`)
    if (failed) toast.error(`${failed} note${failed === 1 ? '' : 's'} could not be restored`)
    setBusy(false)
  }

  async function purge(ids: string[], emptyTrash = false) {
    if (!ids.length || busy) return
    const confirmed = await confirmDialog(
      emptyTrash ? 'Empty Trash' : 'Delete Permanently',
      `Permanently delete ${ids.length} note${ids.length === 1 ? '' : 's'} and their attachments? This cannot be undone.`,
      emptyTrash ? 'Empty Trash' : 'Delete',
    )
    if (!confirmed) return

    setBusy(true)
    const results = await Promise.allSettled(ids.map(permanentDeleteNote))
    const deleted = results.filter((result) => result.status === 'fulfilled').length
    const failed = results.length - deleted
    if (deleted) toast.success(`${deleted} note${deleted === 1 ? '' : 's'} permanently deleted`)
    if (failed) toast.error(`${failed} note${failed === 1 ? '' : 's'} could not be deleted`)
    setBusy(false)
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 overflow-hidden rounded-2xl border border-hairline bg-canvas-card shadow-sm dark:border-gray-800 dark:bg-dark-elevated">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-error/10 text-error">
              <Trash2 size={23} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl text-ink dark:text-gray-100">Trash</h1>
                {!loading && <span className="rounded-full bg-canvas-soft px-2 py-0.5 text-xs font-semibold text-ink-muted dark:bg-dark">{notes.length}</span>}
              </div>
              <p className="mt-1 text-sm text-ink-muted">Restore notes or permanently remove them with their attachments.</p>
            </div>
          </div>
          {notes.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => purge(notes.map((note) => note.id), true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-error/25 px-3.5 py-2 text-sm font-semibold text-error transition hover:bg-error/10 disabled:opacity-50"
            >
              <Trash2 size={15} /> Empty Trash
            </button>
          )}
        </div>

        {notes.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-hairline bg-canvas-soft/55 px-5 py-3 dark:border-gray-800 dark:bg-dark/30 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search deleted notes..."
                className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-primary dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-200"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-body dark:text-gray-300">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 accent-primary" />
              Select visible
            </label>
          </div>
        )}
      </header>

      {selected.size > 0 && (
        <div className="sticky top-3 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-canvas/95 px-4 py-3 shadow-lg backdrop-blur dark:bg-dark-elevated/95">
          <span className="text-sm font-semibold text-ink dark:text-gray-100">{selected.size} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => restore([...selected])} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50">
              <RotateCcw size={14} /> Restore
            </button>
            <button type="button" onClick={() => purge([...selected])} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-error/25 px-3 py-1.5 text-sm font-semibold text-error transition hover:bg-error/10 disabled:opacity-50">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-canvas-card dark:bg-dark-elevated" />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-canvas-card/40 px-6 text-center dark:border-gray-800 dark:bg-dark-elevated/30">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-canvas-soft text-ink-muted dark:bg-dark">
            <Trash2 size={30} />
          </div>
          <p className="font-serif text-xl text-ink dark:text-gray-100">Trash is empty</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">Deleted notes will appear here so you can restore them before permanent deletion.</p>
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline py-20 text-center text-ink-muted dark:border-gray-800">
          <Search size={28} className="mx-auto mb-3 opacity-60" />
          <p className="font-medium">No deleted notes match “{query}”</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleNotes.map((note) => {
            const preview = plainText(note.content)
            const checked = selected.has(note.id)
            return (
              <article
                key={note.id}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setContextMenu({ x: event.clientX, y: event.clientY, type: 'trash-note', targetId: note.id, data: note })
                }}
                className={`group relative flex min-h-36 flex-col rounded-2xl border p-4 transition ${checked ? 'border-primary bg-primary/5 shadow-sm' : 'border-hairline bg-canvas-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-gray-800 dark:bg-dark-elevated'}`}
              >
                <div className="flex items-start gap-3">
                  <input aria-label={`Select ${note.title || 'Untitled Note'}`} type="checkbox" checked={checked} onChange={() => toggleSelected(note.id)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-canvas-soft text-ink-muted dark:bg-dark"><FileText size={17} /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-serif text-lg text-ink dark:text-gray-100">{note.title || 'Untitled Note'}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-ink-muted">{preview || 'No text content'}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
                  <div className="text-xs text-ink-muted">
                    <p>{note.deletedAt ? `Deleted ${formatDistanceToNow(note.deletedAt, { addSuffix: true })}` : 'Deletion time unavailable'}</p>
                    {note.deletedAt && <p className="mt-0.5 opacity-70">{format(note.deletedAt, 'PPp')}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" title="Restore note" disabled={busy} onClick={() => restore([note.id])} className="rounded-lg p-2 text-primary transition hover:bg-primary/10 disabled:opacity-50"><RotateCcw size={16} /></button>
                    <button type="button" title="Delete permanently" disabled={busy} onClick={() => purge([note.id])} className="rounded-lg p-2 text-error transition hover:bg-error/10 disabled:opacity-50"><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-ink-muted">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
          Permanent deletion also removes Telegram attachment metadata. This action cannot be undone.
        </div>
      )}
    </div>
  )
}

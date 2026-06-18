import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Note, NoteDoc } from '@/types/note'
import { NotebookPen, Loader2, FileWarning } from 'lucide-react'
import { cn } from '@/utils/cn'

const cardColors: Record<string, string> = {
  red: 'bg-[#fdf2f0] border-[#fad2cf] text-[#c5221f] dark:bg-[#291615] dark:border-[#5f2e2a] dark:text-[#f28b82]',
  amber: 'bg-[#fefaf0] border-[#feebb7] text-[#b06000] dark:bg-[#2a2015] dark:border-[#624a2f] dark:text-[#fdd663]',
  teal: 'bg-[#f0faf2] border-[#ceead6] text-[#137333] dark:bg-[#15291a] dark:border-[#2c4e38] dark:text-[#81c995]',
  blue: 'bg-[#f0f4fa] border-[#d2e3fc] text-[#1a73e8] dark:bg-[#202d3d] dark:border-[#293d56] dark:text-[#8ab4f8]',
  purple: 'bg-[#faf0ff] border-[#ebd4fc] text-[#a800d7] dark:bg-[#211529] dark:border-[#422d56] dark:text-[#d7aefb]',
}

export default function ShareNotePage() {
  const { noteId } = useParams<{ noteId: string }>()
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!noteId || !db) {
      setError('Invalid share link.')
      setLoading(false)
      return
    }

    async function fetchSharedNote() {
      try {
        const snap = await getDoc(doc(db!, 'notes', noteId!))
        if (!snap.exists()) {
          setError('Note not found.')
          return
        }
        const data = snap.data() as NoteDoc
        if (!data.isShared || data.isDeleted) {
          setError('This note is not shared or has been deleted.')
          return
        }
        setNote({
          id: snap.id,
          userId: data.userId,
          title: data.title ?? '',
          content: data.content ?? '',
          folderId: data.folderId ?? null,
          tags: data.tags ?? [],
          isPinned: data.isPinned ?? false,
          isFavorite: data.isFavorite ?? false,
          type: data.type ?? 'note',
          wordCount: data.wordCount ?? 0,
          color: data.color ?? null,
          isDeleted: data.isDeleted ?? false,
          isShared: data.isShared ?? false,
          createdAt: data.createdAt ? data.createdAt.toMillis() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toMillis() : null,
          deletedAt: data.deletedAt ? data.deletedAt.toMillis() : null,
        })
      } catch (err) {
        console.error('Error fetching shared note:', err)
        setError('Failed to fetch the shared note.')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedNote()
  }, [noteId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas dark:bg-dark">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center dark:bg-dark">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
          <FileWarning size={24} />
        </div>
        <h2 className="mb-2 font-serif text-2xl font-normal text-ink dark:text-gray-100">Quick View Unavailable</h2>
        <p className="max-w-md text-sm text-ink-muted">{error || 'This link may have expired or public access was revoked.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-dark">
      {/* Shared Header Brand */}
      <header className="flex h-14 items-center justify-between border-b border-hairline/80 bg-canvas/90 px-6 backdrop-blur dark:border-gray-850 dark:bg-dark/95">
        <div className="flex items-center gap-2 font-serif text-lg font-normal text-ink dark:text-gray-100">
          <NotebookPen size={18} className="text-primary" />
          <span className="font-serif font-medium tracking-tight">SuperNote Share</span>
        </div>
        <div className="text-xs font-semibold text-ink-muted">Public Quick View</div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex justify-center p-6 md:p-12 overflow-y-auto">
        <div
          className={cn(
            "w-full max-w-3xl rounded-2xl border p-8 md:p-10 shadow-lg select-text",
            note.color
              ? cardColors[note.color]
              : "border-hairline bg-canvas-card dark:border-gray-800 dark:bg-dark-elevated text-ink-body dark:text-gray-300"
          )}
        >
          <h1 className="mb-3 font-serif text-3xl md:text-4xl font-normal text-ink dark:text-gray-100 tracking-tight leading-tight">
            {note.title || 'Untitled Note'}
          </h1>
          
          <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-hairline/40 pb-4 text-xs text-ink-muted font-medium dark:border-gray-850">
            <span>
              {note.updatedAt
                ? `Updated ${new Date(note.updatedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}`
                : 'Shared Note'}
            </span>
            <span>•</span>
            <span>{note.wordCount} words</span>
            {note.tags.length > 0 && (
              <>
                <span>•</span>
                <div className="flex flex-wrap gap-1">
                  {note.tags.map((t) => (
                    <span key={t} className="rounded-full bg-canvas/50 px-2 py-0.5 text-[10px] font-semibold dark:bg-dark/40">
                      #{t}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Formatted HTML Content */}
          <div
            className="prose dark:prose-invert max-w-none text-base leading-relaxed break-words outline-none"
            dangerouslySetInnerHTML={{ __html: note.content || '<p className="italic text-ink-muted">No content yet…</p>' }}
          />
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-ink-muted border-t border-hairline/40 dark:border-gray-850 bg-canvas dark:bg-dark">
        Powered by SuperNote &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}

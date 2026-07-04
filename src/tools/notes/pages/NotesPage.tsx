import { useOutletContext, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useNoteStore, selectVisibleNotes } from '@/tools/notes/store/noteStore'
import { useUiStore } from '@/shared/store/uiStore'
import { useAuth } from '@/shared/hooks/useAuth'
import { createNote } from '@/tools/notes/services/noteService'
import NotesList from '@/tools/notes/components/NotesList'
import { useEffect } from 'react'
import type { NoteViewMode } from '@/tools/notes/components/NoteCard'

export default function DashboardPage() {
  const { folderId } = useParams<{ folderId?: string }>()
  const { user } = useAuth()
  const { viewMode, columns } = useOutletContext<{ viewMode: NoteViewMode; columns: number }>()
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)

  const allVisibleNotes = useNoteStore(selectVisibleNotes)
  const notes = folderId
    ? allVisibleNotes.filter((n) => n.folderId === folderId)
    : allVisibleNotes

  const loading = useNoteStore((s) => s.loading)

  // Ctrl + V global listener for quick note creation
  useEffect(() => {
    if (!user) return

    async function handlePaste(e: ClipboardEvent) {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.closest('.ProseMirror'))
      ) {
        return
      }

      const text = e.clipboardData?.getData('text')
      if (!text || !text.trim()) return

      try {
        const lines = text.trim().split('\n')
        const firstLine = lines[0]?.trim()
        const title = firstLine && firstLine.length < 50 ? firstLine : 'Pasted Note'
        const contentHtml = `<p>${text.replace(/\n/g, '<br>')}</p>`

        const id = await createNote(user!.uid, {
          title,
          content: contentHtml,
          folderId: folderId || null,
        })
        setEditingNoteId(id)
        toast.success('Note pasted and created!')
      } catch (err) {
        toast.error((err as Error).message)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [user, folderId, setEditingNoteId])

  return (
    <div className="mx-auto w-full max-w-[1600px] p-5 flex flex-col h-auto lg:h-full overflow-visible lg:overflow-hidden animate-fade-in-up">
      <div className="flex-1 overflow-visible lg:overflow-y-auto pb-6">
        <NotesList notes={notes} loading={loading} viewMode={viewMode} columns={columns} />
      </div>
    </div>
  )
}

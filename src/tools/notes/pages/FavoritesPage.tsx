import { useOutletContext } from 'react-router-dom'
import { useNoteStore } from '@/tools/notes/store/noteStore'
import NotesList from '@/tools/notes/components/NotesList'
import type { NoteViewMode } from '@/tools/notes/components/NoteCard'

export default function FavoritesPage() {
  const { viewMode, columns } = useOutletContext<{ viewMode: NoteViewMode; columns: number }>()
  const notes = useNoteStore((s) => s.notes.filter((n) => n.isFavorite))
  const loading = useNoteStore((s) => s.loading)

  return (
    <div className="mx-auto max-w-7xl p-5 animate-fade-in-up">
      <NotesList
        notes={notes}
        loading={loading}
        emptyHint="Star a note to see it here."
        viewMode={viewMode}
        columns={columns}
      />
    </div>
  )
}

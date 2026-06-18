import { useNoteStore } from '@/store/noteStore'
import NotesList from '@/components/NotesList'

export default function FavoritesPage() {
  const notes = useNoteStore((s) => s.notes.filter((n) => n.isFavorite))
  const loading = useNoteStore((s) => s.loading)

  return (
    <div className="mx-auto max-w-7xl p-6 animate-fade-in-up">
      <h1 className="mb-1 text-3xl font-serif font-normal text-ink dark:text-gray-100 tracking-tight">Favorites</h1>
      <p className="mb-6 text-sm text-ink-muted">{notes.length} starred notes</p>
      <NotesList
        notes={notes}
        loading={loading}
        emptyHint="Star a note to see it here."
      />
    </div>
  )
}

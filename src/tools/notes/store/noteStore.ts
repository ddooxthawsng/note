import { create } from 'zustand'
import type { Note } from '@/tools/notes/types/note'
import { subscribeToNotes } from '@/tools/notes/services/noteService'

type SortKey = 'updatedAt' | 'createdAt' | 'title' | 'custom'

interface NoteState {
  notes: Note[]
  loading: boolean
  error: string | null
  search: string
  sortBy: SortKey
  unsub: (() => void) | null
  setSearch: (search: string) => void
  setSortBy: (sortBy: SortKey) => void
  subscribe: (userId: string, userEmail?: string | null) => void
  unsubscribe: () => void
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  loading: true,
  error: null,
  search: '',
  sortBy: 'custom',
  unsub: null,
  setSearch: (search) => set({ search }),
  setSortBy: (sortBy) => set({ sortBy }),
  subscribe: (userId, userEmail) => {
    get().unsub?.()
    set({ loading: true, error: null })
    const unsub = subscribeToNotes(
      userId,
      userEmail,
      (notes) => set({ notes, loading: false }),
      (err) => set({ error: err.message, loading: false }),
    )
    set({ unsub })
  },
  unsubscribe: () => {
    get().unsub?.()
    set({ unsub: null, notes: [], loading: true })
  },
}))

/** Derived, filtered + sorted view for the dashboard. */
export function selectVisibleNotes(state: NoteState): Note[] {
  const q = state.search.trim().toLowerCase()
  let list = state.notes
  if (q) {
    list = list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list].sort((a, b) => {
    if (state.sortBy === 'title') return a.title.localeCompare(b.title)
    if (state.sortBy === 'custom') {
      const valA = a.order ?? a.updatedAt ?? a.createdAt ?? 0
      const valB = b.order ?? b.updatedAt ?? b.createdAt ?? 0
      return valB - valA
    }
    const valA = a[state.sortBy] ?? (state.sortBy === 'updatedAt' || state.sortBy === 'createdAt' ? Date.now() : 0)
    const valB = b[state.sortBy] ?? (state.sortBy === 'updatedAt' || state.sortBy === 'createdAt' ? Date.now() : 0)
    return valB - valA
  })
  // pinned first
  return sorted.sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
}

import { create } from 'zustand'
import type { Note } from '@/types/note'
import { subscribeToNotes } from '@/services/noteService'

type SortKey = 'updatedAt' | 'createdAt' | 'title'

interface NoteState {
  notes: Note[]
  loading: boolean
  error: string | null
  search: string
  sortBy: SortKey
  unsub: (() => void) | null
  setSearch: (search: string) => void
  setSortBy: (sortBy: SortKey) => void
  subscribe: (userId: string) => void
  unsubscribe: () => void
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  loading: true,
  error: null,
  search: '',
  sortBy: 'updatedAt',
  unsub: null,
  setSearch: (search) => set({ search }),
  setSortBy: (sortBy) => set({ sortBy }),
  subscribe: (userId) => {
    get().unsub?.()
    set({ loading: true, error: null })
    const unsub = subscribeToNotes(
      userId,
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
    const valA = a[state.sortBy] ?? (state.sortBy === 'updatedAt' || state.sortBy === 'createdAt' ? Date.now() : 0)
    const valB = b[state.sortBy] ?? (state.sortBy === 'updatedAt' || state.sortBy === 'createdAt' ? Date.now() : 0)
    return valB - valA
  })
  // pinned first
  return sorted.sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
}

import { create } from 'zustand'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('theme', theme)
}

export interface ContextMenuConfig {
  x: number
  y: number
  type: 'note' | 'folder' | 'trash-note'
  targetId: string
  data?: any
}

interface UiState {
  theme: Theme
  sidebarOpen: boolean
  editingNoteId: string | null
  contextMenu: ContextMenuConfig | null
  isDraggingNote: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebar: (open: boolean) => void
  setEditingNoteId: (id: string | null) => void
  setContextMenu: (menu: ContextMenuConfig | null) => void
  setIsDraggingNote: (dragging: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => {
  const theme = getInitialTheme()
  applyTheme(theme)
  return {
    theme,
    sidebarOpen: true,
    editingNoteId: null,
    contextMenu: null,
    isDraggingNote: false,
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      set({ theme: next })
    },
    toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
    setSidebar: (open) => set({ sidebarOpen: open }),
    setEditingNoteId: (editingNoteId) => set({ editingNoteId }),
    setContextMenu: (contextMenu) => set({ contextMenu }),
    setIsDraggingNote: (isDraggingNote) => set({ isDraggingNote }),
  }
})

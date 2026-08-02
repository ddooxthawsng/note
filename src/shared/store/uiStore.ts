import { create } from 'zustand'

type Theme = 'light' | 'dark'

const MIC_CONTROLS_KEY = 'show_mic_controls'

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
  showMicControls: boolean
  editingNoteId: string | null
  contextMenu: ContextMenuConfig | null
  toggleTheme: () => void
  toggleMicControls: () => void
  setEditingNoteId: (id: string | null) => void
  setContextMenu: (menu: ContextMenuConfig | null) => void
}

export const useUiStore = create<UiState>((set, get) => {
  const theme = getInitialTheme()
  applyTheme(theme)
  return {
    theme,
    showMicControls: localStorage.getItem(MIC_CONTROLS_KEY) !== 'false',
    editingNoteId: null,
    contextMenu: null,
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      set({ theme: next })
    },
    toggleMicControls: () => {
      const next = !get().showMicControls
      localStorage.setItem(MIC_CONTROLS_KEY, String(next))
      set({ showMicControls: next })
    },
    setEditingNoteId: (editingNoteId) => set({ editingNoteId }),
    setContextMenu: (contextMenu) => set({ contextMenu }),
  }
})

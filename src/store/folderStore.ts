import { create } from 'zustand'
import type { Folder } from '@/types/folder'
import { subscribeToFolders } from '@/services/folderService'

interface FolderState {
  folders: Folder[]
  loading: boolean
  error: string | null
  unsub: (() => void) | null
  subscribe: (userId: string) => void
  unsubscribe: () => void
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loading: true,
  error: null,
  unsub: null,
  subscribe: (userId) => {
    get().unsub?.()
    set({ loading: true, error: null })
    const unsub = subscribeToFolders(
      userId,
      (folders) => set({ folders, loading: false }),
      (err) => set({ error: err.message, loading: false }),
    )
    set({ unsub })
  },
  unsubscribe: () => {
    get().unsub?.()
    set({ unsub: null, folders: [], loading: true })
  },
}))

import { create } from 'zustand'
import type { Folder } from '@/tools/notes/types/folder'
import { subscribeToFolders } from '@/tools/notes/services/folderService'

interface FolderState {
  folders: Folder[]
  loading: boolean
  error: string | null
  unsub: (() => void) | null
  addFolder: (folder: Folder) => void
  subscribe: (userId: string, userEmail?: string | null) => void
  unsubscribe: () => void
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  loading: true,
  error: null,
  unsub: null,
  addFolder: (folder) => set((state) => (
    state.folders.some((item) => item.id === folder.id)
      ? state
      : { folders: [...state.folders, folder] }
  )),
  subscribe: (userId, userEmail) => {
    get().unsub?.()
    set({ loading: true, error: null })
    const unsub = subscribeToFolders(
      userId,
      userEmail,
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

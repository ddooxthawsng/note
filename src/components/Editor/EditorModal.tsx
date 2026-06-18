import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Check, Loader2, Save, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import TiptapEditor from '@/components/Editor/TiptapEditor'
import { getNote, updateNote, softDeleteNote, countWords } from '@/services/noteService'
import { useNoteStore } from '@/store/noteStore'
import { useFolderStore } from '@/store/folderStore'
import { useUiStore } from '@/store/uiStore'
import type { Note } from '@/types/note'
import { cn } from '@/utils/cn'

type SaveState = 'idle' | 'saving' | 'saved'
const AUTOSAVE_MS = 1500

export default function EditorModal() {
  const editingNoteId = useUiStore((s) => s.editingNoteId)
  const setEditingNoteId = useUiStore((s) => s.setEditingNoteId)
  const notesInStore = useNoteStore((s) => s.notes)
  const folders = useFolderStore((s) => s.folders)

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [loadingNote, setLoadingNote] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)

  // Load note
  useEffect(() => {
    if (!editingNoteId) {
      setNote(null)
      return
    }

    let active = true
    async function load() {
      setLoadingNote(true)
      try {
        const cached = notesInStore.find((n) => n.id === editingNoteId)
        const loaded = cached ?? (await getNote(editingNoteId!))
        if (!active) return
        if (!loaded) {
          toast.error('Note not found')
          setEditingNoteId(null)
          return
        }
        setNote(loaded)
        setTitle(loaded.title)
        setContent(loaded.content)
        setFolderId(loaded.folderId ?? null)
        dirty.current = false
        setSaveState('idle')
      } catch (err) {
        toast.error((err as Error).message)
        setEditingNoteId(null)
      } finally {
        if (active) setLoadingNote(false)
      }
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNoteId])

  // Debounced auto-save on change
  useEffect(() => {
    if (loadingNote || !editingNoteId || !dirty.current) return
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await updateNote(editingNoteId!, { title: title || 'Untitled Note', content, folderId })
        setSaveState('saved')
        dirty.current = false
      } catch (e) {
        setSaveState('idle')
        toast.error((e as Error).message)
      }
    }, AUTOSAVE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, folderId])

  function markDirty() {
    dirty.current = true
    setSaveState('idle')
  }

  async function handleSaveImmediate() {
    if (!editingNoteId || !dirty.current) return
    if (timer.current) clearTimeout(timer.current)
    setSaveState('saving')
    try {
      await updateNote(editingNoteId, { title: title || 'Untitled Note', content, folderId })
      setSaveState('saved')
      dirty.current = false
      toast.success('Saved!')
    } catch (e) {
      setSaveState('idle')
      toast.error((e as Error).message)
    }
  }

  async function handleClose() {
    if (dirty.current && editingNoteId) {
      // Save immediately on close if dirty
      if (timer.current) clearTimeout(timer.current)
      try {
        await updateNote(editingNoteId, { title: title || 'Untitled Note', content, folderId })
        toast.success('Autosaved before closing!')
      } catch (e) {
        toast.error('Failed to autosave: ' + (e as Error).message)
      }
    }
    setEditingNoteId(null)
  }

  async function handleDelete() {
    if (!editingNoteId) return
    try {
      await softDeleteNote(editingNoteId)
      toast.success('Moved to trash')
      setEditingNoteId(null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!editingNoteId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-fade-in"
      />

      {/* Modal Card */}
      <div className="relative z-10 flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-hairline bg-canvas shadow-2xl transition-all animate-scale-in dark:border-gray-800 dark:bg-dark">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated dark:hover:text-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Folder selection dropdown */}
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <FolderOpen size={16} />
              <select
                value={folderId || ''}
                onChange={(e) => {
                  markDirty()
                  setFolderId(e.target.value || null)
                }}
                className="rounded-md border border-hairline bg-canvas-soft px-2.5 py-1.5 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-300 text-xs font-medium"
              >
                <option value="">No Folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveImmediate}
              disabled={!dirty.current || saveState === 'saving'}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 select-none",
                dirty.current
                  ? "bg-primary text-white hover:bg-primary-hover shadow-sm"
                  : "bg-canvas-card text-ink-muted/50 dark:bg-dark-elevated dark:text-gray-500 cursor-not-allowed"
              )}
            >
              {saveState === 'saving' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : saveState === 'saved' && !dirty.current ? (
                <Check size={15} className="text-success" />
              ) : (
                <Save size={15} className={cn(dirty.current && "animate-pulse")} />
              )}
              {saveState === 'saved' && !dirty.current ? 'Saved' : 'Save'}
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              aria-label="Delete note"
              className="rounded-md p-2 text-ink-muted hover:bg-canvas-card hover:text-error dark:hover:bg-dark-elevated transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loadingNote ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <input
                value={title}
                onChange={(e) => {
                  markDirty()
                  setTitle(e.target.value)
                }}
                placeholder="Untitled Note"
                className="mb-1 w-full bg-transparent font-serif text-3xl font-normal text-ink dark:text-gray-150 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700"
              />

              <div className="mb-4 text-xs text-ink-muted font-medium">{countWords(content)} words</div>

              <div className="flex-1">
                <TiptapEditor
                  content={note?.content ?? ''}
                  onChange={(html) => {
                    markDirty()
                    setContent(html)
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

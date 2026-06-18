import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Check, Loader2, Save, FolderOpen, Share2 } from 'lucide-react'
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
  const [color, setColor] = useState<string | null>(null)
  const [isShared, setIsShared] = useState(false)
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
        setColor(loaded.color ?? null)
        setIsShared(loaded.isShared ?? false)
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
        await updateNote(editingNoteId!, { title: title || 'Untitled Note', content, folderId, color, isShared })
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
  }, [title, content, folderId, color, isShared])

  function markDirty() {
    dirty.current = true
    setSaveState('idle')
  }

  async function handleSaveImmediate() {
    if (!editingNoteId || !dirty.current) return
    if (timer.current) clearTimeout(timer.current)
    setSaveState('saving')
    try {
      await updateNote(editingNoteId, { title: title || 'Untitled Note', content, folderId, color, isShared })
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
        await updateNote(editingNoteId, { title: title || 'Untitled Note', content, folderId, color, isShared })
        toast.success('Autosaved before closing!')
      } catch (e) {
        toast.error('Failed to autosave: ' + (e as Error).message)
      }
    }
    setEditingNoteId(null)
  }

  async function handleToggleShare() {
    if (!editingNoteId) return
    const nextShared = !isShared
    try {
      await updateNote(editingNoteId, { isShared: nextShared })
      setIsShared(nextShared)
      if (nextShared) {
        const shareUrl = `${window.location.origin}/share/${editingNoteId}`
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Note shared! Link copied to clipboard.')
      } else {
        toast.success('Public access revoked.')
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
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
      <div
        className={cn(
          "relative z-10 flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl border transition-all animate-scale-in shadow-2xl",
          color === 'red' ? 'bg-[#fdf2f0] border-[#fad2cf] dark:bg-[#291615] dark:border-[#5f2e2a]' :
          color === 'amber' ? 'bg-[#fefaf0] border-[#feebb7] dark:bg-[#2a2015] dark:border-[#624a2f]' :
          color === 'teal' ? 'bg-[#f0faf2] border-[#ceead6] dark:bg-[#15291a] dark:border-[#2c4e38]' :
          color === 'blue' ? 'bg-[#f0f4fa] border-[#d2e3fc] dark:bg-[#151f29] dark:border-[#293d56]' :
          color === 'purple' ? 'bg-[#faf0ff] border-[#ebd4fc] dark:bg-[#211529] dark:border-[#422d56]' :
          'bg-canvas border-hairline dark:bg-dark dark:border-gray-800'
        )}
      >
        
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

            {/* Share Button */}
            <button
              onClick={handleToggleShare}
              title={isShared ? "Copy link or stop sharing" : "Share note"}
              className={cn(
                "rounded-md p-2 transition-colors animate-fade-in",
                isShared
                  ? "text-success bg-success/15 hover:bg-success/20"
                  : "text-ink-muted hover:bg-canvas-card dark:hover:bg-dark-elevated"
              )}
            >
              <Share2 size={18} />
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
                className="mb-1 w-full bg-transparent font-serif text-3xl font-normal text-ink dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700"
              />

              <div className="mb-4 flex items-center justify-between border-b border-hairline/45 pb-2 dark:border-gray-800">
                <div className="text-xs text-ink-muted font-medium">{countWords(content)} words</div>
                
                {/* Color Selector circles */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-ink-muted font-medium">Màu:</span>
                  <button
                    onClick={() => { markDirty(); setColor(null); }}
                    className={cn(
                      "h-4 w-4 rounded-full border border-hairline transition hover:scale-110",
                      color === null ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-dark" : ""
                    )}
                    style={{ backgroundColor: '#efe9de' }}
                    title="Mặc định"
                  />
                  {(['red', 'amber', 'teal', 'blue', 'purple'] as const).map((colorKey) => {
                    const bgColors = {
                      red: '#fad2cf',
                      amber: '#feebb7',
                      teal: '#ceead6',
                      blue: '#d2e3fc',
                      purple: '#ebd4fc',
                    }
                    return (
                      <button
                        key={colorKey}
                        onClick={() => { markDirty(); setColor(colorKey); }}
                        className={cn(
                          "h-4 w-4 rounded-full border border-hairline transition hover:scale-110",
                          color === colorKey ? "ring-2 ring-primary ring-offset-2 dark:ring-offset-dark" : ""
                        )}
                        style={{ backgroundColor: bgColors[colorKey] }}
                        title={colorKey}
                      />
                    )
                  })}
                </div>
              </div>

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

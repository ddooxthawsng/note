import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Check, Loader2, Save, FolderOpen, Share2, ListChecks, History, RotateCcw, Users, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import TiptapEditor, { toChecklistHtml } from '@/tools/notes/components/Editor/TiptapEditor'
import NoteAttachments, { primeNoteAttachmentPreview } from '@/tools/notes/components/Editor/NoteAttachments'
import CollaboratorPicker from '@/tools/notes/components/CollaboratorPicker'
import { getNote, subscribeToNote, updateNote, softDeleteNote, countWords } from '@/tools/notes/services/noteService'
import { createTask } from '@/tools/notes/tasks/services/taskService'
import { useNoteStore } from '@/tools/notes/store/noteStore'
import { useFolderStore } from '@/tools/notes/store/folderStore'
import { useUiStore } from '@/shared/store/uiStore'
import { useAuth } from '@/shared/hooks/useAuth'
import type { Note, NoteAttachment, NoteHistoryEntry } from '@/tools/notes/types/note'
import { cn } from '@/shared/utils/cn'
import { confirmDialog } from '@/shared/utils/dialog'
import CustomSelect from '@/shared/components/CustomSelect'
import { getTelegramSettings } from '@/tools/telegram/telegramApi'
import { uploadTelegramFile } from '@/tools/telegram/telegramDriveService'
import { deleteTelegramFile, saveTelegramFile, telegramFileId } from '@/tools/telegram/telegramLibraryService'

type SaveState = 'idle' | 'saving' | 'saved'
const AUTOSAVE_MS = 1500

export default function EditorModal() {
  const { user } = useAuth()
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
  const [sharedWith, setSharedWith] = useState<string[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [loadingNote, setLoadingNote] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState(0)
  const [attachments, setAttachments] = useState<NoteAttachment[]>([])
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [attachmentProgress, setAttachmentProgress] = useState('')

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const editSeq = useRef(0)
  const latestRef = useRef({ title: '', content: '', folderId: null as string | null, color: null as string | null, isShared: false })
  latestRef.current = { title, content, folderId, color, isShared }

  // Load note + subscribe for real-time collaborative updates
  useEffect(() => {
    if (!editingNoteId) {
      setNote(null)
      return
    }

    let active = true
    let unsub: (() => void) | null = null

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
        setSharedWith(loaded.sharedWith ?? [])
        setAttachments(loaded.attachments ?? [])
        setHistoryOpen(false)
        setShareOpen(false)
        setSelectedHistoryIdx(0)
        dirty.current = false
        editSeq.current = 0
        setSaveState('idle')

        unsub = subscribeToNote(editingNoteId!, (remote) => {
          if (!active || !remote) return
          setNote(remote)
          setAttachments(remote.attachments ?? [])
          setSharedWith(remote.sharedWith ?? [])
          // Only sync remote text if local user does not have unsaved edits in flight
          if (!dirty.current) {
            setTitle(remote.title)
            setContent(remote.content)
            setFolderId(remote.folderId ?? null)
            setColor(remote.color ?? null)
            setIsShared(remote.isShared ?? false)
          }
        })
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
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNoteId])

  // Debounced auto-save on change (race-safe: never overwrites newer typing)
  useEffect(() => {
    if (loadingNote || !editingNoteId || !dirty.current) return
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    const seqAtSchedule = editSeq.current
    timer.current = setTimeout(async () => {
      const snap = latestRef.current
      const seqAtSave = editSeq.current
      try {
        const savedTitle = snap.title || 'Untitled Note'
        await updateNote(editingNoteId!, {
          title: savedTitle,
          content: snap.content,
          folderId: snap.folderId,
          color: snap.color,
          isShared: snap.isShared,
          lastEditedBy: user?.email ?? user?.displayName ?? null,
        })
        syncSavedNote({ title: savedTitle, content: snap.content, folderId: snap.folderId, color: snap.color, isShared: snap.isShared })
        if (editSeq.current === seqAtSave && editSeq.current === seqAtSchedule) {
          dirty.current = false
          setSaveState('saved')
        }
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
    editSeq.current += 1
    setSaveState('idle')
  }

  function noteHistoryEntry(n: Note): NoteHistoryEntry {
    return {
      title: n.title,
      content: n.content,
      folderId: n.folderId,
      tags: n.tags,
      type: n.type,
      wordCount: n.wordCount,
      color: n.color,
      isShared: n.isShared,
      updatedAt: n.updatedAt,
      savedAt: Date.now(),
    }
  }

  function syncSavedNote(patch: Partial<Note>) {
    setNote((prev) => {
      if (!prev) return prev
      const changed =
        ('title' in patch && patch.title !== prev.title) ||
        ('content' in patch && patch.content !== prev.content) ||
        ('type' in patch && patch.type !== prev.type)
      return {
        ...prev,
        ...patch,
        wordCount: typeof patch.content === 'string' ? countWords(patch.content) : prev.wordCount,
        updatedAt: Date.now(),
        history: changed ? [noteHistoryEntry(prev), ...(prev.history ?? [])].slice(0, 30) : prev.history,
      }
    })
  }

  function extractTaskLines(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const itemText = Array.from(doc.querySelectorAll('li, [data-type="check-item"]'))
      .map((item) => item.textContent?.trim() ?? '')
      .filter(Boolean)
    const blockText = Array.from(doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote'))
      .map((item) => item.textContent?.trim() ?? '')
      .filter(Boolean)
    const lines = itemText.length ? itemText : blockText.length ? blockText : (doc.body.textContent ?? html).split(/\n+/)
    return lines
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }

  async function handleConvertToTasks() {
    if (!user || !editingNoteId) return
    const lines = extractTaskLines(content || title)
    if (lines.length === 0) {
      toast.error('No task lines found')
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setSaveState('saving')
    try {
      await Promise.all(lines.map((line) => createTask(user.uid, { title: line, dueDate: null })))
      const nextContent = toChecklistHtml(lines)
      setContent(nextContent)
      const savedTitle = title || 'Untitled Note'
      await updateNote(editingNoteId, {
        title: savedTitle,
        content: nextContent,
        folderId,
        color,
        isShared,
        type: 'list',
      })
      syncSavedNote({ title: savedTitle, content: nextContent, folderId, color, isShared, type: 'list' })
      dirty.current = false
      setSaveState('saved')
      toast.success(`Created ${lines.length} tasks and converted note to checklist`)
    } catch (e) {
      setSaveState('idle')
      toast.error((e as Error).message)
    }
  }

  async function handleSaveImmediate() {
    if (!editingNoteId || !dirty.current) return
    if (timer.current) clearTimeout(timer.current)
    setSaveState('saving')
    try {
      const savedTitle = title || 'Untitled Note'
      await updateNote(editingNoteId, { title: savedTitle, content, folderId, color, isShared })
      syncSavedNote({ title: savedTitle, content, folderId, color, isShared })
      setSaveState('saved')
      dirty.current = false
      toast.success('Saved!')
    } catch (e) {
      setSaveState('idle')
      toast.error((e as Error).message)
    }
  }

  async function handleClose() {
    if (attachmentBusy) {
      toast('Wait for the Telegram upload to finish.')
      return
    }
    if (dirty.current && editingNoteId) {
      // Save immediately on close if dirty
      if (timer.current) clearTimeout(timer.current)
      try {
        const savedTitle = title || 'Untitled Note'
        await updateNote(editingNoteId, { title: savedTitle, content, folderId, color, isShared })
        syncSavedNote({ title: savedTitle, content, folderId, color, isShared })
        toast.success('Autosaved before closing!')
      } catch (e) {
        toast.error('Failed to autosave: ' + (e as Error).message)
      }
    }
    setEditingNoteId(null)
  }

  async function handleUpdateCollaborators(next: string[]) {
    if (!editingNoteId) return
    try {
      await updateNote(editingNoteId, { sharedWith: next })
      setSharedWith(next)
      syncSavedNote({ sharedWith: next })
      toast.success('Đã cập nhật danh sách chia sẻ')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleToggleShare() {
    if (!editingNoteId) return
    const nextShared = !isShared
    try {
      await updateNote(editingNoteId, { isShared: nextShared })
      setIsShared(nextShared)
      syncSavedNote({ isShared: nextShared })
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
    if (!editingNoteId || attachmentBusy) return
    try {
      await softDeleteNote(editingNoteId)
      toast.success('Moved to trash')
      setEditingNoteId(null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleUploadFiles(files: File[]): Promise<NoteAttachment[]> {
    if (!user || !editingNoteId || attachmentBusy) return []
    const { botToken, chatId } = getTelegramSettings()
    if (!botToken || !chatId) {
      toast.error('Configure Bot token and Chat ID in Telegram Drive first.')
      return []
    }

    setAttachmentBusy(true)
    let next = [...attachments]
    const uploaded: NoteAttachment[] = []
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex]
        const manifest = await uploadTelegramFile(
          botToken,
          chatId,
          file,
          (part, total) => setAttachmentProgress(`Uploading ${fileIndex + 1}/${files.length}: part ${part}/${total}`),
        )
        const id = await telegramFileId(user.uid, manifest)
        const attachment = { id, manifest }
        primeNoteAttachmentPreview(botToken, attachment, file)
        uploaded.push(attachment)
        next = [...next, attachment]
        await updateNote(editingNoteId, { attachments: next })
        setAttachments(next)
        syncSavedNote({ attachments: next })
        try {
          await saveTelegramFile(user.uid, manifest, { type: 'note', noteId: editingNoteId })
        } catch (error) {
          toast.error(`Attached, but Drive registry sync failed: ${(error as Error).message}`)
        }
      }
      toast.success(`${files.length} attachment(s) uploaded to Telegram`)
      return uploaded
    } catch (error) {
      toast.error((error as Error).message)
      return uploaded
    } finally {
      setAttachmentBusy(false)
      setAttachmentProgress('')
    }
  }

  async function handleDeleteAttachment(attachment: NoteAttachment) {
    if (!editingNoteId || attachmentBusy) return
    const confirmed = await confirmDialog(
      'Remove attachment',
      'Remove it from this note and Telegram Drive library? The Telegram chat message is kept for recovery.',
      'Remove',
    )
    if (!confirmed) return
    setAttachmentBusy(true)
    try {
      const next = attachments.filter((item) => item.id !== attachment.id)
      await updateNote(editingNoteId, { attachments: next })
      setAttachments(next)
      syncSavedNote({ attachments: next })
      await deleteTelegramFile(attachment.id).catch(() => undefined)
      toast.success('Attachment removed')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setAttachmentBusy(false)
    }
  }

  async function handleRestoreHistory(entry: NoteHistoryEntry) {
    if (!editingNoteId) return
    if (timer.current) clearTimeout(timer.current)
    setSaveState('saving')
    try {
      const restoredTitle = entry.title || 'Untitled Note'
      await updateNote(editingNoteId, {
        title: restoredTitle,
        content: entry.content,
        folderId: entry.folderId,
        tags: entry.tags,
        type: entry.type,
        color: entry.color,
        isShared: entry.isShared ?? false,
      })
      setTitle(restoredTitle)
      setContent(entry.content)
      setFolderId(entry.folderId)
      setColor(entry.color)
      setIsShared(entry.isShared ?? false)
      syncSavedNote({
        title: restoredTitle,
        content: entry.content,
        folderId: entry.folderId,
        tags: entry.tags,
        type: entry.type,
        color: entry.color,
        isShared: entry.isShared ?? false,
      })
      dirty.current = false
      setSaveState('saved')
      setHistoryOpen(false)
      toast.success('History restored')
    } catch (e) {
      setSaveState('idle')
      toast.error((e as Error).message)
    }
  }

  const history = note?.history ?? []

  if (!editingNoteId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[3px] transition-opacity animate-fade-in"
      />

      {/* Modal Card */}
      <div
        className={cn(
          "relative z-10 flex h-[100dvh] sm:h-[88vh] w-full max-w-5xl flex-col rounded-none sm:rounded-2xl border transition-all animate-scale-in shadow-2xl",
          color === 'red' ? 'bg-[#fdf2f0] border-[#fad2cf] dark:bg-[#291615] dark:border-[#5f2e2a]' :
          color === 'amber' ? 'bg-[#fefaf0] border-[#feebb7] dark:bg-[#2a2015] dark:border-[#624a2f]' :
          color === 'teal' ? 'bg-[#f0faf2] border-[#ceead6] dark:bg-[#15291a] dark:border-[#2c4e38]' :
          color === 'blue' ? 'bg-[#f0f4fa] border-[#d2e3fc] dark:bg-[#151f29] dark:border-[#293d56]' :
          color === 'purple' ? 'bg-[#faf0ff] border-[#ebd4fc] dark:bg-[#211529] dark:border-[#422d56]' :
          'bg-canvas border-hairline dark:bg-dark dark:border-gray-800'
        )}
      >
        
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-3 sm:px-6 sm:py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated dark:hover:text-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
            {note?.lastEditedBy && (
              <span className="hidden md:inline-flex items-center rounded-full bg-canvas-soft px-2.5 py-0.5 text-[11px] text-ink-muted dark:bg-dark-elevated">
                Edited by {note.lastEditedBy}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
            {/* Folder selection dropdown */}
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <FolderOpen size={16} />
              <CustomSelect
                size="sm"
                ariaLabel="Folder"
                value={folderId || ''}
                onChange={(val) => {
                  markDirty()
                  setFolderId(val || null)
                }}
                options={[
                  { value: '', label: 'No Folder' },
                  ...folders.map((f) => ({ value: f.id, label: f.name })),
                ]}
                className="min-w-[120px]"
              />
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

            <button
              onClick={() => setHistoryOpen((open) => !open)}
              disabled={history.length === 0}
              title="Note history"
              className={cn(
                "rounded-md p-2 transition-colors",
                history.length === 0
                  ? "cursor-not-allowed text-ink-muted/35"
                  : historyOpen
                    ? "bg-primary/10 text-primary"
                    : "text-ink-muted hover:bg-canvas-card hover:text-primary dark:hover:bg-dark-elevated",
              )}
            >
              <History size={18} />
            </button>

            {/* Share Button */}
            <button
              onClick={handleConvertToTasks}
              title="Convert note to tasks"
              className="rounded-md p-2 text-ink-muted transition-colors hover:bg-canvas-card hover:text-primary dark:hover:bg-dark-elevated"
            >
              <ListChecks size={18} />
            </button>

            {/* Share & Collaborate Button */}
            <button
              onClick={() => {
                setShareOpen((open) => !open)
                setHistoryOpen(false)
              }}
              title="Share & collaborate"
              className={cn(
                "inline-flex items-center gap-1 rounded-md p-2 text-xs font-medium transition-colors animate-fade-in",
                isShared || sharedWith.length > 0
                  ? "text-success bg-success/15 hover:bg-success/20"
                  : "text-ink-muted hover:bg-canvas-card dark:hover:bg-dark-elevated"
              )}
            >
              <Share2 size={18} />
              {sharedWith.length > 0 && <span className="hidden sm:inline">{sharedWith.length}</span>}
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

        {shareOpen && (
          <div className="absolute right-3 sm:right-6 top-16 z-30 w-[calc(100vw-1.5rem)] max-w-sm rounded-xl border border-hairline bg-canvas/95 p-4 shadow-2xl backdrop-blur-md dark:border-gray-800 dark:bg-dark-elevated/95 animate-scale-in">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
                <Users size={16} className="text-primary" /> Chia sẻ & Cộng tác
              </h3>
              <button onClick={() => setShareOpen(false)} className="rounded p-1 text-ink-muted hover:bg-canvas-card dark:hover:bg-dark">
                <X size={15} />
              </button>
            </div>

            <div className="mb-3">
              <CollaboratorPicker
                sharedWith={sharedWith}
                canEdit={note?.userId === user?.uid}
                onChange={handleUpdateCollaborators}
                emptyText="Chưa chia sẻ với tài khoản nào. Chọn tài khoản đã duyệt hoặc nhập email để cùng xem & sửa real-time."
              />
            </div>

            <div className="border-t border-hairline pt-3 dark:border-gray-800">
              <button
                type="button"
                onClick={handleToggleShare}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition",
                  isShared
                    ? "bg-success/15 text-success hover:bg-success/20"
                    : "border border-hairline bg-canvas-soft text-ink-body hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-dark dark:text-gray-300"
                )}
              >
                <Link2 size={14} />
                {isShared ? 'Đang bật Link công khai (Bấm để tắt)' : 'Tạo Link xem công khai'}
              </button>
            </div>
          </div>
        )}

        {historyOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-6 backdrop-blur-sm animate-fade-in">
            <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl dark:border-gray-800 dark:bg-dark-elevated animate-scale-in">
              <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-primary" />
                  <h3 className="font-serif text-lg font-medium text-ink dark:text-gray-100">
                    Lịch sử phiên bản ({history.length}/30)
                  </h3>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-card dark:hover:bg-dark"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                {/* Version list */}
                <div className="max-h-56 w-full overflow-y-auto border-b border-hairline bg-canvas-soft/60 p-2.5 dark:border-gray-800 dark:bg-dark/40 md:max-h-none md:w-72 md:border-b-0 md:border-r">
                  <div className="space-y-1.5">
                    {history.map((item, index) => {
                      const active = selectedHistoryIdx === index
                      return (
                        <button
                          key={`${item.savedAt}-${index}`}
                          type="button"
                          onClick={() => setSelectedHistoryIdx(index)}
                          className={cn(
                            'w-full rounded-lg border p-2.5 text-left transition',
                            active
                              ? 'border-primary bg-primary/10 dark:bg-primary/15'
                              : 'border-hairline bg-canvas hover:border-primary/40 dark:border-gray-800 dark:bg-dark-elevated',
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              v{history.length - index}
                            </span>
                            <span className="text-[11px] text-ink-muted">
                              {new Date(item.savedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="truncate text-xs font-semibold text-ink dark:text-gray-100">
                            {item.title || 'Untitled Note'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {item.wordCount} từ
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Selected version preview */}
                <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
                  {history[selectedHistoryIdx] ? (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 dark:border-gray-800">
                        <div className="min-w-0">
                          <h4 className="truncate font-serif text-xl font-medium text-ink dark:text-gray-100">
                            {history[selectedHistoryIdx].title || 'Untitled Note'}
                          </h4>
                          <p className="text-xs text-ink-muted">
                            Lưu lúc {new Date(history[selectedHistoryIdx].savedAt).toLocaleString()} · {history[selectedHistoryIdx].wordCount} từ
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreHistory(history[selectedHistoryIdx])}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover active:scale-95"
                        >
                          <RotateCcw size={14} /> Khôi phục phiên bản này
                        </button>
                      </div>
                      <div
                        className="prose dark:prose-invert max-w-none flex-1 overflow-y-auto rounded-xl border border-hairline bg-canvas-soft/40 p-4 text-sm dark:border-gray-800 dark:bg-dark/30"
                        dangerouslySetInnerHTML={{
                          __html: history[selectedHistoryIdx].content || '<p class="italic text-ink-muted">Trống</p>',
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

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
                <div className="text-xs text-ink-muted font-medium">
                  {attachmentProgress || `${countWords(content)} words`}
                </div>
                
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
                <NoteAttachments
                  attachments={attachments}
                  botToken={getTelegramSettings().botToken}
                  busy={attachmentBusy}
                  onDelete={(attachment) => void handleDeleteAttachment(attachment)}
                />
                <TiptapEditor
                  noteId={editingNoteId}
                  content={content}
                  uploading={attachmentBusy}
                  onUploadFiles={(files) => handleUploadFiles(files)}
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

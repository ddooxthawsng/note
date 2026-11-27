import { useEditor, EditorContent } from '@tiptap/react'
import { Mark, Node, mergeAttributes } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code2,
  Undo2,
  Redo2,
  Search,
  RefreshCw,
  X,
  Scissors,
  Copy,
  Clipboard,
  Mic,
  MicOff,
  Sparkles,
  Wand2,
  Loader2,
  History,
  Highlighter,
  ListChecks,
  Paperclip,
  ClipboardCopy,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import toast from 'react-hot-toast'
import { useUiStore } from '@/shared/store/uiStore'
import { useSpeechToText } from '@/shared/hooks/useSpeechToText'
import { askGeminiToFormat, askGeminiToSummarize } from '@/shared/utils/ai'
import { CopyBlockNode, TelegramMediaNode } from '@/tools/notes/components/Editor/EditorNodes'
import type { NoteAttachment } from '@/tools/notes/types/note'

const highlightColors = ['red', 'amber', 'teal', 'blue', 'purple'] as const

const HighlightMark = Mark.create({
  name: 'highlightMark',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => {
          const className = element.getAttribute('class') || ''
          return highlightColors.find((c) => className.split(/\s+/).includes(c)) || null
        },
        renderHTML: (attributes) => attributes.color ? { class: attributes.color } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'mark' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0]
  },
})

const ChecklistItem = Node.create({
  name: 'checklistItem',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes) => ({ 'data-checked': attributes.checked ? 'true' : 'false' }),
      },
    }
  },
  parseHTML() {
    return [{ tag: '[data-type="check-item"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const inputAttrs: Record<string, string> = { type: 'checkbox' }
    if (node.attrs.checked) inputAttrs.checked = 'checked'
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'check-item', class: 'check-item' }),
      ['label', { class: 'check-item-label' }, ['input', inputAttrs], ['span', 0]],
    ]
  },
})

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function toChecklistHtml(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<div data-type="check-item" data-checked="false"><label class="check-item-label"><input type="checkbox"><span>${escapeHtml(line)}</span></label></div>`)
    .join('')
}

interface Props {
  content: string
  noteId?: string | null
  onChange: (html: string) => void
  editable?: boolean
  onUploadFiles?: (files: File[]) => Promise<NoteAttachment[] | void> | void
  uploading?: boolean
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-md p-1.5 text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
        active && 'bg-primary/10 text-primary',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  )
}

function extractClipboardFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return []
  const seen = new Set<string>()
  const collected: File[] = []
  const addFile = (f: File | null) => {
    if (!f) return
    const key = `${f.name}:${f.size}:${f.type}`
    if (seen.has(key)) return
    seen.add(key)
    // Ensure pasted screenshots/images have a clean filename
    if (!f.name || f.name === 'image.png') {
      const ext = f.type.split('/')[1] || 'png'
      const named = new File([f], `pasted-${Date.now()}.${ext}`, { type: f.type || 'image/png' })
      collected.push(named)
    } else {
      collected.push(f)
    }
  }
  Array.from(clipboardData.files ?? []).forEach(addFile)
  Array.from(clipboardData.items ?? []).forEach((item) => {
    if (item.kind === 'file') addFile(item.getAsFile())
  })
  return collected
}

export default function TiptapEditor({ content, noteId, onChange, editable = true, onUploadFiles, uploading = false }: Props) {
  const showMicControls = useUiStore((s) => s.showMicControls)
  const [searchOpen, setSearchOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [, setSelectionUpdateToken] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFiles = useRef(onUploadFiles)
  uploadFiles.current = onUploadFiles
  const lastEmittedHtml = useRef(content)
  const lastNoteId = useRef(noteId)

  interface HistoryItem {
    id: string
    content: string
    timestamp: number
  }
  const [aiHistory, setAiHistory] = useState<HistoryItem[]>([])
  const [comparisonData, setComparisonData] = useState<{
    oldText: string
    newText: string
    isSelectionOnly: boolean
    from?: number
    to?: number
  } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const [editorMenuCoords, setEditorMenuCoords] = useState<{ x: number; y: number } | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      HighlightMark,
      ChecklistItem,
      TelegramMediaNode,
      CopyBlockNode,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEmittedHtml.current = html
      onChange(html)
    },
    onSelectionUpdate: () => setSelectionUpdateToken((t) => t + 1),
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (!files.length || !uploadFiles.current) return false
        event.preventDefault()
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        void insertUploadedMediaAt(files, coords?.pos ?? view.state.selection.from)
        return true
      },
      handlePaste: (view, event) => {
        const files = extractClipboardFiles(event.clipboardData)
        if (!files.length || !uploadFiles.current) return false
        event.preventDefault()
        void insertUploadedMediaAt(files, view.state.selection.from)
        return true
      },
    },
  })

  async function insertUploadedMediaAt(files: File[], pos?: number) {
    if (!uploadFiles.current) return
    const result = await uploadFiles.current(files)
    if (!editor || !Array.isArray(result) || result.length === 0) return
    const nodes = result.map((att) => ({
      type: 'telegramMedia',
      attrs: {
        attachmentId: att.id,
        fileName: att.manifest.fileName,
        mimeType: att.manifest.mimeType,
        size: att.manifest.size,
        manifestJson: JSON.stringify(att.manifest),
      },
    }))
    const targetPos = typeof pos === 'number' ? Math.min(pos, editor.state.doc.content.size) : editor.state.selection.from
    editor.chain().focus().insertContentAt(targetPos, nodes).run()
    const html = editor.getHTML()
    lastEmittedHtml.current = html
    onChange(html)
  }

  // Speech to Text
  const {
    isListening,
    toggleListening,
    isSupported: speechSupported,
  } = useSpeechToText((transcript) => {
    if (editor) {
      editor.chain().focus().insertContent(transcript).run()
    }
  })

  // Sync external content changes (e.g. note switch, history restore, remote collaboration) without clobbering active typing.
  useEffect(() => {
    if (!editor) return
    const switchedNote = noteId !== lastNoteId.current
    lastNoteId.current = noteId
    if (!switchedNote && content === lastEmittedHtml.current) return
    if (content !== editor.getHTML()) {
      lastEmittedHtml.current = content
      editor.commands.setContent(content, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, noteId, editor])

  // Auto-focus find input when search bar opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        const findInput = document.getElementById('editor-find-input')
        if (findInput) (findInput as HTMLInputElement).focus()
      }, 50)
    }
  }, [searchOpen])

  // Close editor context menu on click away
  useEffect(() => {
    if (!editorMenuCoords) return

    function handleClose() {
      setEditorMenuCoords(null)
    }

    document.addEventListener('click', handleClose)
    document.addEventListener('contextmenu', handleClose)
    return () => {
      document.removeEventListener('click', handleClose)
      document.removeEventListener('contextmenu', handleClose)
    }
  }, [editorMenuCoords])

  // Close history dropdown on click away
  useEffect(() => {
    if (!historyOpen) return
    function handleClose() {
      setHistoryOpen(false)
    }
    document.addEventListener('click', handleClose)
    return () => {
      document.removeEventListener('click', handleClose)
    }
  }, [historyOpen])

  if (!editor) return null

  const findMatches = (find: string): { from: number; to: number }[] => {
    if (!find || !editor) return []
    const matches: { from: number; to: number }[] = []
    try {
      const regex = new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          let match
          while ((match = regex.exec(node.text)) !== null) {
            const start = pos + match.index
            const end = start + match[0].length
            matches.push({ from: start, to: end })
          }
        }
      })
    } catch {
      // ignore invalid regex
    }
    return matches
  }

  const matches = findMatches(findText)
  const currentIdx = editor
    ? matches.findIndex((m) => m.from === editor.state.selection.from && m.to === editor.state.selection.to)
    : -1

  async function handleCut() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        editor.chain().focus().deleteSelection().run()
        toast.success('Cut selection')
      } catch {
        toast.error('Cut failed')
      }
    }
    setEditorMenuCoords(null)
  }

  async function handleCopy() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        toast.success('Copied selection')
      } catch {
        toast.error('Copy failed')
      }
    }
    setEditorMenuCoords(null)
  }

  async function handlePaste() {
    if (!editor) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        editor.chain().focus().insertContent(text).run()
      }
    } catch {
      toast.error('Clipboard permission denied')
    }
    setEditorMenuCoords(null)
  }

  function handleEditorContextMenu(e: React.MouseEvent) {
    if (!editable) return
    e.preventDefault()
    e.stopPropagation()
    
    // Close global context menu
    setContextMenu(null)

    // Position menu at cursor
    const menuWidth = 200
    const menuHeight = 280
    let posX = e.clientX
    let posY = e.clientY

    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 10
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 10
    }

    setEditorMenuCoords({ x: Math.max(10, posX), y: Math.max(10, posY) })
  }

  function handleReplace(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!editor || !findText) return

    const { state, view } = editor
    const { selection } = state
    const currentMatches = findMatches(findText)

    if (currentMatches.length === 0) {
      toast.error('No matches found')
      return
    }

    const selectedText = state.doc.textBetween(selection.from, selection.to, ' ')
    const isCurrentMatch = selectedText === findText

    if (isCurrentMatch) {
      const tr = state.tr
      tr.replaceWith(selection.from, selection.to, state.schema.text(replaceText))
      view.dispatch(tr)
      onChange(editor.getHTML())

      const newMatches = findMatches(findText)
      if (newMatches.length > 0) {
        const nextPos = selection.from + replaceText.length
        const nextMatch = newMatches.find((m) => m.from >= nextPos) || newMatches[0]
        editor.commands.setTextSelection({ from: nextMatch.from, to: nextMatch.to })
      } else {
        toast.success('Replaced! No more matches found.')
      }
    } else {
      const nextMatch = currentMatches.find((m) => m.from >= selection.from) || currentMatches[0]
      editor.commands.setTextSelection({ from: nextMatch.from, to: nextMatch.to })
    }
  }

  function handleFindNext(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!editor || !findText) return
    const currentMatches = findMatches(findText)
    if (currentMatches.length === 0) {
      toast.error('No matches found')
      return
    }
    const { selection } = editor.state
    const nextMatch = currentMatches.find((m) => m.from > selection.from) || currentMatches[0]
    editor.commands.setTextSelection({ from: nextMatch.from, to: nextMatch.to })
  }

  function handleReplaceAll(e: React.FormEvent) {
    e.preventDefault()
    if (!editor || !findText) return
    const { state, view } = editor
    const { tr } = state
    const currentMatches = findMatches(findText)

    if (currentMatches.length === 0) {
      toast.error('No matches found')
      return
    }

    for (let i = currentMatches.length - 1; i >= 0; i--) {
      const { from, to } = currentMatches[i]
      tr.replaceWith(from, to, state.schema.text(replaceText))
    }

    if (tr.docChanged) {
      view.dispatch(tr)
      onChange(editor.getHTML())
      toast.success(`Successfully replaced ${currentMatches.length} occurrences!`)
      setFindText('')
      setReplaceText('')
      setSearchOpen(false)
    }
  }

  async function handleAiAssist(action: 'format' | 'summarize') {
    if (!editor) return
    setAiLoading(true)
    setEditorMenuCoords(null)
    const toastId = toast.loading('AI is processing your request...')
    try {
      const { from, to } = editor.state.selection
      const hasSelection = from !== to
      const contentToProcess = hasSelection
        ? editor.state.doc.textBetween(from, to, ' ')
        : editor.getHTML()

      let result = ''
      if (action === 'format') {
        result = await askGeminiToFormat(contentToProcess)
      } else {
        result = await askGeminiToSummarize(contentToProcess)
      }

      setComparisonData({
        oldText: contentToProcess,
        newText: result,
        isSelectionOnly: hasSelection,
        from: hasSelection ? from : undefined,
        to: hasSelection ? to : undefined,
      })
      toast.success('AI generation complete. Review changes to apply.', { id: toastId })
    } catch (err) {
      toast.error((err as Error).message, { id: toastId })
    } finally {
      setAiLoading(false)
    }
  }

  function handleApplyAiEditor(newText: string, isSelectionOnly: boolean, from?: number, to?: number) {
    if (!editor) return
    const currentFullContent = editor.getHTML()
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(),
      content: currentFullContent,
      timestamp: Date.now(),
    }
    setAiHistory((prev) => [newItem, ...prev].slice(0, 10))

    if (isSelectionOnly && typeof from === 'number' && typeof to === 'number') {
      editor.chain().focus().insertContentAt({ from, to }, newText).run()
    } else {
      editor.commands.setContent(newText, true)
    }
    onChange(editor.getHTML())
    setComparisonData(null)
    toast.success('Applied AI changes!')
  }

  function handleCompareHistory(historyContent: string) {
    if (!editor) return
    setComparisonData({
      oldText: editor.getHTML(),
      newText: historyContent,
      isSelectionOnly: false,
    })
  }

  function handleHighlight(color: typeof highlightColors[number]) {
    if (!editor) return
    editor.chain().focus().toggleMark('highlightMark', { color }).run()
  }

  function handleChecklist() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n').trim()
    const lines = selectedText
      ? selectedText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
      : ['Task item']
    const html = toChecklistHtml(lines)
    if (from !== to) {
      editor.chain().focus().insertContentAt({ from, to }, html).run()
    } else {
      editor.chain().focus().insertContent(html).run()
    }
    onChange(editor.getHTML())
  }

  function handleCopyBlock() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n').trim()
    const contentNode = selectedText
      ? { type: 'copyBlock', content: [{ type: 'text', text: selectedText }] }
      : { type: 'copyBlock' }
    if (from !== to) {
      editor.chain().focus().insertContentAt({ from, to }, contentNode).run()
    } else {
      editor.chain().focus().insertContent(contentNode).run()
    }
    onChange(editor.getHTML())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!editor) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      if (searchOpen) {
        const findInput = document.getElementById('editor-find-input')
        if (findInput && document.activeElement === findInput) {
          setSearchOpen(false)
        } else if (findInput) {
          findInput.focus()
        }
      } else {
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        if (selectedText && selectedText.trim()) {
          setFindText(selectedText)
        }
        setSearchOpen(true)
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault()
      if (searchOpen) {
        const replaceInput = document.getElementById('editor-replace-input')
        if (replaceInput && document.activeElement === replaceInput) {
          setSearchOpen(false)
        } else if (replaceInput) {
          replaceInput.focus()
        }
      } else {
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        if (selectedText && selectedText.trim()) {
          setFindText(selectedText)
        }
        setSearchOpen(true)
      }
    }
  }

  return (
    <div className="flex flex-col" onKeyDown={handleKeyDown}>
      {editable && (
        <div className="sticky top-0 z-10 mb-3 flex flex-col border-b border-hairline bg-canvas/90 backdrop-blur dark:border-gray-800 dark:bg-dark/90">
          <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap items-center gap-0.5 py-2">
            <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold size={18} />
            </ToolbarButton>
            <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic size={18} />
            </ToolbarButton>
            <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough size={18} />
            </ToolbarButton>
            <ToolbarButton label="Checklist" active={editor.isActive('checklistItem')} onClick={handleChecklist}>
              <ListChecks size={18} />
            </ToolbarButton>
            <ToolbarButton label="Khối Copy Nhanh" active={editor.isActive('copyBlock')} onClick={handleCopyBlock}>
              <ClipboardCopy size={18} />
            </ToolbarButton>
            {onUploadFiles && (
              <>
                <ToolbarButton
                  label="Upload attachment to Telegram"
                  active={uploading}
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                </ToolbarButton>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? [])
                    if (files.length) void insertUploadedMediaAt(files)
                    event.currentTarget.value = ''
                  }}
                />
              </>
            )}
            <span className="mx-1 h-5 w-px bg-hairline dark:bg-gray-850" />
            <div className="flex items-center gap-1 px-1" title="Highlight">
              <Highlighter size={16} className="text-ink-muted" />
              {highlightColors.map((colorKey) => (
                <button
                  key={colorKey}
                  type="button"
                  onClick={() => handleHighlight(colorKey)}
                  aria-label={`Highlight ${colorKey}`}
                  className={cn(
                    'h-4 w-4 rounded-full border border-white/70 transition hover:scale-110',
                    editor.isActive('highlightMark', { color: colorKey }) && 'ring-2 ring-primary ring-offset-1 dark:ring-offset-dark',
                  )}
                  data-highlight-swatch={colorKey}
                />
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-hairline dark:bg-gray-850" />
            <ToolbarButton label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <Heading1 size={18} />
            </ToolbarButton>
            <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={18} />
            </ToolbarButton>
            <span className="mx-1 h-5 w-px bg-hairline dark:bg-gray-850" />
            <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List size={18} />
            </ToolbarButton>
            <ToolbarButton label="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={18} />
            </ToolbarButton>
            <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote size={18} />
            </ToolbarButton>
            <ToolbarButton label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
              <Code2 size={18} />
            </ToolbarButton>
            <span className="mx-1 h-5 w-px bg-hairline dark:bg-gray-850" />
            <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 size={18} />
            </ToolbarButton>
            <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 size={18} />
            </ToolbarButton>
            <span className="mx-1 h-5 w-px bg-hairline dark:bg-gray-850" />
            <ToolbarButton
              label="Find & Replace"
              active={searchOpen}
              onClick={() => {
                if (!searchOpen) {
                  const { from, to } = editor.state.selection
                  const selectedText = editor.state.doc.textBetween(from, to, ' ')
                  if (selectedText && selectedText.trim()) {
                    setFindText(selectedText)
                  }
                }
                setSearchOpen(!searchOpen)
              }}
            >
              <Search size={18} />
            </ToolbarButton>

            {/* AI and Speech features */}
            <span className="mx-1 h-5 w-px bg-hairline dark:bg-gray-850" />
            {showMicControls && speechSupported && (
              <ToolbarButton
                label="Talk to Text"
                active={isListening}
                onClick={toggleListening}
              >
                {isListening ? <MicOff size={18} className="text-error animate-pulse" /> : <Mic size={18} />}
              </ToolbarButton>
            )}
            <ToolbarButton
              label="AI Assist (Clean & Format)"
              active={aiLoading}
              onClick={() => handleAiAssist('format')}
            >
              {aiLoading ? <Loader2 size={18} className="animate-spin text-primary" /> : <Sparkles size={18} className="text-primary" />}
            </ToolbarButton>
            <ToolbarButton
              label="AI Summarize"
              active={aiLoading}
              onClick={() => handleAiAssist('summarize')}
            >
              <Wand2 size={18} className="text-accent-teal" />
            </ToolbarButton>

            {/* AI History Dropdown */}
            {aiHistory.length > 0 && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <ToolbarButton
                  label="AI History"
                  active={historyOpen}
                  onClick={() => setHistoryOpen(!historyOpen)}
                >
                  <History size={18} className="text-primary" />
                </ToolbarButton>
                
                {historyOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-xl border border-hairline bg-canvas/95 p-2 shadow-2xl backdrop-blur-md dark:border-gray-800 dark:bg-dark-elevated/95 select-none text-ink">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">AI History ({aiHistory.length}/10)</span>
                      <button
                        onClick={() => { setAiHistory([]); setHistoryOpen(false); }}
                        className="text-[10px] text-error hover:underline font-semibold"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-0.5">
                      {aiHistory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded border border-hairline bg-canvas-soft/60 p-1.5 text-xs dark:border-gray-855 dark:bg-dark/40"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-ink-muted font-semibold">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="truncate text-ink-body dark:text-gray-300 font-mono text-[10px]">
                              {item.content.replace(/<[^>]*>/g, '')}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                handleCompareHistory(item.content)
                                setHistoryOpen(false)
                              }}
                              className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary hover:bg-primary/20"
                            >
                              Compare
                            </button>
                            <button
                              onClick={() => setAiHistory((prev) => prev.filter((h) => h.id !== item.id))}
                              className="rounded p-0.5 text-ink-muted hover:bg-error/15 hover:text-error transition"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Find & Replace Panel */}
          {searchOpen && (
            <form onSubmit={handleReplaceAll} className="flex flex-wrap items-center gap-3 border-t border-hairline py-2.5 animate-slide-down dark:border-gray-800">
              <div className="flex flex-1 min-w-[200px] items-center gap-2">
                <input
                  id="editor-find-input"
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleFindNext()
                    }
                  }}
                  placeholder="Find text..."
                  className="w-full rounded-md border border-hairline bg-canvas px-2.5 py-1 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated"
                />
              </div>
              <div className="flex flex-1 min-w-[200px] items-center gap-2">
                <input
                  id="editor-replace-input"
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleReplace()
                    }
                  }}
                  placeholder="Replace with..."
                  className="w-full rounded-md border border-hairline bg-canvas px-2.5 py-1 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated"
                />
              </div>
              <div className="flex items-center gap-2">
                {findText && (
                  <span className="text-xs text-ink-muted font-medium mr-1 select-none">
                    {currentIdx >= 0 ? `${currentIdx + 1} of ${matches.length}` : `${matches.length} matches`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleFindNext()}
                  disabled={!findText || matches.length === 0}
                  className="flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-body transition hover:bg-canvas-card active:scale-95 disabled:opacity-40 disabled:pointer-events-none dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-300 dark:hover:bg-dark"
                >
                  Find Next
                </button>
                <button
                  type="button"
                  onClick={() => handleReplace()}
                  disabled={!findText || matches.length === 0}
                  className="flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-body transition hover:bg-canvas-card active:scale-95 disabled:opacity-40 disabled:pointer-events-none dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-300 dark:hover:bg-dark"
                >
                  Replace
                </button>
                <button
                  type="submit"
                  disabled={!findText || matches.length === 0}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RefreshCw size={12} /> Replace All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false)
                    setFindText('')
                    setReplaceText('')
                  }}
                  className="rounded-md p-1 text-ink-muted hover:bg-canvas-card hover:text-ink dark:hover:bg-dark-elevated"
                >
                  <X size={14} />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      <div onContextMenu={handleEditorContextMenu} className="relative min-h-[300px]">
        <EditorContent editor={editor} />
      </div>

      {editorMenuCoords && (
        <div
          style={{ top: editorMenuCoords.y, left: editorMenuCoords.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 animate-fade-in rounded-xl border border-hairline bg-canvas/95 p-1.5 shadow-xl backdrop-blur-md dark:border-gray-855 dark:bg-dark-elevated/95 select-none text-ink"
        >
          <div className="flex flex-col gap-0.5">
            <button
              onClick={handleCut}
              disabled={editor.state.selection.empty}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card disabled:opacity-40 disabled:pointer-events-none dark:text-gray-300 dark:hover:bg-dark"
            >
              <div className="flex items-center gap-2">
                <Scissors size={15} />
                <span>Cut</span>
              </div>
              <span className="text-xs text-ink-muted">Ctrl+X</span>
            </button>
            <button
              onClick={handleCopy}
              disabled={editor.state.selection.empty}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card disabled:opacity-40 disabled:pointer-events-none dark:text-gray-300 dark:hover:bg-dark"
            >
              <div className="flex items-center gap-2">
                <Copy size={15} />
                <span>Copy</span>
              </div>
              <span className="text-xs text-ink-muted">Ctrl+C</span>
            </button>
            <button
              onClick={handlePaste}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark"
            >
              <div className="flex items-center gap-2">
                <Clipboard size={15} />
                <span>Paste</span>
              </div>
              <span className="text-xs text-ink-muted">Ctrl+V</span>
            </button>

            <div className="my-1 border-t border-hairline dark:border-gray-800" />

            <button
              onClick={() => {
                editor.chain().focus().toggleBold().run()
                setEditorMenuCoords(null)
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark",
                editor.isActive('bold') && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
            >
              <div className="flex items-center gap-2">
                <Bold size={15} />
                <span>Bold</span>
              </div>
              <span className="text-xs text-ink-muted">Ctrl+B</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleItalic().run()
                setEditorMenuCoords(null)
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark",
                editor.isActive('italic') && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
            >
              <div className="flex items-center gap-2">
                <Italic size={15} />
                <span>Italic</span>
              </div>
              <span className="text-xs text-ink-muted">Ctrl+I</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleStrike().run()
                setEditorMenuCoords(null)
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark",
                editor.isActive('strike') && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
            >
              <div className="flex items-center gap-2">
                <Strikethrough size={15} />
                <span>Strikethrough</span>
              </div>
              <span className="text-xs text-ink-muted"></span>
            </button>

            <div className="my-1 border-t border-hairline dark:border-gray-800" />

            <button
              onClick={() => {
                const { from, to } = editor.state.selection
                const selectedText = editor.state.doc.textBetween(from, to, ' ')
                if (selectedText && selectedText.trim()) {
                  setFindText(selectedText)
                }
                setSearchOpen(true)
                setEditorMenuCoords(null)
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark"
            >
              <div className="flex items-center gap-2">
                <Search size={15} />
                <span>Find & Replace</span>
              </div>
              <span className="text-xs text-ink-muted">Ctrl+F</span>
            </button>

            <div className="my-1 border-t border-hairline dark:border-gray-800" />

            <button
              onClick={() => handleAiAssist('format')}
              disabled={aiLoading}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-primary animate-pulse" />
                <span>AI Clean & Format</span>
              </div>
            </button>
            <button
              onClick={() => handleAiAssist('summarize')}
              disabled={aiLoading}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-ink-body hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark"
            >
              <div className="flex items-center gap-2">
                <Wand2 size={15} className="text-accent-teal" />
                <span>AI Summarize</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal Overlay */}
      {comparisonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setComparisonData(null)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px] transition-opacity animate-fade-in"
          />

          <div className="relative z-10 flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-hairline bg-canvas p-6 shadow-2xl backdrop-blur-md dark:border-gray-800 dark:bg-dark-elevated/95 animate-scale-in">
            <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3 dark:border-gray-800">
              <h3 className="font-serif text-lg font-medium text-ink dark:text-gray-100 flex items-center gap-1.5">
                <Sparkles size={20} className="text-primary" /> Compare AI Changes
              </h3>
              <button
                onClick={() => setComparisonData(null)}
                className="rounded-full p-1 text-ink-muted hover:bg-canvas-card dark:hover:bg-dark"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 flex-col sm:flex-row gap-4 overflow-hidden min-h-0 mb-5">
              {/* Before Column */}
              <div className="flex flex-1 flex-col rounded-xl border border-hairline bg-canvas-soft p-4 dark:border-gray-855 dark:bg-dark/40 overflow-hidden">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-2 select-none">Before (Original)</span>
                <div className="flex-1 overflow-y-auto pr-1">
                  {comparisonData.isSelectionOnly ? (
                    <div className="text-sm text-ink-body dark:text-gray-300 font-mono whitespace-pre-wrap break-all">
                      {comparisonData.oldText}
                    </div>
                  ) : (
                    <div
                      className="prose dark:prose-invert max-w-none text-xs text-ink-body dark:text-gray-300 pr-1 break-words"
                      dangerouslySetInnerHTML={{ __html: comparisonData.oldText || '<p class="italic text-ink-muted/50">Empty document</p>' }}
                    />
                  )}
                </div>
              </div>

              {/* After Column */}
              <div className="flex flex-1 flex-col rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/10 dark:bg-primary/5 overflow-hidden">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 select-none font-semibold">After (AI Proposal)</span>
                <div className="flex-1 overflow-y-auto pr-1">
                  {comparisonData.isSelectionOnly ? (
                    <div className="text-sm text-ink-body dark:text-gray-300 font-mono whitespace-pre-wrap break-all font-semibold">
                      {comparisonData.newText}
                    </div>
                  ) : (
                    <div
                      className="prose dark:prose-invert max-w-none text-xs text-ink-body dark:text-gray-300 pr-1 break-words font-semibold"
                      dangerouslySetInnerHTML={{ __html: comparisonData.newText }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-hairline pt-4 dark:border-gray-800">
              <button
                onClick={() => setComparisonData(null)}
                className="rounded-lg bg-canvas-card px-4 py-2 text-sm font-semibold text-ink-body hover:bg-canvas-card-hover dark:bg-dark dark:text-gray-300 transition"
              >
                Discard Suggestion
              </button>
              <button
                onClick={() => handleApplyAiEditor(comparisonData.newText, comparisonData.isSelectionOnly, comparisonData.from, comparisonData.to)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover active:scale-95 shadow-md transition"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

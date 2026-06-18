import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'
import { useUiStore } from '@/store/uiStore'

interface Props {
  content: string
  onChange: (html: string) => void
  editable?: boolean
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-md p-1.5 text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  )
}

export default function TiptapEditor({ content, onChange, editable = true }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [, setSelectionUpdateToken] = useState(0)

  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const [editorMenuCoords, setEditorMenuCoords] = useState<{ x: number; y: number } | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onSelectionUpdate: () => setSelectionUpdateToken((t) => t + 1),
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
    },
  })

  // Sync external content changes (e.g. note switch) without clobbering typing.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

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
          <div className="flex flex-wrap items-center gap-0.5 py-2">
            <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold size={18} />
            </ToolbarButton>
            <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic size={18} />
            </ToolbarButton>
            <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough size={18} />
            </ToolbarButton>
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
          className="fixed z-50 w-52 animate-fade-in rounded-xl border border-hairline bg-canvas/95 p-1.5 shadow-xl backdrop-blur-md dark:border-gray-850 dark:bg-dark-elevated/95 select-none text-ink"
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
          </div>
        </div>
      )}
    </div>
  )
}

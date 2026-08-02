import { useState } from 'react'
import { Mic, MicOff, Sparkles, X, FileText, Save, Trash2, Loader2, Languages, ListTodo } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useSpeechToText } from '@/shared/hooks/useSpeechToText'
import { createNote } from '@/tools/notes/services/noteService'
import { createTask } from '@/tools/notes/tasks/services/taskService'
import { askGeminiToFormatSpeech } from '@/shared/utils/ai'
import { useUiStore } from '@/shared/store/uiStore'

export default function QuickCapture() {
  const { user } = useAuth()
  const showMicControls = useUiStore((s) => s.showMicControls)
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<'note' | 'task'>('note')
  const [lang, setLang] = useState<'vi-VN' | 'en-US'>('vi-VN')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  interface HistoryItem {
    id: string
    content: string
    timestamp: number
  }
  const [aiHistory, setAiHistory] = useState<HistoryItem[]>([])
  const [comparisonData, setComparisonData] = useState<{ oldText: string; newText: string } | null>(null)

  const { isListening, toggleListening, isSupported } = useSpeechToText((transcript) => {
    setContent((prev) => (prev ? prev + ' ' + transcript : transcript))
  }, lang)

  function handleClear() {
    setTitle('')
    setContent('')
    setAiHistory([])
    setComparisonData(null)
  }

  async function handleAiFormat() {
    if (!content.trim()) return
    setAiLoading(true)
    const toastId = toast.loading('AI is formatting text...')
    try {
      const formatted = await askGeminiToFormatSpeech(content)
      setComparisonData({ oldText: content, newText: formatted })
      toast.success('AI generation complete. Compare changes below.', { id: toastId })
    } catch (err) {
      toast.error((err as Error).message, { id: toastId })
    } finally {
      setAiLoading(false)
    }
  }

  function handleApplyAi(newText: string) {
    if (comparisonData) {
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(2) + Date.now().toString(),
        content: comparisonData.oldText,
        timestamp: Date.now(),
      }
      setAiHistory((prev) => [newItem, ...prev].slice(0, 10))
      setContent(newText)
      setComparisonData(null)
      toast.success('Applied AI formatting!')
    }
  }

  function handleUndo() {
    if (aiHistory.length === 0) return
    const [prev, ...rest] = aiHistory
    setContent(prev.content)
    setAiHistory(rest)
    toast.success('Undone AI formatting!')
  }

  async function handleSave() {
    if (!user) return
    if (!content.trim()) {
      toast.error(type === 'note' ? 'Please enter content first.' : 'Please enter task title first.')
      return
    }

    setSaving(true)
    try {
      if (type === 'note') {
        const contentHtml = `<p>${content.replace(/\n/g, '<br>')}</p>`
        await createNote(user.uid, {
          title: title.trim() || 'Quick Note',
          content: contentHtml,
        })
        toast.success('Quick note saved!')
      } else {
        await createTask(user.uid, {
          title: content.trim(),
          dueDate: null,
        })
        toast.success('Task saved!')
      }
      handleClear()
      setIsOpen(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const isGeminiEnabled = !!(localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY)

  if (!showMicControls) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 select-none">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Quick Capture (Voice / Text)"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-accent-teal text-white shadow-lg transition duration-200 hover:scale-105 active:scale-95 animate-bounce-soft"
        >
          <Mic size={22} className="animate-pulse" />
        </button>
      )}

      {/* Quick Capture Panel */}
      {isOpen && (
        <div className="absolute bottom-0 right-0 w-[350px] sm:w-[420px] rounded-xl border border-hairline bg-canvas/95 p-5 shadow-2xl backdrop-blur-md dark:border-gray-800 dark:bg-dark-elevated/95 animate-scale-in">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-lg font-medium text-ink dark:text-gray-100 flex items-center gap-1.5">
              <Sparkles size={18} className="text-primary" /> Quick Capture
            </h3>
            
            {/* Language Selection */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLang(lang === 'vi-VN' ? 'en-US' : 'vi-VN')}
                title="Change language"
                className="flex items-center gap-1 rounded border border-hairline bg-canvas-soft px-2 py-0.5 text-xs text-ink-muted transition hover:bg-canvas-card dark:border-gray-850 dark:bg-dark"
              >
                <Languages size={12} />
                <span>{lang === 'vi-VN' ? 'VI' : 'EN'}</span>
              </button>
              
              <button
                onClick={() => {
                  setIsOpen(false)
                  if (isListening) toggleListening()
                }}
                className="rounded-full p-1 text-ink-muted hover:bg-canvas-card hover:text-ink dark:hover:bg-dark"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Toggle Type tabs */}
          <div className="mb-4 flex rounded-lg bg-canvas-soft p-1 dark:bg-dark">
            <button
              onClick={() => setType('note')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                type === 'note'
                  ? 'bg-canvas-card text-primary shadow-sm dark:bg-dark-elevated dark:text-primary'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <FileText size={14} /> Note
            </button>
            <button
              onClick={() => setType('task')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                type === 'task'
                  ? 'bg-canvas-card text-primary shadow-sm dark:bg-dark-elevated dark:text-primary'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <ListTodo size={14} /> Task
            </button>
          </div>

          {/* Input Fields */}
          <div className="flex flex-col gap-2">
            {type === 'note' && (
              <input
                type="text"
                placeholder="Title (Optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-200"
              />
            )}

            <div className="relative">
              <textarea
                placeholder={type === 'note' ? 'Start speaking or type here...' : 'E.g., "Họp nhóm lúc 2h chiều nay" or "Task 1, Task 2..."'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    if (aiHistory.length > 0) {
                      e.preventDefault()
                      handleUndo()
                    }
                  }
                }}
                rows={4}
                className="w-full rounded-md border border-hairline bg-canvas p-3 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-200 resize-none pr-10"
              />
              
              {/* Mic Icon Trigger */}
              {isSupported ? (
                <button
                  onClick={toggleListening}
                  title={isListening ? 'Stop listening' : 'Start voice recognition'}
                  className={`absolute bottom-3 right-3 rounded-full p-2 shadow-sm transition active:scale-90 ${
                    isListening
                      ? 'bg-error text-white animate-pulse'
                      : 'bg-primary text-white hover:bg-primary-hover'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              ) : (
                <span className="absolute bottom-3 right-3 text-[10px] text-error font-medium select-none">No Mic Support</span>
              )}
            </div>
          </div>

          {/* Active Voice Wave Effect */}
          {isListening && (
            <div className="mt-2.5 flex items-center justify-center gap-1 py-1.5">
              <span className="text-xs text-error font-semibold animate-pulse">Recording voice...</span>
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-error animate-voice-bar-1 rounded-full" />
                <span className="w-0.5 bg-error animate-voice-bar-2 rounded-full" />
                <span className="w-0.5 bg-error animate-voice-bar-3 rounded-full" />
                <span className="w-0.5 bg-error animate-voice-bar-4 rounded-full" />
              </div>
            </div>
          )}

          {/* AI Helper Actions */}
          {content.trim() && isGeminiEnabled && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={handleAiFormat}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-40"
              >
                <Sparkles size={12} /> AI Format
              </button>
            </div>
          )}

          {content.trim() && !isGeminiEnabled && (
            <div className="mt-3 rounded-lg border border-warning/20 bg-warning/5 p-2.5 text-xs text-ink-body dark:text-gray-300">
              💡 Configure Gemini API Key in Settings or{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-bold"
              >
                Get API Key here
              </a>{' '}
              to enable AI features.
            </div>
          )}

          {/* AI History Accordion */}
          {aiHistory.length > 0 && (
            <div className="mt-3 border-t border-hairline pt-3 dark:border-gray-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">AI History ({aiHistory.length}/10)</span>
                <button
                  onClick={() => setAiHistory([])}
                  className="text-[10px] text-error hover:underline font-semibold"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-24 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {aiHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded border border-hairline bg-canvas-soft/60 p-1.5 text-xs dark:border-gray-850 dark:bg-dark/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-ink-muted font-semibold">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="truncate text-ink-body dark:text-gray-300 font-mono text-[11px]">
                        {item.content}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setComparisonData({ oldText: content, newText: item.content })}
                        className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20"
                        title="Compare & Rollback"
                      >
                        Compare
                      </button>
                      <button
                        onClick={() => setAiHistory((prev) => prev.filter((h) => h.id !== item.id))}
                        className="rounded p-0.5 text-ink-muted hover:bg-error/15 hover:text-error transition"
                        title="Delete entry"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5 dark:border-gray-800">
            <div className="flex gap-1.5">
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-canvas-card dark:hover:bg-dark-elevated transition"
              >
                <Trash2 size={13} /> Clear
              </button>
              {aiHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  title="Ctrl + Z"
                >
                  Undo AI
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || aiLoading || !content.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-45"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Comparison Overlay inside the Panel */}
          {comparisonData && (
            <div className="absolute inset-0 z-20 flex flex-col rounded-xl bg-canvas p-5 dark:bg-dark-elevated">
              <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2 dark:border-gray-800">
                <h4 className="font-serif text-sm font-semibold text-ink dark:text-gray-100 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" /> Compare AI Changes
                </h4>
                <button
                  onClick={() => setComparisonData(null)}
                  className="rounded-full p-1 text-ink-muted hover:bg-canvas-card dark:hover:bg-dark"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-1 gap-2.5 overflow-hidden min-h-0 mb-4">
                {/* Old version */}
                <div className="flex flex-1 flex-col rounded border border-hairline bg-canvas-soft p-2.5 dark:border-gray-855 dark:bg-dark/40 overflow-hidden">
                  <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mb-1.5 select-none">Before (Original)</span>
                  <div className="flex-1 overflow-y-auto text-xs text-ink-body dark:text-gray-300 whitespace-pre-wrap break-all pr-1 font-mono">
                    {comparisonData.oldText || <span className="italic text-ink-muted/50">(empty)</span>}
                  </div>
                </div>

                {/* New version */}
                <div className="flex flex-1 flex-col rounded border border-primary/20 bg-primary/5 p-2.5 dark:border-primary/10 dark:bg-primary/5 overflow-hidden">
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider mb-1.5 select-none font-semibold">After (AI Proposal)</span>
                  <div className="flex-1 overflow-y-auto text-xs text-ink-body dark:text-gray-300 whitespace-pre-wrap break-all pr-1 font-semibold font-mono">
                    {comparisonData.newText}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-hairline pt-3 dark:border-gray-800">
                <button
                  onClick={() => setComparisonData(null)}
                  className="rounded bg-canvas-card px-3 py-1.5 text-xs font-semibold text-ink-body hover:bg-canvas-card-hover dark:bg-dark dark:text-gray-300"
                >
                  Discard
                </button>
                <button
                  onClick={() => handleApplyAi(comparisonData.newText)}
                  className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover active:scale-95 shadow-sm"
                >
                  Apply Suggestion
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

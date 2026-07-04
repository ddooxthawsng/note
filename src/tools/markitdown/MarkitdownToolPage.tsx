import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  Cloud,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  convertDocument,
  fetchQuota,
  formatFileSize,
  getFileExtension,
  getSavedBackendMode,
  maxFileBytes,
  saveBackendMode,
  validateDocumentFile,
  type BackendMode,
  type Quota,
} from '@/tools/markitdown/markitdownApi'
import { cn } from '@/shared/utils/cn'

type ConvertState = 'idle' | 'ready' | 'converting' | 'done'
type ViewerMode = 'preview' | 'raw'

export default function MarkitdownToolPage() {
  const [backendMode, setBackendMode] = useState<BackendMode>(() => getSavedBackendMode())
  const [quota, setQuota] = useState<Quota | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(true)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState('')
  const [convertedName, setConvertedName] = useState('')
  const [state, setState] = useState<ConvertState>('idle')
  const [viewerMode, setViewerMode] = useState<ViewerMode>('preview')

  const quotaExhausted = Boolean(quota?.enabled && quota.remaining <= 0)
  const canConvert = Boolean(file && !fileError && state !== 'converting' && !quotaExhausted)

  useEffect(() => {
    let alive = true
    setQuotaLoading(true)
    setQuotaError(null)

    fetchQuota(backendMode)
      .then((nextQuota) => {
        if (!alive) return
        setQuota(nextQuota)
      })
      .catch((error: Error) => {
        if (!alive) return
        setQuota(null)
        setQuotaError(error.message)
      })
      .finally(() => {
        if (alive) setQuotaLoading(false)
      })

    return () => {
      alive = false
    }
  }, [backendMode])

  function changeBackendMode(mode: BackendMode) {
    setBackendMode(mode)
    saveBackendMode(mode)
  }

  function selectFile(nextFile: File) {
    const error = validateDocumentFile(nextFile)
    setFile(nextFile)
    setFileError(error)
    setMarkdown('')
    setConvertedName('')
    setState(error ? 'idle' : 'ready')
  }

  async function handleConvert() {
    if (!file || fileError) return
    if (quotaExhausted) {
      toast.error('You have reached your monthly free limit.')
      return
    }

    setState('converting')
    try {
      const result = await convertDocument(file, backendMode)
      setMarkdown(result.markdown)
      setConvertedName(result.filename)
      setViewerMode('preview')
      setState('done')
      toast.success('Converted to Markdown')
      setQuota(await fetchQuota(backendMode))
    } catch (error) {
      setState('ready')
      toast.error((error as Error).message)
    }
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown)
    toast.success('Markdown copied')
  }

  function downloadMarkdown() {
    const sourceName = convertedName || file?.name || 'converted'
    const baseName = sourceName.replace(/\.[^.]+$/, '') || 'converted'
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${baseName}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  function clearResult() {
    setMarkdown('')
    setConvertedName('')
    setState(file && !fileError ? 'ready' : 'idle')
  }

  function resetFile() {
    setFile(null)
    setFileError(null)
    setMarkdown('')
    setConvertedName('')
    setState('idle')
  }

  return (
    <div className="w-full flex-1 overflow-y-auto p-4 animate-fade-in-up md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Converter</p>
            <h1 className="text-3xl font-serif font-normal text-ink dark:text-gray-100">MarkItDown</h1>
          </div>
          <BackendSelector mode={backendMode} onChange={changeBackendMode} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <UploadDropzone
              file={file}
              error={fileError}
              state={state}
              onClear={resetFile}
              onFile={selectFile}
            />

            <QuotaCard
              error={quotaError}
              loading={quotaLoading}
              mode={backendMode}
              quota={quota}
            />

            <button
              type="button"
              disabled={!canConvert}
              onClick={handleConvert}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled disabled:text-ink-muted"
            >
              {state === 'converting' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              {quotaExhausted ? 'Quota reached' : state === 'converting' ? 'Converting' : 'Convert'}
            </button>

            {quotaExhausted && (
              <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm font-medium text-error">
                You have reached your monthly free limit.
              </p>
            )}
          </div>

          <section className="min-h-[620px] rounded-md border border-hairline bg-canvas dark:border-gray-800 dark:bg-dark-soft">
            <div className="flex flex-col gap-3 border-b border-hairline p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate font-sans text-lg font-semibold text-ink dark:text-gray-100">
                  {markdown ? convertedName || file?.name : 'Markdown result'}
                </h2>
                <p className="text-sm text-ink-muted">
                  {state === 'converting' ? 'Upload and conversion in progress.' : markdown ? `${markdown.length.toLocaleString()} characters` : 'No result yet.'}
                </p>
              </div>

              <ResultActions
                disabled={!markdown}
                onClear={clearResult}
                onCopy={copyMarkdown}
                onDownload={downloadMarkdown}
                onReset={resetFile}
              />
            </div>

            <MarkdownViewer markdown={markdown} mode={viewerMode} onModeChange={setViewerMode} />
          </section>
        </div>
      </div>
    </div>
  )
}

function BackendSelector({ mode, onChange }: { mode: BackendMode; onChange: (mode: BackendMode) => void }) {
  const options: Array<{ mode: BackendMode; label: string; icon: typeof Cloud }> = [
    { mode: 'firebase', label: 'Firebase', icon: Cloud },
    { mode: 'local', label: 'Local Docker', icon: Server },
  ]

  return (
    <div className="inline-flex w-full rounded-md border border-hairline bg-canvas-card p-1 dark:border-gray-800 dark:bg-dark-elevated sm:w-auto">
      {options.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-ink-muted transition sm:flex-none',
              mode === option.mode && 'bg-canvas text-ink shadow-sm dark:bg-dark dark:text-gray-100',
            )}
          >
            <Icon size={16} />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function UploadDropzone({
  error,
  file,
  onClear,
  onFile,
  state,
}: {
  error: string | null
  file: File | null
  onClear: () => void
  onFile: (file: File) => void
  state: ConvertState
}) {
  const [dragging, setDragging] = useState(false)
  const inputId = 'markitdown-file-input'

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const droppedFile = event.dataTransfer.files.item(0)
    if (droppedFile) onFile(droppedFile)
  }

  return (
    <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-hairline bg-canvas-soft p-5 text-center transition dark:border-gray-700 dark:bg-dark',
          dragging && 'border-primary bg-primary/10',
        )}
      >
        <span className="rounded-md border border-primary/20 bg-primary/10 p-3 text-primary">
          <Upload size={24} />
        </span>
        <span className="font-sans text-base font-semibold text-ink dark:text-gray-100">
          Drop file or browse
        </span>
        <span className="text-xs text-ink-muted">
          Any MarkItDown-supported file / Max {formatFileSize(maxFileBytes)}
        </span>
        <input
          id={inputId}
          type="file"
          className="sr-only"
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.item(0)
            if (nextFile) onFile(nextFile)
            event.currentTarget.value = ''
          }}
        />
      </label>

      {file && (
        <div className="mt-4 rounded-md border border-hairline bg-canvas-card p-3 dark:border-gray-800 dark:bg-dark-elevated">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink dark:text-gray-100">{file.name}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {formatFileSize(file.size)} / {getFileExtension(file.name).toUpperCase() || 'ANY'} / {state === 'converting' ? 'Converting' : error ? 'Rejected' : 'Ready'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="rounded-md p-2 text-ink-muted transition hover:bg-canvas hover:text-error dark:hover:bg-dark"
              aria-label="Remove file"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {error && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-error">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function QuotaCard({
  error,
  loading,
  mode,
  quota,
}: {
  error: string | null
  loading: boolean
  mode: BackendMode
  quota: Quota | null
}) {
  if (mode === 'local') {
    return (
      <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
          <Server size={17} className="text-primary" />
          Local Docker
        </div>
        <p className="mt-2 text-sm text-ink-muted">Quota disabled in local mode.</p>
      </section>
    )
  }

  return (
    <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
          <Cloud size={17} className="text-primary" />
          Free Usage
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-ink-muted" />}
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
          <AlertCircle size={16} />
          Quota unavailable.
        </p>
      )}

      {!loading && quota && (
        <div className="mt-4 space-y-3">
          <div className="h-2 rounded-full bg-canvas-card dark:bg-dark-elevated">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <QuotaItem label="Used" value={quota.used} />
            <QuotaItem label="Remaining" value={quota.remaining} />
            <QuotaItem label="Monthly Limit" value={quota.limit} />
            <QuotaItem label="Reset" value={quota.resetDate} />
          </dl>
        </div>
      )}
    </section>
  )
}

function QuotaItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-canvas-card px-3 py-2 dark:bg-dark-elevated">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 font-sans text-sm font-semibold text-ink dark:text-gray-100">{value}</dd>
    </div>
  )
}

function ResultActions({
  disabled,
  onClear,
  onCopy,
  onDownload,
  onReset,
}: {
  disabled: boolean
  onClear: () => void
  onCopy: () => void
  onDownload: () => void
  onReset: () => void
}) {
  const actions = [
    { label: 'Copy Markdown', icon: Copy, onClick: onCopy },
    { label: 'Download Markdown', icon: Download, onClick: onDownload },
    { label: 'Clear result', icon: Trash2, onClick: onClear },
    { label: 'Convert another file', icon: RefreshCw, onClick: onReset },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
            className="rounded-md border border-hairline bg-canvas px-2.5 py-2 text-ink-muted transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-dark dark:hover:text-primary"
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}

function MarkdownViewer({
  markdown,
  mode,
  onModeChange,
}: {
  markdown: string
  mode: ViewerMode
  onModeChange: (mode: ViewerMode) => void
}) {
  return (
    <div className="flex h-[calc(100%-89px)] min-h-[520px] flex-col">
      <div className="flex gap-2 border-b border-hairline px-4 py-3 dark:border-gray-800">
        <ViewerTab active={mode === 'preview'} icon={Eye} label="Preview" onClick={() => onModeChange('preview')} />
        <ViewerTab active={mode === 'raw'} icon={Code2} label="Raw Markdown" onClick={() => onModeChange('raw')} />
      </div>

      {markdown ? (
        mode === 'preview' ? (
          <MarkdownPreview markdown={markdown} />
        ) : (
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed text-ink-body dark:text-gray-300">
            {markdown}
          </pre>
        )
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-canvas-card text-ink-muted dark:bg-dark-elevated">
              <FileText size={24} />
            </span>
            <p className="mt-3 text-sm font-medium text-ink-muted">Markdown appears here after conversion.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ViewerTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Eye
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-canvas-card dark:hover:bg-dark-elevated',
        active && 'bg-primary/10 text-primary',
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => renderMarkdownBlocks(markdown), [markdown])

  return (
    <div className="min-h-0 flex-1 overflow-auto p-5">
      <div className="mx-auto max-w-3xl space-y-3 text-[15px] leading-7 text-ink-body dark:text-gray-300">
        {blocks}
      </div>
    </div>
  )
}

function renderMarkdownBlocks(markdown: string) {
  const blocks: ReactNode[] = []
  const lines = markdown.split(/\r?\n/)
  let codeLines: string[] | null = null

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (codeLines) {
        blocks.push(codeBlock(codeLines, index))
        codeLines = null
      } else {
        codeLines = []
      }
      return
    }

    if (codeLines) {
      codeLines.push(line)
      return
    }

    if (!line.trim()) {
      blocks.push(<div key={index} className="h-2" />)
      return
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const className = level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl'
      blocks.push(
        <h3 key={index} className={cn('pt-2 font-serif font-semibold text-ink dark:text-gray-100', className)}>
          {renderInline(heading[2])}
        </h3>,
      )
      return
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    if (unordered) {
      blocks.push(
        <div key={index} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <p>{renderInline(unordered[1])}</p>
        </div>,
      )
      return
    }

    const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/)
    if (ordered) {
      blocks.push(
        <div key={index} className="flex gap-3">
          <span className="min-w-6 text-right font-mono text-xs text-ink-muted">{ordered[1]}.</span>
          <p>{renderInline(ordered[2])}</p>
        </div>,
      )
      return
    }

    if (line.startsWith('>')) {
      blocks.push(
        <blockquote key={index} className="border-l-2 border-primary pl-4 italic text-ink-muted">
          {renderInline(line.replace(/^>\s?/, ''))}
        </blockquote>,
      )
      return
    }

    blocks.push(<p key={index}>{renderInline(line)}</p>)
  })

  if (codeLines) blocks.push(codeBlock(codeLines, lines.length))
  return blocks
}

function codeBlock(lines: string[], key: number) {
  return (
    <pre key={key} className="overflow-auto rounded-md bg-ink p-4 font-mono text-sm leading-6 text-gray-100">
      {lines.join('\n')}
    </pre>
  )
}

function renderInline(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-canvas-card px-1.5 py-0.5 font-mono text-sm text-primary dark:bg-dark-elevated">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }

    return part
  })
}

import { useMemo, useState, type DragEvent } from 'react'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileJson,
  HardDrive,
  KeyRound,
  Loader2,
  MessageSquare,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import {
  createManifest,
  downloadTelegramPart,
  formatBytes,
  maxTelegramPartBytes,
  parseManifest,
  partCount,
  planTelegramParts,
  uploadTelegramPart,
  type TelegramManifest,
  type TelegramPart,
} from '@/tools/telegram/telegramApi'

type Mode = 'upload' | 'download'
type SortKey = 'newest' | 'name' | 'size'
type LibraryItem = { id: string; manifest: TelegramManifest; savedAt: string }

const tokenKey = 'telegram_tool_bot_token'
const chatKey = 'telegram_tool_chat_id'
const libraryKey = 'telegram_tool_library_v1'

export default function TelegramToolPage() {
  const [mode, setMode] = useState<Mode>('upload')
  const [botToken, setBotToken] = useLocalSetting(tokenKey)
  const [chatId, setChatId] = useLocalSetting(chatKey)
  const [file, setFile] = useState<File | null>(null)
  const [manifestText, setManifestText] = useState('')
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [library, setLibrary] = useLocalLibrary()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('newest')

  const uploadParts = file ? partCount(file.size) : 0
  const manifest = useMemo(() => {
    if (!manifestText.trim()) return null
    try {
      return parseManifest(manifestText)
    } catch {
      return null
    }
  }, [manifestText])
  const visibleLibrary = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? library.filter((item) => item.manifest.fileName.toLowerCase().includes(needle))
      : library
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.manifest.fileName.localeCompare(b.manifest.fileName)
      if (sortBy === 'size') return b.manifest.size - a.manifest.size
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    })
  }, [library, search, sortBy])
  const storageStats = useMemo(() => ({
    files: library.length,
    parts: library.reduce((sum, item) => sum + item.manifest.parts.length, 0),
    bytes: library.reduce((sum, item) => sum + item.manifest.size, 0),
  }), [library])

  function botReady() {
    if (!botToken.trim()) {
      toast.error('Bot token required')
      return false
    }
    return true
  }

  function ready() {
    if (!botReady()) return false
    if (mode === 'upload' && !chatId.trim()) {
      toast.error('Chat ID required')
      return false
    }
    return true
  }

  function saveManifestToLibrary(nextManifest: TelegramManifest) {
    const id = manifestId(nextManifest)
    const nextItem = { id, manifest: nextManifest, savedAt: new Date().toISOString() }
    const nextLibrary = [nextItem, ...library.filter((item) => item.id !== id)]
    setLibrary(nextLibrary)
  }

  function loadManifest(nextManifest: TelegramManifest) {
    setManifestText(JSON.stringify(nextManifest, null, 2))
    setMode('download')
  }

  function deleteManifest(id: string) {
    setLibrary(library.filter((item) => item.id !== id))
  }

  async function handleUpload() {
    if (!file || busy || !ready()) return
    if (file.size === 0) {
      toast.error('Empty file')
      return
    }

    setBusy(true)
    setProgress('Preparing chunks...')
    try {
      const total = partCount(file.size)
      const uploaded: TelegramPart[] = []
      for (const part of planTelegramParts(file.size)) {
        const chunk = file.slice(part.start, part.end, file.type || 'application/octet-stream')
        setProgress(`Uploading part ${part.index + 1}/${total}`)
        const result = await uploadTelegramPart({
          botToken,
          chatId,
          file: chunk,
          originalName: file.name,
          partIndex: part.index + 1,
          totalParts: total,
        })
        uploaded.push({ index: part.index, ...result })
      }

      const nextManifest = createManifest(file, uploaded)
      const json = JSON.stringify(nextManifest, null, 2)
      setManifestText(json)
      saveManifestToLibrary(nextManifest)
      setProgress('Uploading manifest...')
      await uploadTelegramPart({
        botToken,
        chatId,
        file: new Blob([json], { type: 'application/json' }),
        originalName: `${file.name}.telegram-manifest.json`,
        partIndex: 1,
        totalParts: 1,
      })
      setProgress(`Done: ${total} part${total === 1 ? '' : 's'} + manifest`)
      toast.success('Uploaded to Telegram')
    } catch (error) {
      setProgress('')
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload() {
    if (busy || !botReady()) return
    let parsed: TelegramManifest
    try {
      parsed = parseManifest(manifestText)
    } catch (error) {
      toast.error((error as Error).message)
      return
    }

    saveManifestToLibrary(parsed)
    await downloadFromManifest(parsed)
  }

  async function downloadFromManifest(parsed: TelegramManifest) {
    if (busy || !botReady()) return
    setBusy(true)
    try {
      const buffers: ArrayBuffer[] = []
      const parts = [...parsed.parts].sort((a, b) => a.index - b.index)
      for (let index = 0; index < parts.length; index += 1) {
        setProgress(`Downloading part ${index + 1}/${parts.length}`)
        buffers.push(await downloadTelegramPart(botToken, parts[index].fileId))
      }
      const blob = new Blob(buffers, { type: parsed.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = parsed.fileName || 'telegram-download.bin'
      link.click()
      URL.revokeObjectURL(url)
      setProgress(`Merged: ${parsed.fileName}`)
      toast.success('Downloaded and merged')
    } catch (error) {
      setProgress('')
      toast.error((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function downloadManifest() {
    if (!manifestText) return
    const name = manifest?.fileName ? `${manifest.fileName}.telegram-manifest.json` : 'telegram-manifest.json'
    const url = URL.createObjectURL(new Blob([manifestText], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  async function copyManifest() {
    if (!manifestText) return
    await navigator.clipboard.writeText(manifestText)
    toast.success('Manifest copied')
  }

  async function copyManifestObject(nextManifest: TelegramManifest) {
    await navigator.clipboard.writeText(JSON.stringify(nextManifest, null, 2))
    toast.success('Manifest copied')
  }

  function downloadManifestObject(nextManifest: TelegramManifest) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(nextManifest, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${nextManifest.fileName}.telegram-manifest.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full flex-1 overflow-y-auto p-4 animate-fade-in-up md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Telegram</p>
            <h1 className="text-3xl font-serif font-normal text-ink dark:text-gray-100">Telegram Drive</h1>
          </div>
          <div className="inline-flex rounded-md border border-hairline bg-canvas-card p-1 dark:border-gray-800 dark:bg-dark-elevated">
            <ModeButton active={mode === 'upload'} icon={Upload} label="Upload" onClick={() => setMode('upload')} />
            <ModeButton active={mode === 'download'} icon={Download} label="Download" onClick={() => setMode('download')} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <SettingsCard
              botToken={botToken}
              chatId={chatId}
              onBotToken={setBotToken}
              onChatId={setChatId}
              onClear={() => {
                setBotToken('')
                setChatId('')
              }}
              showChat={mode === 'upload'}
            />

            {mode === 'upload' ? (
              <UploadCard
                busy={busy}
                file={file}
                onClear={() => setFile(null)}
                onFile={setFile}
                parts={uploadParts}
              />
            ) : (
              <ManifestInput value={manifestText} onChange={setManifestText} manifest={manifest} />
            )}

            <button
              type="button"
              disabled={busy || (mode === 'upload' ? !file : !manifest)}
              onClick={mode === 'upload' ? handleUpload : handleDownload}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled disabled:text-ink-muted"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'upload' ? <Send size={18} /> : <Download size={18} />}
              {mode === 'upload' ? 'Upload to Telegram' : 'Download and Merge'}
            </button>

            {progress && (
              <p className="flex items-center gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink-body dark:border-gray-800 dark:bg-dark-soft dark:text-gray-200">
                {busy ? <Loader2 size={16} className="animate-spin text-primary" /> : <CheckCircle2 size={16} className="text-success" />}
                {progress}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <LibraryPanel
              busy={busy}
              items={visibleLibrary}
              onCopy={copyManifestObject}
              onDelete={deleteManifest}
              onDownload={downloadFromManifest}
              onExport={downloadManifestObject}
              onLoad={loadManifest}
              onSearch={setSearch}
              onSort={setSortBy}
              search={search}
              sortBy={sortBy}
              stats={storageStats}
            />

            <ManifestPanel
              busy={busy}
              manifest={manifest}
              manifestText={manifestText}
              onChange={setManifestText}
              onClear={() => setManifestText('')}
              onCopy={copyManifest}
              onDownload={downloadManifest}
              onSave={() => {
                if (!manifest) return
                saveManifestToLibrary(manifest)
                toast.success('Saved to library')
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function useLocalSetting(key: string) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? '')
  function update(next: string) {
    setValue(next)
    if (next) localStorage.setItem(key, next)
    else localStorage.removeItem(key)
  }
  return [value, update] as const
}

function useLocalLibrary() {
  const [items, setItems] = useState<LibraryItem[]>(() => {
    try {
      const raw = localStorage.getItem(libraryKey)
      if (!raw) return []
      return (JSON.parse(raw) as LibraryItem[]).filter((item) => {
        parseManifest(JSON.stringify(item.manifest))
        return item.id && item.savedAt
      })
    } catch {
      return []
    }
  })

  function update(next: LibraryItem[]) {
    setItems(next)
    localStorage.setItem(libraryKey, JSON.stringify(next))
  }

  return [items, update] as const
}

function manifestId(manifest: TelegramManifest) {
  return `${manifest.fileName}:${manifest.size}:${manifest.createdAt}:${manifest.parts.map((part) => part.fileId).join(',')}`
}

function LibraryPanel({
  busy,
  items,
  onCopy,
  onDelete,
  onDownload,
  onExport,
  onLoad,
  onSearch,
  onSort,
  search,
  sortBy,
  stats,
}: {
  busy: boolean
  items: LibraryItem[]
  onCopy: (manifest: TelegramManifest) => void
  onDelete: (id: string) => void
  onDownload: (manifest: TelegramManifest) => void
  onExport: (manifest: TelegramManifest) => void
  onLoad: (manifest: TelegramManifest) => void
  onSearch: (value: string) => void
  onSort: (value: SortKey) => void
  search: string
  sortBy: SortKey
  stats: { files: number; parts: number; bytes: number }
}) {
  return (
    <section className="min-h-[390px] rounded-md border border-hairline bg-canvas dark:border-gray-800 dark:bg-dark-soft">
      <div className="flex flex-col gap-3 border-b border-hairline p-4 dark:border-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate font-sans text-lg font-semibold text-ink dark:text-gray-100">
              <HardDrive size={18} className="text-primary" />
              Storage Library
            </h2>
            <p className="text-sm text-ink-muted">
              {stats.files} files / {stats.parts} parts / {formatBytes(stats.bytes)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 sm:w-64">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search files"
                className="w-full rounded-md border border-hairline bg-canvas-soft py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-100"
              />
            </label>
            <select
              value={sortBy}
              onChange={(event) => onSort(event.target.value as SortKey)}
              className="rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-100"
            >
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-canvas-card text-xs uppercase tracking-wider text-ink-muted dark:bg-dark-elevated">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Parts</th>
              <th className="px-4 py-3">Saved</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-gray-800">
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-ink-muted" colSpan={5}>
                  No files in library yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onLoad(item.manifest)}
                  className="cursor-pointer transition hover:bg-canvas-card dark:hover:bg-dark-elevated"
                >
                  <td className="max-w-[320px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileArchive size={16} className="shrink-0 text-primary" />
                      <span className="truncate font-medium text-ink dark:text-gray-100">{item.manifest.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-body dark:text-gray-300">{formatBytes(item.manifest.size)}</td>
                  <td className="px-4 py-3 text-ink-body dark:text-gray-300">{item.manifest.parts.length}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(item.savedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                      <IconButton disabled={busy} icon={Download} label="Download and merge" onClick={() => onDownload(item.manifest)} />
                      <IconButton disabled={busy} icon={Copy} label="Copy manifest" onClick={() => onCopy(item.manifest)} />
                      <IconButton disabled={busy} icon={FileJson} label="Export manifest" onClick={() => onExport(item.manifest)} />
                      <IconButton disabled={busy} icon={Trash2} label="Delete from library" onClick={() => onDelete(item.id)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ManifestPanel({
  busy,
  manifest,
  manifestText,
  onChange,
  onClear,
  onCopy,
  onDownload,
  onSave,
}: {
  busy: boolean
  manifest: TelegramManifest | null
  manifestText: string
  onChange: (value: string) => void
  onClear: () => void
  onCopy: () => void
  onDownload: () => void
  onSave: () => void
}) {
  return (
    <section className="rounded-md border border-hairline bg-canvas dark:border-gray-800 dark:bg-dark-soft">
      <div className="flex flex-col gap-3 border-b border-hairline p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-sans text-lg font-semibold text-ink dark:text-gray-100">Manifest Detail</h2>
          <p className="text-sm text-ink-muted">
            {manifest ? `${manifest.fileName} / ${manifest.parts.length} part${manifest.parts.length === 1 ? '' : 's'} / ${formatBytes(manifest.size)}` : 'Select a file, upload one, or paste manifest JSON.'}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton disabled={!manifest || busy} icon={Save} label="Save to library" onClick={onSave} />
          <IconButton disabled={!manifestText} icon={Copy} label="Copy manifest" onClick={onCopy} />
          <IconButton disabled={!manifestText} icon={Download} label="Download manifest" onClick={onDownload} />
          <IconButton disabled={!manifestText || busy} icon={Trash2} label="Clear manifest" onClick={onClear} />
        </div>
      </div>
      <textarea
        value={manifestText}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="h-56 w-full resize-none bg-transparent p-4 font-mono text-xs leading-5 text-ink-body outline-none placeholder:text-ink-muted dark:text-gray-300"
        placeholder="Telegram manifest JSON"
      />
    </section>
  )
}

function SettingsCard({
  botToken,
  chatId,
  onBotToken,
  onChatId,
  onClear,
  showChat,
}: {
  botToken: string
  chatId: string
  onBotToken: (value: string) => void
  onChatId: (value: string) => void
  onClear: () => void
  showChat: boolean
}) {
  return (
    <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
          <KeyRound size={17} className="text-primary" />
          Bot Settings
        </div>
        <button onClick={onClear} className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-card hover:text-error dark:hover:bg-dark" title="Clear settings">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="space-y-3">
        <LabeledInput label="Bot token" type="password" value={botToken} onChange={onBotToken} placeholder="123456:ABC..." icon={KeyRound} />
        {showChat && (
          <LabeledInput label="Chat ID" value={chatId} onChange={onChatId} placeholder="@channel or -100..." icon={MessageSquare} />
        )}
      </div>
    </section>
  )
}

function LabeledInput({
  icon: Icon,
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  icon: typeof KeyRound
  label: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <Icon size={13} />
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-100"
      />
    </label>
  )
}

function UploadCard({
  busy,
  file,
  onClear,
  onFile,
  parts,
}: {
  busy: boolean
  file: File | null
  onClear: () => void
  onFile: (file: File) => void
  parts: number
}) {
  const [dragging, setDragging] = useState(false)
  const inputId = 'telegram-file-input'

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files.item(0)
    if (dropped) onFile(dropped)
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
          'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-hairline bg-canvas-soft p-5 text-center transition dark:border-gray-700 dark:bg-dark',
          dragging && 'border-primary bg-primary/10',
        )}
      >
        <span className="rounded-md border border-primary/20 bg-primary/10 p-3 text-primary">
          <FileArchive size={24} />
        </span>
        <span className="font-sans text-base font-semibold text-ink dark:text-gray-100">Drop file or browse</span>
        <span className="text-xs text-ink-muted">Each Telegram bot part max {formatBytes(maxTelegramPartBytes)}</span>
        <input
          id={inputId}
          type="file"
          disabled={busy}
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
              <p className="mt-1 text-xs text-ink-muted">{formatBytes(file.size)} / {parts} part{parts === 1 ? '' : 's'}</p>
            </div>
            <button type="button" onClick={onClear} disabled={busy} className="rounded-md p-2 text-ink-muted transition hover:bg-canvas hover:text-error disabled:opacity-40 dark:hover:bg-dark">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ManifestInput({
  manifest,
  onChange,
  value,
}: {
  manifest: TelegramManifest | null
  onChange: (value: string) => void
  value: string
}) {
  const inputId = 'telegram-manifest-input'

  async function readFile(file: File) {
    onChange(await file.text())
  }

  return (
    <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
      <label
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files.item(0)
          if (file) void readFile(file)
        }}
        className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-hairline bg-canvas-soft p-5 text-center dark:border-gray-700 dark:bg-dark"
      >
        <span className="rounded-md border border-primary/20 bg-primary/10 p-3 text-primary">
          <FileJson size={24} />
        </span>
        <span className="font-sans text-base font-semibold text-ink dark:text-gray-100">Drop manifest JSON</span>
        <span className="text-xs text-ink-muted">{manifest ? manifest.fileName : value ? 'Invalid manifest' : 'Or paste it on the right'}</span>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.item(0)
            if (file) void readFile(file)
            event.currentTarget.value = ''
          }}
        />
      </label>
      {value && !manifest && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-error">
          <AlertCircle size={16} />
          Invalid manifest
        </p>
      )}
    </section>
  )
}

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Upload; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-ink-muted transition hover:text-primary',
        active && 'bg-canvas text-primary shadow-sm dark:bg-dark',
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function IconButton({ disabled, icon: Icon, label, onClick }: { disabled: boolean; icon: typeof Copy; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md border border-hairline bg-canvas px-2.5 py-2 text-ink-muted transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-dark"
    >
      <Icon size={16} />
    </button>
  )
}

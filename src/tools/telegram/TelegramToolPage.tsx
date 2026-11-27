import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileJson,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  KeyRound,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { useAuth } from '@/shared/hooks/useAuth'
import CustomSelect from '@/shared/components/CustomSelect'
import {
  discoverTelegramChat,
  formatBytes,
  saveSharedTelegramConfig,
  subscribeToSharedTelegramConfig,
  TelegramBrowserDownloadError,
  telegramChatKey,
  telegramTokenKey,
  parseManifest,
  partCount,
  uploadTelegramPart,
  type TelegramManifest,
  type TelegramDiscoveryResult,
} from '@/tools/telegram/telegramApi'
import { downloadTelegramFile, openRemoteDownload, saveBlob, uploadTelegramFile } from '@/tools/telegram/telegramDriveService'
import {
  createTelegramFolder,
  deleteTelegramFolder,
  deleteTelegramFile,
  moveTelegramFile,
  renameTelegramFolder,
  saveTelegramFile,
  subscribeToTelegramFolders,
  subscribeToTelegramFiles,
  type TelegramFolderItem,
  type TelegramLibraryItem,
} from '@/tools/telegram/telegramLibraryService'

type SortKey = 'newest' | 'name' | 'size'
type LegacyLibraryItem = { id: string; manifest: TelegramManifest; savedAt: string }

const libraryKey = 'telegram_tool_library_v1'

export default function TelegramToolPage() {
  const { user } = useAuth()
  const [botToken, setBotToken] = useLocalSetting(telegramTokenKey)
  const [chatId, setChatId] = useLocalSetting(telegramChatKey)
  const [file, setFile] = useState<File | null>(null)
  const [manifestText, setManifestText] = useState('')
  const [progress, setProgress] = useState('')
  const [busy, setBusy] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discovery, setDiscovery] = useState<TelegramDiscoveryResult | null>(null)
  const [library, setLibrary] = useState<TelegramLibraryItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState('')
  const [libraryRevision, setLibraryRevision] = useState(0)
  const [folders, setFolders] = useState<TelegramFolderItem[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('newest')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const configSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user) return
    return subscribeToSharedTelegramConfig((cfg) => {
      if (cfg.botToken) setBotToken(cfg.botToken)
      if (cfg.chatId) setChatId(cfg.chatId)
    })
  }, [user])

  function updateSharedConfig(nextToken: string, nextChatId: string, immediate = false) {
    if (!isAdmin) return
    if (configSyncTimer.current) clearTimeout(configSyncTimer.current)
    const run = () => {
      void saveSharedTelegramConfig(nextToken, nextChatId, user?.email || user?.uid).catch((err: Error) => {
        toast.error(`Sync Telegram settings failed: ${err.message}`)
      })
    }
    if (immediate) run()
    else configSyncTimer.current = setTimeout(run, 500)
  }

  useEffect(() => {
    if (!user) {
      setLibrary([])
      setLibraryLoading(false)
      return
    }

    setLibraryLoading(true)
    setLibraryError('')
    const unsubscribe = subscribeToTelegramFiles(
      user.uid,
      (items) => {
        setLibrary(items)
        setLibraryLoading(false)
      },
      (error) => {
        setLibraryError(error.message)
        setLibraryLoading(false)
        toast.error(error.message)
      },
    )
    const legacy = readLocalLibrary()
    if (legacy.length) {
      void Promise.all(legacy.map((item) => saveTelegramFile(user.uid, item.manifest)))
        .then(() => localStorage.removeItem(libraryKey))
        .catch((error: Error) => toast.error(`Library migration failed: ${error.message}`))
    }
    return unsubscribe
  }, [user, libraryRevision])

  useEffect(() => {
    if (!user) {
      setFolders([])
      return
    }
    return subscribeToTelegramFolders(user.uid, setFolders, (error) => toast.error(error.message))
  }, [user])

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
    const folderItems = selectedFolderId === 'all'
      ? library
      : library.filter((item) => item.folderId === (selectedFolderId === 'root' ? null : selectedFolderId))
    const filtered = needle
      ? folderItems.filter((item) => item.manifest.fileName.toLowerCase().includes(needle))
      : folderItems
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.manifest.fileName.localeCompare(b.manifest.fileName)
      if (sortBy === 'size') return b.manifest.size - a.manifest.size
      const bTime = b.savedAt ?? Date.parse(b.manifest.createdAt)
      const aTime = a.savedAt ?? Date.parse(a.manifest.createdAt)
      return bTime - aTime
    })
  }, [library, search, selectedFolderId, sortBy])
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

  function uploadReady() {
    if (!botReady()) return false
    if (!chatId.trim()) {
      toast.error('Chat ID required')
      return false
    }
    return true
  }

  function currentFolderId() {
    return selectedFolderId === 'all' || selectedFolderId === 'root' ? null : selectedFolderId
  }

  async function saveManifestToLibrary(nextManifest: TelegramManifest, folderId = currentFolderId()) {
    if (!user) throw new Error('Sign in to sync the Telegram library.')
    const id = await saveTelegramFile(user.uid, nextManifest, undefined, folderId)
    setLibrary((current) => [{
      id,
      manifest: nextManifest,
      savedAt: Date.now(),
      source: { type: 'drive' },
      folderId,
    }, ...current.filter((item) => item.id !== id)])
  }

  function loadManifest(nextManifest: TelegramManifest) {
    setManifestText(JSON.stringify(nextManifest, null, 2))
  }

  async function createFolder() {
    if (!user) return
    const name = window.prompt('Folder name')
    if (!name) return
    try {
      const parentId = currentFolderId()
      const next = await createTelegramFolder(user.uid, name, parentId)
      setFolders((current) => [...current, next].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedFolderId(next.id)
      toast.success('Folder created')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  async function renameFolder(folder: TelegramFolderItem) {
    const name = window.prompt('Rename folder', folder.name)
    if (!name || name.trim() === folder.name) return
    try {
      await renameTelegramFolder(folder.id, name)
      setFolders((current) => current.map((item) => item.id === folder.id ? { ...item, name: name.trim() } : item))
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  async function deleteFolder(folder: TelegramFolderItem) {
    if (folders.some((item) => item.parentId === folder.id) || library.some((item) => item.folderId === folder.id)) {
      toast.error('Move or delete this folder contents first.')
      return
    }
    if (!window.confirm(`Delete folder "${folder.name}"?`)) return
    try {
      await deleteTelegramFolder(folder.id)
      setFolders((current) => current.filter((item) => item.id !== folder.id))
      if (selectedFolderId === folder.id) setSelectedFolderId(folder.parentId ?? 'root')
      toast.success('Folder deleted')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  async function moveFile(id: string, folderId: string | null) {
    try {
      await moveTelegramFile(id, folderId)
      setLibrary((current) => current.map((item) => item.id === id ? { ...item, folderId } : item))
      toast.success('File moved')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  async function deleteManifest(id: string) {
    try {
      await deleteTelegramFile(id)
      setLibrary((current) => current.filter((item) => item.id !== id))
      toast.success('Removed from library')
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  async function handleDiscoverChat() {
    if (!botReady() || discovering) return
    setDiscovering(true)
    try {
      const result = await discoverTelegramChat(botToken)
      setDiscovery(result)
      if (result.chat) {
        setChatId(result.chat.id)
        updateSharedConfig(botToken, result.chat.id, true)
        toast.success(`Chat ID detected & shared: ${result.chat.id}`)
      } else if (result.webhookActive) {
        toast.error('This bot has an active webhook. Enter Chat ID manually or disable the webhook first.')
      } else {
        if (result.startUrl) window.open(result.startUrl, '_blank', 'noopener,noreferrer')
        toast('Send /start to the bot, then click Auto-detect again.')
      }
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setDiscovering(false)
    }
  }

  async function handleUploadFiles(files: File[]) {
    for (const item of files) {
      await handleUpload(item)
    }
  }

  async function handleUpload(uploadFile = file) {
    if (!uploadFile || busy) return
    if (!botToken.trim() || !chatId.trim()) {
      setFile(uploadFile)
      setSettingsOpen(true)
      toast.error('Configure Bot token and Chat ID before uploading.')
      return
    }
    if (!uploadReady()) return
    if (uploadFile.size === 0) {
      toast.error('Empty file')
      return
    }

    setBusy(true)
    setProgress('Preparing chunks...')
    try {
      const total = partCount(uploadFile.size)
      const nextManifest = await uploadTelegramFile(
        botToken,
        chatId,
        uploadFile,
        (current, count) => setProgress(`Uploading part ${current}/${count}`),
      )
      const json = JSON.stringify(nextManifest, null, 2)
      setManifestText(json)
      setProgress('Uploading manifest...')
      await uploadTelegramPart({
        botToken,
        chatId,
        file: new Blob([json], { type: 'application/json' }),
        originalName: `${uploadFile.name}.telegram-manifest.json`,
        partIndex: 1,
        totalParts: 1,
      })
      try {
        await saveManifestToLibrary(nextManifest)
      } catch (error) {
        toast.error(`Uploaded, but library sync failed: ${(error as Error).message}`)
      }
      setProgress(`Done: ${total} part${total === 1 ? '' : 's'} + manifest`)
      setFile(null)
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

    void saveManifestToLibrary(parsed).catch((error: Error) => toast.error(error.message))
    await downloadFromManifest(parsed)
  }

  async function downloadFromManifest(parsed: TelegramManifest) {
    if (busy || !botReady()) return
    setBusy(true)
    try {
      const blob = await downloadTelegramFile(
        botToken,
        parsed,
        (current, total) => setProgress(`Downloading part ${current}/${total}`),
      )
      saveBlob(blob, parsed.fileName || 'telegram-download.bin')
      setProgress(`Merged: ${parsed.fileName}`)
      toast.success('Downloaded and merged')
    } catch (error) {
      if (error instanceof TelegramBrowserDownloadError) {
        if (parsed.parts.length === 1) {
          openRemoteDownload(error.url, parsed.fileName || 'telegram-download.bin')
          setProgress(`Browser download started: ${parsed.fileName}`)
          toast.success('Download opened in browser')
          return
        }
        setProgress('')
        toast.error('Trình duyệt chặn tải nhiều phần trực tiếp từ Telegram (CORS). Hãy thử tải từng phần trong khung chat Telegram hoặc tắt chặn cross-origin.')
        return
      }
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
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const selectedFolder = folders.find((item) => item.id === selectedFolderId)
  const locationName = selectedFolderId === 'all' ? 'All files' : selectedFolder?.name ?? 'My Drive'

  return (
    <div className="flex w-full flex-1 flex-col overflow-y-auto lg:overflow-hidden p-3 animate-fade-in-up md:p-5">
      <div className="flex w-full flex-1 min-h-0 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-sans font-semibold text-ink dark:text-gray-100">Telegram Drive</h1>
            <p className="text-sm text-ink-muted">{storageStats.files} files · {formatBytes(storageStats.bytes)} stored in Telegram</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void createFolder()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-canvas/80 backdrop-blur-md px-3 py-2 text-sm font-semibold text-ink-body hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-dark-soft/80 dark:text-gray-200">
              <FolderPlus size={17} /> New folder
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-canvas/80 backdrop-blur-md px-3 py-2 text-sm font-semibold text-ink-body hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-dark-soft/80 dark:text-gray-200">
              <Settings size={17} /> Settings
            </button>
            <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />} Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? [])
                if (files.length) void handleUploadFiles(files)
                event.currentTarget.value = ''
              }}
            />
          </div>
        </div>

        <div className="grid flex-1 min-h-0 overflow-hidden rounded-xl border border-hairline/80 bg-canvas/80 backdrop-blur-xl shadow-sm dark:border-gray-800/80 dark:bg-dark-soft/80 md:grid-cols-[240px_minmax(0,1fr)]">
          <DriveSidebar
            files={library}
            folders={folders}
            onCreate={() => void createFolder()}
            onDelete={(folder) => void deleteFolder(folder)}
            onMove={(id, folderId) => void moveFile(id, folderId)}
            onRename={(folder) => void renameFolder(folder)}
            onSelect={setSelectedFolderId}
            selectedId={selectedFolderId}
          />

          <main
            onDragEnter={(event) => {
              if (event.dataTransfer.types.includes('Files')) setDraggingFiles(true)
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) event.preventDefault()
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDraggingFiles(false)
              const dropped = Array.from(event.dataTransfer.files ?? [])
              if (dropped.length) void handleUploadFiles(dropped)
            }}
            className="relative flex min-h-0 min-w-0 flex-col overflow-y-auto p-3 md:p-5"
          >
            {draggingFiles && (
              <div className="absolute inset-3 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm md:inset-5">
                <div className="text-center text-primary">
                  <Upload size={34} className="mx-auto mb-2" />
                  <p className="font-semibold">Drop to upload into {locationName}</p>
                </div>
              </div>
            )}

            <div className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
              <HardDrive size={16} /> My Drive <ChevronRight size={14} />
              <span className="font-semibold text-ink dark:text-gray-100">{locationName}</span>
            </div>

            {file && !busy && (
              <div className="mb-4 flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center">
                <FileArchive size={20} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink dark:text-gray-100">{file.name}</p>
                  <p className="text-xs text-ink-muted">{formatBytes(file.size)} · waiting for Telegram settings</p>
                </div>
                <button type="button" onClick={() => void handleUpload()} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"><Send size={15} /> Upload now</button>
                <button type="button" onClick={() => setFile(null)} className="rounded-md p-2 text-ink-muted hover:text-error"><X size={16} /></button>
              </div>
            )}

            {progress && (
              <p className="mb-4 flex items-center gap-2 rounded-md border border-hairline bg-canvas-card px-3 py-2 text-sm font-medium text-ink-body dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-200">
                {busy ? <Loader2 size={16} className="animate-spin text-primary" /> : <CheckCircle2 size={16} className="text-success" />}
                {progress}
              </p>
            )}

            <LibraryPanel
              busy={busy}
              error={libraryError}
              folders={folders}
              items={visibleLibrary}
              loading={libraryLoading}
              onCopy={copyManifestObject}
              onDelete={deleteManifest}
              onDownload={downloadFromManifest}
              onExport={downloadManifestObject}
              onLoad={loadManifest}
              onMove={(id, folderId) => void moveFile(id, folderId)}
              onRefresh={() => setLibraryRevision((value) => value + 1)}
              onSearch={setSearch}
              onSort={setSortBy}
              search={search}
              sortBy={sortBy}
              stats={storageStats}
            />

            <details className="mt-4 rounded-md border border-hairline bg-canvas-card dark:border-gray-800 dark:bg-dark-elevated">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-body dark:text-gray-200">Advanced manifest tools</summary>
              <div className="grid gap-4 border-t border-hairline p-4 dark:border-gray-800 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <ManifestInput value={manifestText} onChange={setManifestText} manifest={manifest} />
                  <button type="button" disabled={busy || !manifest} onClick={() => void handleDownload()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                    <Download size={17} /> Download and merge
                  </button>
                </div>
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
                    void saveManifestToLibrary(manifest)
                      .then(() => toast.success('Saved to library'))
                      .catch((error: Error) => toast.error(error.message))
                  }}
                />
              </div>
            </details>
          </main>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false)
        }}>
          <div className="relative w-full max-w-md rounded-t-xl bg-canvas-card p-4 shadow-2xl dark:bg-dark-elevated sm:rounded-xl">
            <button type="button" onClick={() => setSettingsOpen(false)} className="absolute right-5 top-5 z-10 rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-ink dark:hover:bg-dark" title="Close settings"><X size={17} /></button>
            <SettingsCard
              botToken={botToken}
              chatId={chatId}
              isAdmin={isAdmin}
              onBotToken={(next) => {
                setBotToken(next)
                updateSharedConfig(next, chatId)
              }}
              onChatId={(next) => {
                setChatId(next)
                updateSharedConfig(botToken, next)
              }}
              onClear={() => {
                setBotToken('')
                setChatId('')
                setDiscovery(null)
                updateSharedConfig('', '', true)
              }}
              discovering={discovering}
              discovery={discovery}
              onDiscover={handleDiscoverChat}
            />
          </div>
        </div>
      )}
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

function readLocalLibrary() {
  try {
    const raw = localStorage.getItem(libraryKey)
    if (!raw) return []
    return (JSON.parse(raw) as LegacyLibraryItem[]).filter((item) => {
      parseManifest(JSON.stringify(item.manifest))
      return item.id && item.savedAt
    })
  } catch {
    return []
  }
}

function DriveSidebar({
  files,
  folders,
  onCreate,
  onDelete,
  onMove,
  onRename,
  onSelect,
  selectedId,
}: {
  files: TelegramLibraryItem[]
  folders: TelegramFolderItem[]
  onCreate: () => void
  onDelete: (folder: TelegramFolderItem) => void
  onMove: (id: string, folderId: string | null) => void
  onRename: (folder: TelegramFolderItem) => void
  onSelect: (id: string) => void
  selectedId: string
}) {
  function folderDrop(event: DragEvent<HTMLElement>, folderId: string | null) {
    const id = event.dataTransfer.getData('application/x-telegram-file')
    if (!id) return
    event.preventDefault()
    onMove(id, folderId)
  }

  return (
    <aside className="border-b border-hairline bg-canvas-card p-3 dark:border-gray-800 dark:bg-dark-elevated md:border-b-0 md:border-r">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Folders</span>
        <button type="button" onClick={onCreate} title="New folder" className="rounded-md p-1.5 text-ink-muted hover:bg-canvas hover:text-primary dark:hover:bg-dark"><FolderPlus size={15} /></button>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1 md:block md:overflow-visible">
        <FolderNavButton active={selectedId === 'all'} count={files.length} icon={HardDrive} label="All files" onClick={() => onSelect('all')} />
        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => folderDrop(event, null)}>
          <FolderNavButton active={selectedId === 'root'} count={files.filter((item) => item.folderId === null).length} icon={FolderOpen} label="My Drive" onClick={() => onSelect('root')} />
        </div>
        <div className="contents md:block md:pl-2">
          {folders.filter((folder) => folder.parentId === null).map((folder) => (
            <FolderTreeRow
              key={folder.id}
              files={files}
              folder={folder}
              folders={folders}
              onDelete={onDelete}
              onDrop={folderDrop}
              onRename={onRename}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      </nav>
      <p className="mt-4 hidden rounded-md bg-canvas px-3 py-2 text-xs leading-5 text-ink-muted dark:bg-dark md:block">Drop files anywhere in the main area. Drag an existing row onto a folder to move it.</p>
    </aside>
  )
}

function FolderNavButton({ active, count, icon: Icon, label, onClick }: { active: boolean; count: number; icon: typeof Folder; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm transition md:w-full', active ? 'bg-primary/10 font-semibold text-primary' : 'text-ink-body hover:bg-canvas dark:text-gray-300 dark:hover:bg-dark')}>
      <Icon size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="rounded-full bg-canvas px-1.5 text-[11px] text-ink-muted dark:bg-dark">{count}</span>
    </button>
  )
}

function FolderTreeRow({
  files,
  folder,
  folders,
  onDelete,
  onDrop,
  onRename,
  onSelect,
  selectedId,
}: {
  files: TelegramLibraryItem[]
  folder: TelegramFolderItem
  folders: TelegramFolderItem[]
  onDelete: (folder: TelegramFolderItem) => void
  onDrop: (event: DragEvent<HTMLElement>, folderId: string | null) => void
  onRename: (folder: TelegramFolderItem) => void
  onSelect: (id: string) => void
  selectedId: string
}) {
  const children = folders.filter((item) => item.parentId === folder.id)
  const fileCount = files.filter((item) => item.folderId === folder.id).length
  return (
    <div className="min-w-max md:min-w-0">
      <div className={cn('group flex items-center rounded-md pr-1', selectedId === folder.id && 'bg-primary/10')} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, folder.id)}>
        <button type="button" onClick={() => onSelect(folder.id)} className={cn('flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm', selectedId === folder.id ? 'font-semibold text-primary' : 'text-ink-body dark:text-gray-300')}>
          <Folder size={16} className="shrink-0" />
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto rounded-full bg-canvas px-1.5 text-[11px] text-ink-muted dark:bg-dark">{fileCount}</span>
        </button>
        <button type="button" onClick={() => onRename(folder)} title="Rename folder" className="px-1 text-xs text-ink-muted hover:text-primary">✎</button>
        <button type="button" onClick={() => onDelete(folder)} title="Delete folder" className="px-1 text-ink-muted hover:text-error"><X size={13} /></button>
      </div>
      {children.length > 0 && (
        <div className="ml-4 border-l border-hairline pl-1 dark:border-gray-800">
          {children.map((child) => (
            <FolderTreeRow
              key={child.id}
              files={files}
              folder={child}
              folders={folders}
              onDelete={onDelete}
              onDrop={onDrop}
              onRename={onRename}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function flattenFolders(folders: TelegramFolderItem[], parentId: string | null = null, depth = 0): Array<{ folder: TelegramFolderItem; depth: number }> {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .flatMap((folder) => [{ folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)])
}

function LibraryPanel({
  busy,
  error,
  folders,
  items,
  loading,
  onCopy,
  onDelete,
  onDownload,
  onExport,
  onLoad,
  onMove,
  onRefresh,
  onSearch,
  onSort,
  search,
  sortBy,
  stats,
}: {
  busy: boolean
  error: string
  folders: TelegramFolderItem[]
  items: TelegramLibraryItem[]
  loading: boolean
  onCopy: (manifest: TelegramManifest) => void
  onDelete: (id: string) => void
  onDownload: (manifest: TelegramManifest) => void
  onExport: (manifest: TelegramManifest) => void
  onLoad: (manifest: TelegramManifest) => void
  onMove: (id: string, folderId: string | null) => void
  onRefresh: () => void
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
            <button
              type="button"
              disabled={loading}
              onClick={onRefresh}
              title="Refresh library"
              className="inline-flex items-center justify-center rounded-md border border-hairline bg-canvas-soft px-2.5 py-2 text-ink-muted transition hover:border-primary hover:text-primary disabled:opacity-40 dark:border-gray-800 dark:bg-dark"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <label className="relative block min-w-0 sm:w-64">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Search files"
                className="w-full rounded-md border border-hairline bg-canvas-soft py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-100"
              />
            </label>
            <CustomSelect
              value={sortBy}
              onChange={(val) => onSort(val as SortKey)}
              ariaLabel="Sort files"
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'name', label: 'Name' },
                { value: 'size', label: 'Size' },
              ]}
              className="min-w-[110px]"
            />
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
            {loading ? (
              <tr>
                <td className="px-4 py-12 text-center text-ink-muted" colSpan={5}>
                  <Loader2 size={18} className="mx-auto mb-2 animate-spin text-primary" />
                  Loading library...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-ink-muted" colSpan={5}>
                  {error || 'No files in library yet.'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  draggable={!busy}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('application/x-telegram-file', item.id)
                  }}
                  onClick={() => onLoad(item.manifest)}
                  className="cursor-pointer transition hover:bg-canvas-card dark:hover:bg-dark-elevated"
                >
                  <td className="max-w-[320px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileArchive size={16} className="shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink dark:text-gray-100">{item.manifest.fileName}</p>
                        <p className="text-[11px] uppercase tracking-wider text-ink-muted">{item.source.type === 'note' ? 'Note attachment' : 'Drive'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-body dark:text-gray-300">{formatBytes(item.manifest.size)}</td>
                  <td className="px-4 py-3 text-ink-body dark:text-gray-300">{item.manifest.parts.length}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(item.savedAt ?? item.manifest.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                      <CustomSelect
                        size="sm"
                        value={item.folderId ?? ''}
                        onChange={(val) => onMove(item.id, val || null)}
                        title="Move to folder"
                        options={[
                          { value: '', label: 'My Drive' },
                          ...flattenFolders(folders).map(({ folder, depth }) => ({
                            value: folder.id,
                            label: `${'— '.repeat(depth)}${folder.name}`,
                          })),
                        ]}
                        className="max-w-36"
                      />
                      <IconButton disabled={busy} icon={Download} label="Download and merge" onClick={() => onDownload(item.manifest)} />
                      <IconButton disabled={busy} icon={Copy} label="Copy manifest" onClick={() => onCopy(item.manifest)} />
                      <IconButton disabled={busy} icon={FileJson} label="Export manifest" onClick={() => onExport(item.manifest)} />
                      <IconButton
                        disabled={busy || item.source.type === 'note'}
                        icon={Trash2}
                        label={item.source.type === 'note' ? 'Remove it from the source note' : 'Delete from library'}
                        onClick={() => onDelete(item.id)}
                      />
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
  discovering,
  discovery,
  isAdmin,
  onBotToken,
  onChatId,
  onClear,
  onDiscover,
}: {
  botToken: string
  chatId: string
  discovering: boolean
  discovery: TelegramDiscoveryResult | null
  isAdmin: boolean
  onBotToken: (value: string) => void
  onChatId: (value: string) => void
  onClear: () => void
  onDiscover: () => void
}) {
  return (
    <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
          <KeyRound size={17} className="text-primary" />
          Bot Settings
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Shared · Admin</span>
        </div>
        {isAdmin && (
          <button onClick={onClear} className="rounded-md p-1.5 text-ink-muted hover:bg-canvas-card hover:text-error dark:hover:bg-dark" title="Clear settings">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {isAdmin ? (
        <>
          <p className="mb-3 text-xs text-ink-muted">Admin nhập 1 lần — tự động đồng bộ và dùng chung cho tất cả tài khoản.</p>
          <div className="space-y-3">
            <LabeledInput label="Bot token" type="password" value={botToken} onChange={onBotToken} placeholder="123456:ABC..." icon={KeyRound} />
            <LabeledInput label="Chat ID" value={chatId} onChange={onChatId} placeholder="@channel or -100..." icon={MessageSquare} />
            <button
              type="button"
              disabled={!botToken.trim() || discovering}
              onClick={onDiscover}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-sm font-semibold text-ink-body transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-dark dark:text-gray-200"
            >
              <RefreshCw size={15} className={discovering ? 'animate-spin' : ''} />
              Auto-detect Chat ID
            </button>
            {discovery?.startUrl && !discovery.chat && (
              <a
                href={discovery.startUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink size={13} />
                Open @{discovery.bot.username ?? discovery.bot.firstName}, send /start, then detect again
              </a>
            )}
            {discovery?.webhookActive && !discovery.chat && (
              <p className="text-xs text-warning">Auto-detect is unavailable while this bot uses a webhook. Manual Chat ID still works.</p>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-hairline bg-canvas-soft/60 px-3.5 py-3 text-xs text-ink-muted dark:border-gray-800 dark:bg-dark/40">
          {botToken && chatId
            ? '✅ Phiên Telegram Drive đã được Admin cấu hình và đồng bộ dùng chung cho tài khoản của bạn.'
            : '⏳ Chưa có cấu hình Telegram Drive. Vui lòng liên hệ Admin để cấu hình.'}
        </div>
      )}
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

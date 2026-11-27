import { useEffect, useRef, useState } from 'react'
import { Download, FileArchive, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatBytes } from '@/tools/telegram/telegramCore'
import { getTelegramFileUrl, TelegramBrowserDownloadError } from '@/tools/telegram/telegramApi'
import { downloadTelegramFile, openRemoteDownload, saveBlob } from '@/tools/telegram/telegramDriveService'
import type { NoteAttachment } from '@/tools/notes/types/note'

const previewCache = new Map<string, Promise<string>>()

function previewKey(botToken: string, attachment: NoteAttachment) {
  return `${botToken}:${attachment.manifest.parts.map((part) => part.fileId).join(',')}`
}

export function primeNoteAttachmentPreview(botToken: string, attachment: NoteAttachment, file: File) {
  if (file.type.startsWith('image/')) {
    previewCache.set(previewKey(botToken, attachment), Promise.resolve(URL.createObjectURL(file)))
  }
}

export function getAttachmentPreviewUrl(botToken: string, attachment: NoteAttachment) {
  return previewUrl(botToken, attachment)
}

function previewUrl(botToken: string, attachment: NoteAttachment) {
  const key = previewKey(botToken, attachment)
  const cached = previewCache.get(key)
  if (cached) return cached
  const request = attachment.manifest.parts.length === 1
    ? getTelegramFileUrl(botToken, attachment.manifest.parts[0].fileId)
    : downloadTelegramFile(botToken, attachment.manifest).then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      previewCache.delete(key)
      throw error
    })
  previewCache.set(key, request)
  return request
}

export default function NoteAttachments({
  attachments,
  botToken,
  busy,
  onDelete,
}: {
  attachments: NoteAttachment[]
  botToken: string
  busy: boolean
  onDelete: (attachment: NoteAttachment) => void
}) {
  if (!attachments.length) return null
  const images = attachments.filter((item) => item.manifest.mimeType.startsWith('image/'))
  const files = attachments.filter((item) => !item.manifest.mimeType.startsWith('image/'))

  async function download(attachment: NoteAttachment) {
    try {
      const blob = await downloadTelegramFile(botToken, attachment.manifest)
      saveBlob(blob, attachment.manifest.fileName)
    } catch (error) {
      if (error instanceof TelegramBrowserDownloadError && attachment.manifest.parts.length === 1) {
        openRemoteDownload(error.url, attachment.manifest.fileName)
        return
      }
      toast.error((error as Error).message)
    }
  }

  return (
    <section className="mb-4 space-y-4 rounded-md border border-hairline bg-canvas-soft p-3 dark:border-gray-800 dark:bg-dark">
      {images.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100"><ImageIcon size={16} className="text-primary" /> Images ({images.length})</h3>
            <span className="text-xs text-ink-muted">{formatBytes(images.reduce((sum, item) => sum + item.manifest.size, 0))}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} botToken={botToken} busy={busy} onDelete={() => onDelete(attachment)} onDownload={() => void download(attachment)} />
            ))}
          </div>
        </div>
      )}
      {files.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100"><FileArchive size={16} className="text-primary" /> Attachments ({files.length})</h3>
            <span className="text-xs text-ink-muted">{formatBytes(files.reduce((sum, item) => sum + item.manifest.size, 0))}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {files.map((attachment) => (
              <AttachmentCard key={attachment.id} attachment={attachment} botToken={botToken} busy={busy} onDelete={() => onDelete(attachment)} onDownload={() => void download(attachment)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function AttachmentCard({
  attachment,
  botToken,
  busy,
  onDelete,
  onDownload,
}: {
  attachment: NoteAttachment
  botToken: string
  busy: boolean
  onDelete: () => void
  onDownload: () => void
}) {
  const isImage = attachment.manifest.mimeType.startsWith('image/')
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isImage || !cardRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '160px' })
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [isImage])

  useEffect(() => {
    if (!isImage || !botToken || !visible) return
    let active = true
    void previewUrl(botToken, attachment)
      .then((url) => {
        if (active) setImageUrl(url)
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
    return () => {
      active = false
    }
  }, [attachment, botToken, isImage, visible])

  return (
    <div ref={cardRef} className="overflow-hidden rounded-md border border-hairline bg-canvas-card dark:border-gray-800 dark:bg-dark-elevated">
      {isImage && (
        <div className="flex min-h-36 items-center justify-center bg-black/5 dark:bg-black/20">
          {imageUrl ? (
            <img src={imageUrl} alt={attachment.manifest.fileName} className="max-h-72 w-full object-contain" />
          ) : error || !botToken ? (
            <div className="flex flex-col items-center gap-2 p-4 text-center text-xs text-ink-muted">
              <ImageIcon size={28} />
              {error || 'Configure Telegram Drive to load this image.'}
            </div>
          ) : (
            <Loader2 size={22} className="animate-spin text-primary" />
          )}
        </div>
      )}
      <div className="flex items-center gap-3 p-3">
        {!isImage && <FileArchive size={20} className="shrink-0 text-primary" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink dark:text-gray-100">{attachment.manifest.fileName}</p>
          <p className="text-xs text-ink-muted">{formatBytes(attachment.manifest.size)} / {attachment.manifest.parts.length} part(s)</p>
        </div>
        <button type="button" disabled={!botToken || busy} onClick={onDownload} title="Download" className="rounded-md p-2 text-ink-muted hover:bg-canvas hover:text-primary disabled:opacity-40 dark:hover:bg-dark">
          <Download size={16} />
        </button>
        <button type="button" disabled={busy} onClick={onDelete} title="Remove attachment" className="rounded-md p-2 text-ink-muted hover:bg-canvas hover:text-error disabled:opacity-40 dark:hover:bg-dark">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

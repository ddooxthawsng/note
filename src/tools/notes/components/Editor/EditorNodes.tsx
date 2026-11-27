import { useEffect, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { Check, ClipboardCopy, Download, FileArchive, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatBytes, getTelegramSettings, parseManifest, TelegramBrowserDownloadError } from '@/tools/telegram/telegramApi'
import { downloadTelegramFile, openRemoteDownload, saveBlob } from '@/tools/telegram/telegramDriveService'
import { getAttachmentPreviewUrl } from '@/tools/notes/components/Editor/NoteAttachments'
import type { NoteAttachment } from '@/tools/notes/types/note'

function TelegramMediaView({ node, deleteNode, editor }: NodeViewProps) {
  const { attachmentId, fileName, mimeType, size, manifestJson } = node.attrs as {
    attachmentId: string
    fileName: string
    mimeType: string
    size: number
    manifestJson: string
  }

  const isImage = (mimeType || '').startsWith('image/')
  const { botToken } = getTelegramSettings()
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!isImage || !botToken || !manifestJson) return
    let active = true
    try {
      const manifest = parseManifest(manifestJson)
      const attachment: NoteAttachment = { id: attachmentId, manifest }
      void getAttachmentPreviewUrl(botToken, attachment)
        .then((url) => {
          if (active) setImageUrl(url)
        })
        .catch((err: Error) => {
          if (active) setError(err.message)
        })
    } catch (err) {
      setError((err as Error).message)
    }
    return () => {
      active = false
    }
  }, [attachmentId, botToken, isImage, manifestJson])

  async function handleDownload() {
    if (!botToken || !manifestJson || downloading) return
    setDownloading(true)
    try {
      const manifest = parseManifest(manifestJson)
      const blob = await downloadTelegramFile(botToken, manifest)
      saveBlob(blob, manifest.fileName)
    } catch (err) {
      try {
        const manifest = parseManifest(manifestJson)
        if (err instanceof TelegramBrowserDownloadError && manifest.parts.length === 1) {
          openRemoteDownload(err.url, manifest.fileName)
          return
        }
      } catch {
        // ignore parse error
      }
      toast.error((err as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <NodeViewWrapper className="my-3 select-none" contentEditable={false}>
      <div className="group relative overflow-hidden rounded-xl border border-hairline bg-canvas-soft/80 shadow-sm dark:border-gray-800 dark:bg-dark-elevated/80">
        {isImage ? (
          <div className="relative flex min-h-32 items-center justify-center bg-black/5 dark:bg-black/25">
            {imageUrl ? (
              <img src={imageUrl} alt={fileName} className="max-h-[460px] w-auto max-w-full object-contain" />
            ) : error || !botToken ? (
              <div className="flex flex-col items-center gap-1.5 p-6 text-center text-xs text-ink-muted">
                <ImageIcon size={24} />
                <span>{error || 'Telegram Drive chưa được cấu hình.'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-6 text-xs text-ink-muted">
                <Loader2 size={18} className="animate-spin text-primary" /> Đang tải ảnh từ Telegram...
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-3 px-3.5 py-2.5">
          {!isImage && <FileArchive size={18} className="shrink-0 text-primary" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink dark:text-gray-100">{fileName}</p>
            <p className="text-[11px] text-ink-muted">{formatBytes(Number(size) || 0)} · Telegram Drive</p>
          </div>
          <button
            type="button"
            disabled={!botToken || downloading}
            onClick={() => void handleDownload()}
            title="Download"
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-canvas hover:text-primary disabled:opacity-40 dark:hover:bg-dark"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </button>
          {editor.isEditable && (
            <button
              type="button"
              onClick={deleteNode}
              title="Remove from note"
              className="rounded-lg p-1.5 text-ink-muted transition hover:bg-error/10 hover:text-error"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const TelegramMediaNode = Node.create({
  name: 'telegramMedia',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-attachment-id') || '',
        renderHTML: (attrs) => ({ 'data-attachment-id': attrs.attachmentId }),
      },
      fileName: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-file-name') || '',
        renderHTML: (attrs) => ({ 'data-file-name': attrs.fileName }),
      },
      mimeType: {
        default: 'application/octet-stream',
        parseHTML: (el) => el.getAttribute('data-mime-type') || 'application/octet-stream',
        renderHTML: (attrs) => ({ 'data-mime-type': attrs.mimeType }),
      },
      size: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-size') || 0),
        renderHTML: (attrs) => ({ 'data-size': String(attrs.size ?? 0) }),
      },
      manifestJson: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-manifest') || '',
        renderHTML: (attrs) => ({ 'data-manifest': attrs.manifestJson }),
      },
    }
  },

  parseHTML() {
    return [{ tag: '[data-type="telegram-media"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'telegram-media', class: 'telegram-media-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TelegramMediaView)
  },
})

function CopyBlockView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = node.textContent
    if (!text) {
      toast.error('Khối copy đang trống')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Đã copy nhanh!')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Không thể copy vào clipboard')
    }
  }

  return (
    <NodeViewWrapper className="my-2.5">
      <div className="group relative rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 pr-24 transition hover:border-primary/60 dark:bg-primary/10">
        <button
          type="button"
          contentEditable={false}
          onClick={() => void handleCopy()}
          className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-canvas/90 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-white active:scale-95 dark:bg-dark-elevated/90"
          title="Copy nội dung khối này"
        >
          {copied ? <Check size={13} className="text-success" /> : <ClipboardCopy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        <NodeViewContent className="min-h-[1.5rem] whitespace-pre-wrap font-mono text-sm text-ink dark:text-gray-100 outline-none" />
      </div>
    </NodeViewWrapper>
  )
}

export const CopyBlockNode = Node.create({
  name: 'copyBlock',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: '[data-type="copy-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'copy-block', class: 'copy-block' }),
      ['div', { class: 'copy-block-content' }, 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CopyBlockView)
  },
})

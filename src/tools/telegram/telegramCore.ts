export const maxTelegramPartBytes = 20 * 1024 * 1024

export interface TelegramPart {
  index: number
  fileId: string
  uniqueId?: string
  fileName: string
  size: number
  messageId?: number
  chatId?: string
}

export interface TelegramManifest {
  version: 1
  tool: 'telegram-drive'
  fileName: string
  mimeType: string
  size: number
  partSize: number
  createdAt: string
  parts: TelegramPart[]
}

export interface TelegramFileLike {
  name: string
  type?: string
  size: number
}

export interface TelegramPartRange {
  index: number
  start: number
  end: number
}

const imageMimeTypes: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function partCount(size: number, partSize = maxTelegramPartBytes) {
  return Math.max(1, Math.ceil(size / partSize))
}

export function planTelegramParts(size: number, partSize = maxTelegramPartBytes): TelegramPartRange[] {
  return Array.from({ length: partCount(size, partSize) }, (_, index) => {
    const start = index * partSize
    return { index, start, end: Math.min(size, start + partSize) }
  })
}

export function createManifest(file: TelegramFileLike, parts: TelegramPart[]): TelegramManifest {
  return {
    version: 1,
    tool: 'telegram-drive',
    fileName: file.name,
    mimeType: file.type || imageMimeTypes[file.name.split('.').pop()?.toLowerCase() ?? ''] || 'application/octet-stream',
    size: file.size,
    partSize: maxTelegramPartBytes,
    createdAt: new Date().toISOString(),
    parts,
  }
}

export function parseManifest(raw: string): TelegramManifest {
  const manifest = JSON.parse(raw) as TelegramManifest
  if (
    manifest?.version !== 1 ||
    manifest.tool !== 'telegram-drive' ||
    typeof manifest.fileName !== 'string' ||
    !Number.isFinite(manifest.size) ||
    manifest.size <= 0 ||
    !Number.isFinite(manifest.partSize) ||
    manifest.partSize <= 0 ||
    manifest.partSize > maxTelegramPartBytes ||
    !Array.isArray(manifest.parts) ||
    manifest.parts.length === 0 ||
    manifest.parts.some((part, index) => (
      part.index !== index ||
      !part.fileId ||
      !Number.isFinite(part.size) ||
      part.size <= 0 ||
      part.size > manifest.partSize
    )) ||
    manifest.parts.reduce((total, part) => total + part.size, 0) !== manifest.size
  ) {
    throw new Error('Invalid Telegram manifest.')
  }
  return manifest
}

export const maxTelegramPartBytes = 20 * 1024 * 1024

export interface TelegramPart {
  index: number
  fileId: string
  uniqueId?: string
  fileName: string
  size: number
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

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
    mimeType: file.type || 'application/octet-stream',
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
    typeof manifest.size !== 'number' ||
    typeof manifest.partSize !== 'number' ||
    !Array.isArray(manifest.parts) ||
    manifest.parts.length === 0 ||
    manifest.parts.some((part, index) => part.index !== index || !part.fileId || part.size > manifest.partSize)
  ) {
    throw new Error('Invalid Telegram manifest.')
  }
  return manifest
}

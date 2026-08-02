import {
  createManifest,
  downloadTelegramPart,
  partCount,
  planTelegramParts,
  uploadTelegramPart,
  type TelegramManifest,
  type TelegramPart,
} from '@/tools/telegram/telegramApi'

export async function uploadTelegramFile(
  botToken: string,
  chatId: string,
  file: File,
  onProgress?: (current: number, total: number) => void,
) {
  if (!file.size) throw new Error('Empty file')
  const total = partCount(file.size)
  const uploaded: TelegramPart[] = []
  for (const part of planTelegramParts(file.size)) {
    onProgress?.(part.index + 1, total)
    const chunk = file.slice(part.start, part.end, file.type || 'application/octet-stream')
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
  return createManifest(file, uploaded)
}

export async function downloadTelegramFile(
  botToken: string,
  manifest: TelegramManifest,
  onProgress?: (current: number, total: number) => void,
) {
  const parts = [...manifest.parts].sort((a, b) => a.index - b.index)
  const buffers: ArrayBuffer[] = []
  for (let index = 0; index < parts.length; index += 1) {
    onProgress?.(index + 1, parts.length)
    buffers.push(await downloadTelegramPart(botToken, parts[index].fileId))
  }
  const blob = new Blob(buffers, { type: manifest.mimeType || 'application/octet-stream' })
  if (blob.size !== manifest.size) {
    throw new Error(`Downloaded size mismatch: expected ${manifest.size}, received ${blob.size}.`)
  }
  return blob
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function openRemoteDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.referrerPolicy = 'no-referrer'
  link.rel = 'noopener noreferrer'
  link.click()
}

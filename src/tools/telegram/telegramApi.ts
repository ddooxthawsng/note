import { auth } from '@/shared/lib/firebase'
export {
  createManifest,
  formatBytes,
  maxTelegramPartBytes,
  parseManifest,
  partCount,
  planTelegramParts,
  type TelegramManifest,
  type TelegramPart,
} from '@/tools/telegram/telegramCore'

export interface TelegramUploadResult {
  fileId: string
  uniqueId?: string
  fileName: string
  size: number
}

const apiBaseUrl = ((import.meta.env.VITE_FIREBASE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')

export function apiUrl(path: string) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth?.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function responseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string; message?: string }
    return data.error || data.message || fallback
  } catch {
    return fallback
  }
}

export async function uploadTelegramPart({
  botToken,
  chatId,
  file,
  originalName,
  partIndex,
  totalParts,
}: {
  botToken: string
  chatId: string
  file: Blob
  originalName: string
  partIndex: number
  totalParts: number
}) {
  const form = new FormData()
  form.append('botToken', botToken)
  form.append('chatId', chatId)
  form.append('originalName', originalName)
  form.append('partIndex', String(partIndex))
  form.append('totalParts', String(totalParts))
  form.append('file', file, `${originalName}.part-${String(partIndex).padStart(3, '0')}-of-${String(totalParts).padStart(3, '0')}`)

  const response = await fetch(apiUrl('/api/telegram/upload-part'), {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  })
  if (!response.ok) throw new Error(await responseError(response, 'Telegram upload failed.'))
  return (await response.json()) as TelegramUploadResult
}

export async function downloadTelegramPart(botToken: string, fileId: string) {
  const response = await fetch(apiUrl('/api/telegram/download-part'), {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ botToken, fileId }),
  })
  if (!response.ok) throw new Error(await responseError(response, 'Telegram download failed.'))
  return response.arrayBuffer()
}

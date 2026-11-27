import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'

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
  messageId?: number
  chatId?: string
}

export interface TelegramDiscoveryResult {
  bot: { id: string; username?: string; firstName: string }
  chat: { id: string; type: string; title?: string; username?: string } | null
  startUrl: string | null
  webhookActive: boolean
}

export const telegramTokenKey = 'telegram_tool_bot_token'
export const telegramChatKey = 'telegram_tool_chat_id'

export class TelegramBrowserDownloadError extends Error {
  constructor(public readonly url: string) {
    super('The browser blocked Telegram file access.')
    this.name = 'TelegramBrowserDownloadError'
  }
}

export function getTelegramSettings() {
  return {
    botToken: localStorage.getItem(telegramTokenKey) ?? '',
    chatId: localStorage.getItem(telegramChatKey) ?? '',
  }
}

export function setLocalTelegramSettings(botToken: string, chatId: string) {
  if (botToken) localStorage.setItem(telegramTokenKey, botToken)
  else localStorage.removeItem(telegramTokenKey)
  if (chatId) localStorage.setItem(telegramChatKey, chatId)
  else localStorage.removeItem(telegramChatKey)
}

export async function saveSharedTelegramConfig(botToken: string, chatId: string, updatedBy?: string | null) {
  const cleanToken = botToken.trim()
  const cleanChatId = chatId.trim()
  setLocalTelegramSettings(cleanToken, cleanChatId)
  if (!db) return
  await setDoc(
    doc(db, 'appConfig', 'telegram'),
    {
      botToken: cleanToken,
      chatId: cleanChatId,
      updatedBy: updatedBy ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export function subscribeToSharedTelegramConfig(
  cb?: (config: { botToken: string; chatId: string }) => void,
) {
  if (!db) return () => {}
  return onSnapshot(
    doc(db, 'appConfig', 'telegram'),
    (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as { botToken?: string; chatId?: string }
      const botToken = typeof data.botToken === 'string' ? data.botToken : ''
      const chatId = typeof data.chatId === 'string' ? data.chatId : ''
      if (botToken || chatId) {
        setLocalTelegramSettings(botToken, chatId)
      }
      cb?.({ botToken, chatId })
    },
    () => {
      // Ignore permission errors before user is approved
    },
  )
}

interface TelegramResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

async function telegramRequest<T>(botToken: string, method: string, init?: RequestInit): Promise<T> {
  if (!botToken.trim()) throw new Error('Bot token required')
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/${method}`, init)
    const payload = (await response.json()) as TelegramResponse<T>
    if (!response.ok || !payload.ok || payload.result === undefined) {
      throw new Error(payload.description || `Telegram ${method} failed.`)
    }
    return payload.result
  } catch (error) {
    if (error instanceof Error && !(error instanceof TypeError)) throw error
    throw new Error('Cannot reach Telegram directly. Check your network or browser CORS settings.')
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
  form.append('chat_id', chatId)
  form.append('caption', `${originalName} [${partIndex}/${totalParts}]`.slice(0, 1024))
  const partName = totalParts === 1
    ? originalName
    : `${originalName}.part-${String(partIndex).padStart(3, '0')}-of-${String(totalParts).padStart(3, '0')}`
  form.append('document', file, partName)

  const message = await telegramRequest<{
    message_id?: number
    chat?: { id?: string | number }
    document: { file_id: string; file_unique_id?: string; file_name?: string; file_size?: number }
  }>(botToken, 'sendDocument', {
    method: 'POST',
    body: form,
  })
  return {
    fileId: message.document.file_id,
    uniqueId: message.document.file_unique_id,
    fileName: message.document.file_name ?? partName,
    size: message.document.file_size ?? file.size,
    messageId: message.message_id,
    chatId: String(message.chat?.id ?? chatId),
  } satisfies TelegramUploadResult
}

export async function downloadTelegramPart(botToken: string, fileId: string) {
  const url = await getTelegramFileUrl(botToken, fileId)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw new Error(`Telegram download failed (${response.status}).`)
    return await response.arrayBuffer()
  } catch (error) {
    if (error instanceof Error && !(error instanceof TypeError)) throw error
    throw new TelegramBrowserDownloadError(url)
  }
}

export async function getTelegramFileUrl(botToken: string, fileId: string) {
  const file = await telegramRequest<{ file_path?: string }>(botToken, 'getFile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  if (!file.file_path) throw new Error('Telegram did not return a file path.')
  return `https://api.telegram.org/file/bot${botToken.trim()}/${file.file_path}`
}

export async function discoverTelegramChat(botToken: string) {
  const bot = await telegramRequest<{ id: number; username?: string; first_name: string }>(botToken, 'getMe')
  const webhook = await telegramRequest<{ url?: string }>(botToken, 'getWebhookInfo')
  const result: TelegramDiscoveryResult = {
    bot: { id: String(bot.id), username: bot.username, firstName: bot.first_name },
    chat: null,
    startUrl: bot.username ? `https://t.me/${bot.username}?start=telegram_drive` : null,
    webhookActive: Boolean(webhook.url),
  }
  if (result.webhookActive) return result

  const updates = await telegramRequest<Array<Record<string, unknown>>>(botToken, 'getUpdates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 100, timeout: 0, allowed_updates: ['message', 'channel_post', 'my_chat_member'] }),
  })
  const candidates = updates
    .map(chatFromUpdate)
    .filter((item): item is { chat: Record<string, unknown>; isStart: boolean } => Boolean(item))
  const selected = [...candidates].reverse().find((item) => item.isStart) ?? candidates[candidates.length - 1]
  if (selected) {
    const chat = selected.chat
    result.chat = {
      id: String(chat.id),
      type: String(chat.type ?? 'unknown'),
      title: String(chat.title ?? ([chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '')),
      username: typeof chat.username === 'string' ? chat.username : undefined,
    }
  }
  return result
}

function chatFromUpdate(update: Record<string, unknown>) {
  for (const key of ['message', 'channel_post', 'edited_message', 'edited_channel_post']) {
    const message = update[key] as { chat?: Record<string, unknown>; text?: string } | undefined
    if (message?.chat) return { chat: message.chat, isStart: message.text?.startsWith('/start') ?? false }
  }
  const membership = (update.my_chat_member ?? update.chat_member) as { chat?: Record<string, unknown> } | undefined
  return membership?.chat ? { chat: membership.chat, isStart: false } : null
}

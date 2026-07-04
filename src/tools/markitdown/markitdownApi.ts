import { auth } from '@/shared/lib/firebase'

export type BackendMode = 'firebase' | 'local'

export interface Quota {
  used: number
  limit: number
  remaining: number
  resetDate: string
  enabled: boolean
}

export interface ConversionResult {
  filename: string
  markdown: string
}

export const maxFileBytes = 20 * 1024 * 1024

const backendStorageKey = 'markitdown_backend'
const firebaseApiBaseUrl = ((import.meta.env.VITE_FIREBASE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')

export function getSavedBackendMode(): BackendMode {
  return localStorage.getItem(backendStorageKey) === 'local' ? 'local' : 'firebase'
}

export function saveBackendMode(mode: BackendMode) {
  localStorage.setItem(backendStorageKey, mode)
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function validateDocumentFile(file: File): string | null {
  if (file.size > maxFileBytes) return 'File too large. Maximum size is 20MB.'
  return null
}

export function nextQuotaResetDate(now = new Date()) {
  const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return reset.toISOString().slice(0, 10)
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

function apiUrl(mode: BackendMode, path: string) {
  if (mode === 'local') return `http://localhost:8000${path}`
  return firebaseApiBaseUrl ? `${firebaseApiBaseUrl}${path}` : path
}

export async function fetchQuota(mode: BackendMode): Promise<Quota> {
  if (mode === 'local') {
    return { used: 0, limit: 0, remaining: 0, resetDate: '-', enabled: false }
  }

  const response = await fetch(apiUrl(mode, '/api/quota'), { headers: await authHeaders() })
  if (!response.ok) {
    throw new Error(await responseError(response, 'Firebase converter is not deployed.'))
  }

  const data = (await response.json()) as Partial<Quota> & { monthlyLimit?: number; reset?: string }
  const limit = Number(data.limit ?? data.monthlyLimit ?? 100)
  const used = Number(data.used ?? 0)
  const remaining = Number(data.remaining ?? Math.max(0, limit - used))

  return {
    used,
    limit,
    remaining,
    resetDate: String(data.resetDate ?? data.reset ?? nextQuotaResetDate()),
    enabled: true,
  }
}

export async function convertDocument(file: File, mode: BackendMode): Promise<ConversionResult> {
  const form = new FormData()
  form.append('file', file)

  const url = apiUrl(mode, '/api/convert')

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: mode === 'firebase' ? await authHeaders() : undefined,
      body: form,
    })
  } catch {
    throw new Error(mode === 'local' ? 'Local converter is offline.' : 'Network error.')
  }

  if (!response.ok) {
    throw new Error(await responseError(response, mode === 'firebase' ? 'Firebase converter is not deployed.' : 'Conversion failed.'))
  }

  const data = (await response.json()) as Partial<ConversionResult> & { content?: string }
  const markdown = typeof data.markdown === 'string' ? data.markdown : data.content
  if (typeof markdown !== 'string') throw new Error('Conversion failed.')

  return { filename: data.filename ?? file.name, markdown }
}

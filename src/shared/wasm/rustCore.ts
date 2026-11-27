import initWasm, {
  count_words,
  format_bytes,
  infer_mime_type,
  part_count,
  password_strength,
  plan_telegram_parts_json,
  sha256_hex,
  validate_manifest_json,
} from '@/shared/wasm/tool_core/tool_core'
import type { TelegramManifest, TelegramPartRange } from '@/tools/telegram/telegramCore'

let ready = false
let initPromise: Promise<boolean> | null = null

/** Initialize the Rust/WASM core once on app startup. Never rejects. */
export function initRustCore(): Promise<boolean> {
  if (ready) return Promise.resolve(true)
  if (!initPromise) {
    initPromise = initWasm()
      .then(() => {
        ready = true
        return true
      })
      .catch((err) => {
        console.warn('Rust/WASM core unavailable, using TypeScript fallback:', err)
        return false
      })
  }
  return initPromise
}

export function isRustCoreReady(): boolean {
  return ready
}

export function rustFormatBytes(bytes: number): string | null {
  if (!ready) return null
  return format_bytes(bytes)
}

export function rustPartCount(size: number, partSize?: number): number | null {
  if (!ready) return null
  return part_count(size, partSize ?? null)
}

export function rustPlanTelegramParts(size: number, partSize?: number): TelegramPartRange[] | null {
  if (!ready) return null
  return JSON.parse(plan_telegram_parts_json(size, partSize ?? null)) as TelegramPartRange[]
}

export function rustInferMimeType(fileName: string, provided?: string): string | null {
  if (!ready) return null
  return infer_mime_type(fileName, provided ?? '')
}

export function rustValidateManifest(raw: string): TelegramManifest | null {
  if (!ready) return null
  return JSON.parse(validate_manifest_json(raw)) as TelegramManifest
}

export function rustCountWords(html: string): number | null {
  if (!ready) return null
  return count_words(html)
}

export function rustPasswordStrength(pw: string): number | null {
  if (!ready) return null
  return password_strength(pw)
}

export function rustSha256Hex(input: string): string | null {
  if (!ready) return null
  return sha256_hex(input)
}

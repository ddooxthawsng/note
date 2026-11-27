import { z } from 'zod'
import { rustPasswordStrength } from '@/shared/wasm/rustCore'

export const emailSchema = z.string().email('Enter a valid email')

export const signUpSchema = z
  .object({
    displayName: z.string().min(2, 'Name must be at least 2 characters'),
    email: emailSchema,
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

/** Returns the first error message from a ZodError, or null. */
export function firstError(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid input'
}

/** Rough password strength score 0–4 for the meter. */
export function passwordStrength(pw: string): number {
  const wasmScore = rustPasswordStrength(pw)
  if (wasmScore !== null) return wasmScore
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return score
}

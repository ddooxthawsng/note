import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthShell from '@/features/auth/components/AuthShell'
import { resetPassword } from '@/shared/services/authService'
import { emailSchema, firstError } from '@/shared/utils/validators'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = firstError(emailSchema.safeParse(email))
    if (err) return toast.error(err)
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success('Reset email sent')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a reset link">
      {sent ? (
        <div className="text-center">
          <p className="mb-4 text-sm text-gray-500">
            Check <span className="font-medium">{email}</span> for a link to reset your password.
          </p>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-800 dark:text-stone-200">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-stone-600 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <Link to="/login" className="text-center text-sm text-primary hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  )
}

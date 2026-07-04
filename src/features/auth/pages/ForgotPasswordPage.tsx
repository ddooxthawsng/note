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
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800"
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

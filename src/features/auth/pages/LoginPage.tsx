import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthShell from '@/features/auth/components/AuthShell'
import { signIn, signInWithGoogle } from '@/shared/services/authService'
import { signInSchema, firstError } from '@/shared/utils/validators'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = firstError(signInSchema.safeParse({ email, password }))
    if (err) return toast.error(err)
    setLoading(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await signInWithGoogle()
      navigate(from, { replace: true })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to Tool">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-body">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated text-ink dark:text-gray-250"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-ink-body">Password</label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated text-ink dark:text-gray-250"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary py-2.5 font-medium text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-hairline dark:bg-gray-800" />
        OR
        <span className="h-px flex-1 bg-hairline dark:bg-gray-800" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-hairline py-2.5 font-medium transition hover:bg-canvas-card disabled:opacity-60 dark:border-gray-850 dark:hover:bg-dark-elevated text-ink-body dark:text-gray-300"
      >
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-ink-muted">
        No account?{' '}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}

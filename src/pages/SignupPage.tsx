import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthShell from '@/components/AuthShell'
import { signUp, signInWithGoogle } from '@/services/authService'
import { signUpSchema, firstError, passwordStrength } from '@/utils/validators'
import { cn } from '@/utils/cn'

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColors = ['bg-error', 'bg-error', 'bg-warning', 'bg-primary', 'bg-success']

export default function SignupPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = passwordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = firstError(signUpSchema.safeParse({ displayName, email, password, confirm }))
    if (err) return toast.error(err)
    setLoading(true)
    try {
      await signUp(email, password, displayName)
      toast.success('Account created!')
      navigate('/', { replace: true })
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
      navigate('/', { replace: true })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start taking better notes">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-body">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated text-ink dark:text-gray-250"
            placeholder="Jane Doe"
          />
        </div>
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
          <label className="mb-1 block text-sm font-medium text-ink-body">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated text-ink dark:text-gray-250"
            placeholder="••••••••"
          />
          {password && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-card dark:bg-dark">
                <div
                  className={cn('h-full transition-all', strengthColors[strength])}
                  style={{ width: `${(strength / 4) * 100}%` }}
                />
              </div>
              <span className="text-xs text-ink-muted">{strengthLabels[strength]}</span>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-body">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark-elevated text-ink dark:text-gray-250"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary py-2.5 font-medium text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create account'}
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
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

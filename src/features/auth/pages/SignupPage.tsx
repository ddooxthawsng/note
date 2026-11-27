import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthShell from '@/features/auth/components/AuthShell'
import { signUp, signInWithGoogle } from '@/shared/services/authService'
import { signUpSchema, firstError, passwordStrength } from '@/shared/utils/validators'
import { cn } from '@/shared/utils/cn'
import { useAuth } from '@/shared/hooks/useAuth'

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColors = ['bg-error', 'bg-error', 'bg-warning', 'bg-primary', 'bg-success']

export default function SignupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

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
      const signedIn = await signInWithGoogle()
      if (signedIn) {
        navigate('/', { replace: true })
      }
    } catch (e) {
      toast.error((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Create account" subtitle="Start taking better notes">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-800 dark:text-stone-200">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-stone-600 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400"
            placeholder="Jane Doe"
          />
        </div>
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
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-800 dark:text-stone-200">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-stone-600 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400"
            placeholder="••••••••"
          />
          {password && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <div
                  className={cn('h-full transition-all', strengthColors[strength])}
                  style={{ width: `${(strength / 4) * 100}%` }}
                />
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400">{strengthLabels[strength]}</span>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-800 dark:text-stone-200">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-stone-600 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-hover active:scale-95 disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs font-medium text-stone-500 dark:text-stone-400">
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
        OR
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 active:scale-95 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
      >
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-stone-600 dark:text-stone-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

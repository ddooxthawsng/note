import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthShell from '@/features/auth/components/AuthShell'
import { signIn, signInWithGoogle } from '@/shared/services/authService'
import { signInSchema, firstError } from '@/shared/utils/validators'
import { useAuth } from '@/shared/hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, from, navigate])

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
      const signedIn = await signInWithGoogle()
      if (signedIn) {
        navigate(from, { replace: true })
      }
    } catch (e) {
      toast.error((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to Tool">
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
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-semibold text-stone-800 dark:text-stone-200">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-stone-600 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-400"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-hover active:scale-95 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
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
        No account?{' '}
        <Link to="/signup" className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}

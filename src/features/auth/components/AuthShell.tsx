import { NotebookPen } from 'lucide-react'
import { isFirebaseConfigured } from '@/shared/lib/firebase'
import ThreeBackground from '@/shared/components/ThreeBackground'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-canvas p-4 dark:bg-dark">
      <ThreeBackground />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-stone-200/90 bg-white/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl dark:border-stone-700/80 dark:bg-stone-900/90">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md">
            <NotebookPen size={24} />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{title}</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{subtitle}</p>
        </div>

        {!isFirebaseConfigured && (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            Firebase not configured. Fill <code className="font-mono">.env.local</code> with your
            Firebase keys, then restart the dev server.
          </div>
        )}

        {children}
      </div>
    </div>
  )
}

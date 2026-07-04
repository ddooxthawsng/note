import { NotebookPen } from 'lucide-react'
import { isFirebaseConfigured } from '@/shared/lib/firebase'

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-gray-50 to-secondary/10 p-4 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <NotebookPen size={24} />
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
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

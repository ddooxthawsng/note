import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore'
import { AlertTriangle, BarChart3, Database, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '@/shared/lib/firebase'

interface QuotaDoc {
  id: string
  uid?: string
  period?: string
  used?: number
  limit?: number
  resetDate?: string
}

interface Metrics {
  users?: number
  notes?: number
  folders?: number
  tasks?: number
  quotaDocs: QuotaDoc[]
  errors: Record<string, string>
}

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const hostingUrl = (import.meta.env.VITE_FIREBASE_API_BASE_URL || 'https://thangdo.web.app').replace(/\/$/, '')
const consoleUrl = `https://console.firebase.google.com/project/${projectId}/usage/details`
const period = new Date().toISOString().slice(0, 7)
const quotaCollection = 'toolQuota'

export default function FirebaseMonitorPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  const quota = useMemo(() => {
    const docs = metrics?.quotaDocs ?? []
    const used = docs.reduce((sum, item) => sum + Number(item.used ?? 0), 0)
    const limit = docs.reduce((sum, item) => sum + Number(item.limit ?? 100), 0)
    return { docs, used, limit, remaining: Math.max(0, limit - used) }
  }, [metrics])

  async function loadMetrics() {
    if (!db) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [users, notes, folders, tasks, quotaSnap] = await Promise.all([
        safeCount('users'),
        safeCount('notes'),
        safeCount('folders'),
        safeCount('tasks'),
        getDocs(query(collection(db, quotaCollection), where('period', '==', period))).catch((error) => error as Error),
      ])

      const errors: Record<string, string> = {}
      for (const [key, value] of Object.entries({ users, notes, folders, tasks })) {
        if (value instanceof Error) errors[key] = value.message
      }
      if (quotaSnap instanceof Error) errors.quota = quotaSnap.message

      const quotaDocs = quotaSnap instanceof Error
        ? []
        : quotaSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as QuotaDoc)
          .sort((a, b) => Number(b.used ?? 0) - Number(a.used ?? 0))

      setMetrics({
        users: users instanceof Error ? undefined : users,
        notes: notes instanceof Error ? undefined : notes,
        folders: folders instanceof Error ? undefined : folders,
        tasks: tasks instanceof Error ? undefined : tasks,
        quotaDocs,
        errors,
      })

    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMetrics()
  }, [])

  return (
    <div className="w-full flex-1 overflow-y-auto p-4 animate-fade-in-up md:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Admin</p>
            <h1 className="text-3xl font-serif font-normal text-ink dark:text-gray-100">Firebase Monitor</h1>
          </div>
          <button
            type="button"
            onClick={loadMetrics}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink-body transition hover:bg-canvas-card dark:border-gray-800 dark:bg-dark-soft dark:text-gray-200 dark:hover:bg-dark-elevated"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-base font-semibold text-ink dark:text-gray-100">{projectId}</h2>
              <p className="text-sm text-ink-muted">{hostingUrl}</p>
            </div>
            <a
              href={consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
            >
              Firebase Usage
              <ExternalLink size={15} />
            </a>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={Database} label="Users" loading={loading} value={metrics?.users} error={metrics?.errors.users} />
          <MetricCard icon={Database} label="Notes" loading={loading} value={metrics?.notes} error={metrics?.errors.notes} />
          <MetricCard icon={Database} label="Folders" loading={loading} value={metrics?.folders} error={metrics?.errors.folders} />
          <MetricCard icon={Database} label="Tasks" loading={loading} value={metrics?.tasks} error={metrics?.errors.tasks} />
        </div>

        <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-base font-semibold text-ink dark:text-gray-100">MarkItDown quota</h2>
              <p className="text-sm text-ink-muted">Period {period}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md bg-canvas-card px-3 py-2 text-sm font-semibold text-ink dark:bg-dark-elevated dark:text-gray-100">
              <BarChart3 size={16} className="text-primary" />
              {quota.used} / {quota.limit || 0}
            </span>
          </div>

          {quota.remaining <= 10 && quota.limit > 0 && (
            <p className="mb-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
              <AlertTriangle size={16} />
              Quota nearly exhausted.
            </p>
          )}

          <div className="overflow-hidden rounded-md border border-hairline dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas-card text-xs uppercase tracking-wider text-ink-muted dark:bg-dark-elevated">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Used</th>
                  <th className="px-4 py-3">Limit</th>
                  <th className="px-4 py-3">Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline dark:divide-gray-800">
                {loading ? (
                  <tr><td className="px-4 py-8 text-center text-ink-muted" colSpan={4}>Loading...</td></tr>
                ) : metrics?.errors.quota ? (
                  <tr><td className="px-4 py-8 text-center text-error" colSpan={4}>{metrics.errors.quota}</td></tr>
                ) : quota.docs.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-ink-muted" colSpan={4}>No conversion usage this month.</td></tr>
                ) : (
                  quota.docs.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-mono text-xs">{item.uid ?? item.id}</td>
                      <td className="px-4 py-3 font-semibold">{item.used ?? 0}</td>
                      <td className="px-4 py-3">{item.limit ?? 100}</td>
                      <td className="px-4 py-3">{item.resetDate ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

async function count(name: string) {
  if (!db) return 0
  const snap = await getCountFromServer(collection(db, name) as CollectionReference<DocumentData>)
  return snap.data().count
}

async function safeCount(name: string) {
  try {
    return await count(name)
  } catch (error) {
    return error as Error
  }
}

function MetricCard({
  icon: Icon,
  label,
  loading,
  value,
  error,
}: {
  icon: typeof Database
  label: string
  loading: boolean
  value?: number
  error?: string
}) {
  return (
    <div className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-muted">
        <Icon size={16} className="text-primary" />
        {label}
      </div>
      <div className="font-sans text-2xl font-semibold text-ink dark:text-gray-100">
        {loading ? <Loader2 size={22} className="animate-spin text-primary" /> : error ? <span className="text-sm text-error">No permission</span> : (value ?? 0).toLocaleString()}
      </div>
    </div>
  )
}

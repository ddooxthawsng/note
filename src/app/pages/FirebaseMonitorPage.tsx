import { useEffect, useState } from 'react'
import {
  collection,
  getCountFromServer,
  getDocs,
  type CollectionReference,
  type DocumentData,
} from 'firebase/firestore'
import { Cloud, Database, ExternalLink, FileArchive, HardDrive, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { db } from '@/shared/lib/firebase'
import { formatBytes, type TelegramManifest } from '@/tools/telegram/telegramCore'

interface Metrics {
  users?: number
  notes?: number
  folders?: number
  tasks?: number
  telegramFiles?: number
  telegramBytes: number
  telegramParts: number
  telegramMetadataBytes: number
  errors: Record<string, string>
}

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const hostingUrl = (import.meta.env.VITE_FIREBASE_API_BASE_URL || 'https://thangdo.web.app').replace(/\/$/, '')
const consoleUrl = `https://console.firebase.google.com/project/${projectId}/usage/details`

export default function FirebaseMonitorPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadMetrics() {
    if (!db) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [users, notes, folders, tasks, telegramSnap] = await Promise.all([
        safeCount('users'),
        safeCount('notes'),
        safeCount('folders'),
        safeCount('tasks'),
        // ponytail: exact byte totals scan tiny metadata docs; add an aggregate only when this collection becomes large.
        getDocs(collection(db, 'telegramFiles')).catch((error) => error as Error),
      ])

      const errors: Record<string, string> = {}
      for (const [key, value] of Object.entries({ users, notes, folders, tasks })) {
        if (value instanceof Error) errors[key] = value.message
      }
      if (telegramSnap instanceof Error) errors.telegram = telegramSnap.message

      const telegramDocs = telegramSnap instanceof Error ? [] : telegramSnap.docs.map((item) => item.data() as { manifest?: TelegramManifest })

      setMetrics({
        users: users instanceof Error ? undefined : users,
        notes: notes instanceof Error ? undefined : notes,
        folders: folders instanceof Error ? undefined : folders,
        tasks: tasks instanceof Error ? undefined : tasks,
        telegramFiles: telegramSnap instanceof Error ? undefined : telegramSnap.size,
        telegramBytes: telegramDocs.reduce((sum, item) => sum + Number(item.manifest?.size ?? 0), 0),
        telegramParts: telegramDocs.reduce((sum, item) => sum + Number(item.manifest?.parts.length ?? 0), 0),
        telegramMetadataBytes: telegramDocs.reduce((sum, item) => sum + new TextEncoder().encode(JSON.stringify(item)).length, 0),
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

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard icon={Database} label="Users" loading={loading} value={metrics?.users} error={metrics?.errors.users} />
          <MetricCard icon={Database} label="Notes" loading={loading} value={metrics?.notes} error={metrics?.errors.notes} />
          <MetricCard icon={Database} label="Folders" loading={loading} value={metrics?.folders} error={metrics?.errors.folders} />
          <MetricCard icon={Database} label="Tasks" loading={loading} value={metrics?.tasks} error={metrics?.errors.tasks} />
          <MetricCard icon={FileArchive} label="Telegram Files" loading={loading} value={metrics?.telegramFiles} error={metrics?.errors.telegram} />
        </div>

        <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
          <div className="mb-4">
            <h2 className="font-sans text-base font-semibold text-ink dark:text-gray-100">Storage</h2>
            <p className="text-sm text-ink-muted">Binary data stays in Telegram; Firestore stores only searchable metadata and note text.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StorageCard icon={HardDrive} label="Telegram binary" value={formatBytes(metrics?.telegramBytes ?? 0)} detail={`${metrics?.telegramParts ?? 0} parts`} />
            <StorageCard icon={Database} label="Telegram metadata" value={formatBytes(metrics?.telegramMetadataBytes ?? 0)} detail="Approximate Firestore JSON size" />
            <StorageCard icon={Cloud} label="Firestore free storage" value="1 GiB" detail="Actual usage: Firebase Console" />
          </div>
        </section>

        <section className="rounded-md border border-hairline bg-canvas p-4 dark:border-gray-800 dark:bg-dark-soft">
          <div className="mb-4">
            <h2 className="font-sans text-base font-semibold text-ink dark:text-gray-100">Firebase free quota</h2>
            <p className="text-sm text-ink-muted">Limits are shown here; Firebase does not expose current project usage through the browser SDK.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuotaCard label="Firestore reads" value="50,000 / day" />
            <QuotaCard label="Firestore writes" value="20,000 / day" />
            <QuotaCard label="Firestore deletes" value="20,000 / day" />
            <QuotaCard label="Firestore outbound" value="10 GiB / month" />
            <QuotaCard label="Hosting storage" value="10 GB" />
            <QuotaCard label="Hosting transfer" value="10 GB / month" />
          </div>
        </section>
      </div>
    </div>
  )
}

function StorageCard({ icon: Icon, label, value, detail }: { icon: typeof Database; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md bg-canvas-card p-3 dark:bg-dark-elevated">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted"><Icon size={15} className="text-primary" />{label}</p>
      <p className="text-xl font-semibold text-ink dark:text-gray-100">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </div>
  )
}

function QuotaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2 dark:border-gray-800">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold text-ink dark:text-gray-100">{value}</span>
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

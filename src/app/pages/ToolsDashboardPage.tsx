import { Link } from 'react-router-dom'
import { ArrowRight, NotebookPen, Send, Smartphone } from 'lucide-react'

export default function ToolsDashboardPage() {
  return (
    <div className="w-full flex-1 overflow-y-auto p-4 sm:p-6 animate-fade-in-up">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-hairline/80 bg-canvas-card/75 p-5 sm:p-7 backdrop-blur-xl shadow-sm dark:border-gray-800/80 dark:bg-dark-elevated/75">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">3D Workspace</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-serif font-normal text-ink dark:text-gray-100">Dashboard</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Collaborative notes, real-time sync, and shared Telegram Drive storage.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ToolCard
            description="Notes, folders, tasks, favorites, real-time sharing & 30-version history."
            href="/tools/notes"
            icon={NotebookPen}
            label="Open Notes"
            title="Notes"
          />
          <ToolCard
            description="Split, upload, download, and attach files through a shared Telegram bot."
            href="/tools/telegram"
            icon={Send}
            label="Open Telegram Drive"
            title="Telegram Drive"
          />
          <ToolCard
            description="Tải file cài đặt Android APK phiên bản mới nhất với đầy đủ tính năng đồng bộ."
            href="/download"
            icon={Smartphone}
            label="Download APK"
            title="Android App"
          />
        </div>
      </div>
    </div>
  )
}

function ToolCard({
  description,
  href,
  icon: Icon,
  label,
  title,
}: {
  description: string
  href: string
  icon: typeof NotebookPen
  label: string
  title: string
}) {
  return (
    <section className="group rounded-2xl border border-hairline/80 bg-canvas-card/80 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl dark:border-gray-800/80 dark:bg-dark-elevated/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="rounded-xl border border-primary/25 bg-primary/10 p-2.5 text-primary transition-transform duration-300 group-hover:scale-110">
            <Icon size={22} />
          </span>
          <div>
            <h2 className="font-sans text-lg font-semibold text-ink dark:text-gray-100">{title}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
          </div>
        </div>
        <Link
          to={href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover active:scale-95"
        >
          {label}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}

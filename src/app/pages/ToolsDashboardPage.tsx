import { Link } from 'react-router-dom'
import { ArrowRight, FileText, NotebookPen, Send } from 'lucide-react'

export default function ToolsDashboardPage() {
  return (
    <div className="w-full flex-1 overflow-y-auto p-6 animate-fade-in-up">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Workspace</p>
          <h1 className="text-3xl font-serif font-normal text-ink dark:text-gray-100">Dashboard</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ToolCard
            description="Notes, folders, tasks, favorites, trash."
            href="/tools/notes"
            icon={NotebookPen}
            label="Open Notes"
            title="Notes"
          />
          <ToolCard
            description="Convert documents to Markdown."
            href="/tools/markitdown"
            icon={FileText}
            label="Open Converter"
            title="MarkItDown"
          />
          <ToolCard
            description="Split, upload, download, and merge files through a Telegram bot."
            href="/tools/telegram"
            icon={Send}
            label="Open Telegram Drive"
            title="Telegram Drive"
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
    <section className="rounded-md border border-hairline bg-canvas p-5 dark:border-gray-800 dark:bg-dark-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-primary/20 bg-primary/10 p-2 text-primary">
            <Icon size={22} />
          </span>
          <div>
            <h2 className="font-sans text-lg font-semibold text-ink dark:text-gray-100">{title}</h2>
            <p className="text-sm text-ink-muted">{description}</p>
          </div>
        </div>
        <Link
          to={href}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
        >
          {label}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}

import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, FileText, LayoutDashboard, LogOut, Moon, NotebookPen, Send, Settings, Sun, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useUiStore } from '@/shared/store/uiStore'
import { cn } from '@/shared/utils/cn'
import { logOut } from '@/shared/services/authService'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tools/notes', label: 'Notes', icon: NotebookPen, end: false },
  { to: '/tools/markitdown', label: 'MarkItDown', icon: FileText, end: false },
  { to: '/tools/telegram', label: 'Telegram', icon: Send, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useUiStore()

  async function handleLogout() {
    try {
      await logOut()
      toast.success('Signed out')
      navigate('/login')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-hairline bg-canvas px-3 dark:border-gray-800 dark:bg-dark">
      <div className="flex items-center gap-2 font-serif text-lg font-normal text-ink dark:text-gray-100">
        <LayoutDashboard size={20} className="text-primary" />
        <span className="hidden font-serif font-medium tracking-tight sm:inline">Tool</span>
      </div>

      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
                isActive && 'bg-primary/10 text-primary dark:bg-primary/20',
              )
            }
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <AdminLink icon={Users} label="Users" to="/users" />
            <AdminLink icon={BarChart3} label="Firebase" to="/admin/firebase" />
          </>
        )}
      </nav>

      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="rounded-md p-2 text-ink-body transition-colors hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="hidden items-center gap-2 md:flex">
        <span className="max-w-[140px] truncate text-sm font-medium text-ink-muted dark:text-gray-400">
          {user?.displayName || user?.email}
        </span>
      </div>

      <button
        onClick={handleLogout}
        aria-label="Sign out"
        className="rounded-md p-2 text-ink-muted transition-colors hover:bg-canvas-card hover:text-error dark:text-gray-400 dark:hover:bg-dark-elevated"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}

function AdminLink({ icon: Icon, label, to }: { icon: typeof Users; label: string; to: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition hover:bg-canvas-card dark:hover:bg-dark-elevated',
          isActive && 'bg-primary/10 dark:bg-primary/20',
        )
      }
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  )
}

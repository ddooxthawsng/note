import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, LayoutDashboard, LogOut, Moon, NotebookPen, Send, Settings, Smartphone, Sun, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useUiStore } from '@/shared/store/uiStore'
import { cn } from '@/shared/utils/cn'
import { logOut } from '@/shared/services/authService'

const links = [
  { to: '/', label: 'Home', desktopLabel: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tools/notes', label: 'Notes', desktopLabel: 'Notes', icon: NotebookPen, end: false },
  { to: '/tools/telegram', label: 'Drive', desktopLabel: 'Telegram', icon: Send, end: false },
  { to: '/download', label: 'APK', desktopLabel: 'Android', icon: Smartphone, end: false },
  { to: '/settings', label: 'Settings', desktopLabel: 'Settings', icon: Settings, end: false },
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 sm:gap-3 border-b border-hairline/80 bg-canvas/85 px-3 sm:px-4 backdrop-blur-xl dark:border-gray-800/80 dark:bg-dark/85">
      <div className="flex items-center gap-2 font-serif text-lg font-normal text-ink dark:text-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <LayoutDashboard size={18} />
        </div>
        <span className="font-serif text-lg font-semibold tracking-tight">Tool</span>
      </div>

      {/* Desktop navigation */}
      <nav className="hidden md:flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {links.map(({ to, desktopLabel, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-body transition hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated',
                isActive && 'bg-primary/15 text-primary dark:bg-primary/20',
              )
            }
          >
            <Icon size={16} />
            <span>{desktopLabel}</span>
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <AdminLink icon={Users} label="Users" to="/users" />
            <AdminLink icon={BarChart3} label="Firebase" to="/admin/firebase" />
          </>
        )}
      </nav>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Mobile quick admin shortcuts */}
        {user?.role === 'admin' && (
          <div className="flex items-center gap-1 md:hidden">
            <AdminLink icon={Users} label="" to="/users" />
            <AdminLink icon={BarChart3} label="" to="/admin/firebase" />
          </div>
        )}

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-lg p-2 text-ink-body transition-colors hover:bg-canvas-card dark:text-gray-300 dark:hover:bg-dark-elevated"
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
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-canvas-card hover:text-error dark:text-gray-400 dark:hover:bg-dark-elevated"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

export function MobileBottomNav() {
  return (
    <nav className="md:hidden shrink-0 border-t border-hairline/80 bg-canvas/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] dark:border-gray-800/80 dark:bg-dark/90">
      <div className="grid grid-cols-5 px-1 py-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition',
                isActive
                  ? 'text-primary bg-primary/10 font-semibold'
                  : 'text-ink-muted hover:text-ink dark:text-gray-400',
              )
            }
          >
            <Icon size={18} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function AdminLink({ icon: Icon, label, to }: { icon: typeof Users; label: string; to: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition hover:bg-canvas-card dark:hover:bg-dark-elevated',
          isActive && 'bg-primary/15 dark:bg-primary/20',
        )
      }
    >
      <Icon size={16} />
      {label && <span className="hidden sm:inline">{label}</span>}
    </NavLink>
  )
}

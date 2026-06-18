import { useNavigate } from 'react-router-dom'
import { Menu, Moon, Sun, LogOut, Search, NotebookPen } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useUiStore } from '@/store/uiStore'
import { useNoteStore } from '@/store/noteStore'
import { logOut } from '@/services/authService'

export default function Navbar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme, toggleSidebar } = useUiStore()
  const { search, setSearch } = useNoteStore()

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
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="rounded-md p-2 hover:bg-canvas-card dark:hover:bg-dark-elevated text-ink-body dark:text-gray-300 transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 font-serif text-lg font-normal text-ink dark:text-gray-100">
        <NotebookPen size={20} className="text-primary" />
        <span className="hidden sm:inline font-serif font-medium tracking-tight">SuperNote</span>
      </div>

      <div className="relative mx-2 flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-md border border-hairline bg-canvas-soft py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-gray-800 dark:bg-dark-elevated dark:text-gray-200 dark:focus:border-primary"
        />
      </div>

      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="rounded-md p-2 hover:bg-canvas-card dark:hover:bg-dark-elevated text-ink-body dark:text-gray-300 transition-colors"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="max-w-[140px] truncate text-sm text-ink-muted dark:text-gray-405 font-medium">
          {user?.displayName || user?.email}
        </span>
      </div>

      <button
        onClick={handleLogout}
        aria-label="Sign out"
        className="rounded-md p-2 text-ink-muted hover:bg-canvas-card hover:text-error dark:text-gray-400 dark:hover:bg-dark-elevated transition-colors"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}

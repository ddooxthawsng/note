import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useUiStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { updateDisplayName } from '@/services/authService'

export default function SettingsPage() {
  const { user } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const { theme, toggleTheme } = useUiStore()
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateDisplayName(name.trim())
      setUser(updated)
      toast.success('Profile updated')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 animate-fade-in-up">
      <h1 className="mb-6 text-3xl font-serif font-normal text-ink dark:text-gray-100 tracking-tight">Settings</h1>

      <section className="mb-6 rounded-xl border border-hairline bg-canvas-card p-5 dark:border-gray-800 dark:bg-dark-elevated">
        <h2 className="mb-4 font-serif text-[19px] font-medium text-ink dark:text-gray-100">Profile</h2>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-serif font-medium text-white shadow-sm">
            {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="text-sm text-ink-muted">{user?.email}</div>
        </div>
        <label className="mb-1 block text-sm font-medium text-ink-body">Display name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark text-ink dark:text-gray-200"
          />
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-canvas-card p-5 dark:border-gray-800 dark:bg-dark-elevated">
        <h2 className="mb-4 font-serif text-[19px] font-medium text-ink dark:text-gray-100">Appearance</h2>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-md border border-hairline bg-canvas px-4 py-2 text-sm transition hover:bg-canvas-soft dark:border-gray-800 dark:bg-dark dark:hover:bg-dark-elevated text-ink-body dark:text-gray-300"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        </button>
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useUiStore } from '@/shared/store/uiStore'
import { useAuthStore } from '@/shared/store/authStore'
import { updateDisplayName, updateGeminiApiKey } from '@/shared/services/authService'

export default function SettingsPage() {
  const { user } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const { theme, toggleTheme } = useUiStore()
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [apiKey, setApiKey] = useState(user?.geminiApiKey ?? localStorage.getItem('gemini_api_key') ?? '')

  useEffect(() => {
    setName(user?.displayName ?? '')
    setApiKey(user?.geminiApiKey ?? localStorage.getItem('gemini_api_key') ?? '')
  }, [user])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateDisplayName(name.trim())
      if (updated && user) setUser({ ...user, displayName: updated.displayName })
      toast.success('Profile updated')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveApiKey() {
    setSavingApiKey(true)
    const key = apiKey.trim()
    try {
      await updateGeminiApiKey(key)
      if (key) {
        localStorage.setItem('gemini_api_key', key)
      } else {
        localStorage.removeItem('gemini_api_key')
      }
      if (user) setUser({ ...user, geminiApiKey: key || null })
      toast.success(key ? 'Gemini API Key updated!' : 'Gemini API Key removed')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingApiKey(false)
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

      <section className="mb-6 rounded-xl border border-hairline bg-canvas-card p-5 dark:border-gray-800 dark:bg-dark-elevated">
        <h2 className="mb-4 font-serif text-[19px] font-medium text-ink dark:text-gray-100">AI Assistant</h2>
        <p className="mb-3 text-xs text-ink-muted">Enter your Google Gemini API Key to enable AI features (formatting, summarization, bulk task parsing).</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="password"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 min-w-[200px] rounded-md border border-hairline bg-canvas px-3 py-2 outline-none focus:border-primary dark:border-gray-800 dark:bg-dark text-ink dark:text-gray-200"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={savingApiKey}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:scale-95 shadow-sm"
          >
            {savingApiKey ? 'Saving...' : 'Save Key'}
          </button>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink-body transition hover:bg-canvas-soft dark:border-gray-800 dark:bg-dark dark:text-gray-300 dark:hover:bg-dark-elevated"
          >
            Get API Key
          </a>
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

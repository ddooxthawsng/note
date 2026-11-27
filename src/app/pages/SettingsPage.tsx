import { useEffect, useState } from 'react'
import { KeyRound, Lock, Mic, MicOff, Moon, ShieldCheck, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/shared/hooks/useAuth'
import { useUiStore } from '@/shared/store/uiStore'
import { useAuthStore } from '@/shared/store/authStore'
import {
  changeEmailPassword,
  getAuthProviderInfo,
  linkEmailPassword,
  saveSharedGeminiConfig,
  subscribeToSharedGeminiConfig,
  updateDisplayName,
  updateGeminiApiKey,
} from '@/shared/services/authService'

export default function SettingsPage() {
  const { user } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const { theme, toggleTheme, showMicControls, toggleMicControls } = useUiStore()
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [apiKey, setApiKey] = useState(user?.geminiApiKey ?? localStorage.getItem('gemini_api_key') ?? '')

  const [providerInfo, setProviderInfo] = useState(() => getAuthProviderInfo())
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setName(user?.displayName ?? '')
    setApiKey(user?.geminiApiKey ?? localStorage.getItem('gemini_api_key') ?? '')
    setProviderInfo(getAuthProviderInfo())
  }, [user])

  useEffect(() => {
    if (!user) return
    return subscribeToSharedGeminiConfig((sharedKey) => {
      if (sharedKey) setApiKey(sharedKey)
    })
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
    if (!isAdmin) return
    setSavingApiKey(true)
    const key = apiKey.trim()
    try {
      await saveSharedGeminiConfig(key, user?.email || user?.uid)
      await updateGeminiApiKey(key).catch(() => undefined)
      if (user) setUser({ ...user, geminiApiKey: key || null })
      toast.success(key ? 'Đã lưu Gemini API Key dùng chung cho toàn hệ thống!' : 'Đã xoá Gemini API Key dùng chung')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingApiKey(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.')
      return
    }
    setSavingPassword(true)
    try {
      if (providerInfo.hasPassword) {
        if (!currentPassword) {
          toast.error('Vui lòng nhập mật khẩu hiện tại.')
          setSavingPassword(false)
          return
        }
        await changeEmailPassword(currentPassword, newPassword)
        toast.success('Đã đổi mật khẩu email thành công!')
      } else {
        await linkEmailPassword(newPassword)
        setProviderInfo(getAuthProviderInfo())
        toast.success('Đã liên kết đăng nhập bằng Email & Mật khẩu thành công!')
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 animate-fade-in-up">
      <h1 className="mb-6 text-3xl font-serif font-normal text-ink dark:text-gray-100 tracking-tight">Settings</h1>

      <section className="mb-6 rounded-xl border border-hairline bg-canvas-card/85 backdrop-blur-md p-5 dark:border-gray-800 dark:bg-dark-elevated/85">
        <h2 className="mb-4 font-serif text-[19px] font-medium text-ink dark:text-gray-100">Profile</h2>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-serif font-medium text-white shadow-sm">
            {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink dark:text-gray-200">{user?.email}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {providerInfo.hasGoogle && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <ShieldCheck size={12} /> Google linked
                </span>
              )}
              {providerInfo.hasPassword && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                  <KeyRound size={12} /> Email/Password linked
                </span>
              )}
            </div>
          </div>
        </div>
        <label className="mb-1 block text-sm font-medium text-ink-body">Display name</label>
        <div className="flex flex-col gap-2 sm:flex-row">
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

      <section className="mb-6 rounded-xl border border-hairline bg-canvas-card/85 backdrop-blur-md p-5 dark:border-gray-800 dark:bg-dark-elevated/85">
        <div className="mb-2 flex items-center gap-2">
          <Lock size={18} className="text-primary" />
          <h2 className="font-serif text-[19px] font-medium text-ink dark:text-gray-100">
            {providerInfo.hasPassword ? 'Đổi mật khẩu Email' : 'Bổ sung đăng nhập Email & Mật khẩu'}
          </h2>
        </div>
        <p className="mb-4 text-xs text-ink-muted">
          {providerInfo.hasPassword
            ? `Bạn có thể đăng nhập bằng ${user?.email} và mật khẩu, hoặc tiếp tục dùng Google. Nhập mật khẩu hiện tại để đổi mật khẩu mới.`
            : `Bạn đang đăng nhập bằng Google (${user?.email}). Hãy đặt mật khẩu để có thể đăng nhập bằng Gmail & mật khẩu bất cứ lúc nào.`}
        </p>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          {providerInfo.hasPassword && (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-body">Mật khẩu hiện tại</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark text-ink dark:text-gray-200"
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-body">Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                autoComplete="new-password"
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark text-ink dark:text-gray-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-body">Xác nhận mật khẩu</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-primary dark:border-gray-800 dark:bg-dark text-ink dark:text-gray-200"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:scale-95 disabled:opacity-60"
          >
            {savingPassword
              ? 'Đang xử lý…'
              : providerInfo.hasPassword
                ? 'Đổi mật khẩu'
                : 'Liên kết Email & Mật khẩu'}
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-xl border border-hairline bg-canvas-card/85 backdrop-blur-md p-5 dark:border-gray-800 dark:bg-dark-elevated/85">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-serif text-[19px] font-medium text-ink dark:text-gray-100">AI Assistant (Gemini)</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Shared · Admin Config
          </span>
        </div>
        {isAdmin ? (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Admin cấu hình Google Gemini API Key dùng chung cho tất cả tài khoản (AI format, tóm tắt, tạo task thông minh).
            </p>
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
                {savingApiKey ? 'Saving...' : 'Save Shared Key'}
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
          </>
        ) : (
          <div className="rounded-lg border border-hairline bg-canvas-soft/60 px-3.5 py-2.5 text-xs text-ink-muted dark:border-gray-800 dark:bg-dark/40">
            {apiKey
              ? '✅ Gemini API Key đã được Admin cấu hình và đồng bộ dùng chung cho tài khoản của bạn.'
              : '⏳ Chưa có Gemini API Key. Vui lòng liên hệ Admin để cấu hình.'}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-hairline bg-canvas-card p-5 dark:border-gray-800 dark:bg-dark-elevated">
        <h2 className="mb-4 font-serif text-[19px] font-medium text-ink dark:text-gray-100">Appearance</h2>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-md border border-hairline bg-canvas px-4 py-2 text-sm transition hover:bg-canvas-soft dark:border-gray-800 dark:bg-dark dark:hover:bg-dark-elevated text-ink-body dark:text-gray-300"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        </button>
      </section>

      <section className="rounded-xl border border-hairline bg-canvas-card p-5 dark:border-gray-800 dark:bg-dark-elevated">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[19px] font-medium text-ink dark:text-gray-100">Voice input</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Show microphone controls in Notes and Tasks. The APK uses on-device Moonshine; the web uses browser speech recognition.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showMicControls}
            onClick={toggleMicControls}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${showMicControls ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
          >
            <span className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-transform ${showMicControls ? 'translate-x-6' : 'translate-x-1'}`}>
              {showMicControls ? <Mic size={11} /> : <MicOff size={11} />}
            </span>
          </button>
        </div>
      </section>
    </div>
  )
}

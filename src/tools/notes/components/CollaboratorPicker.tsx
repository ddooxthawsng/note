import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Shield, UserPlus, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { subscribeToApprovedUsers, type ApprovedUser } from '@/shared/services/authService'
import { useAuth } from '@/shared/hooks/useAuth'
import { cn } from '@/shared/utils/cn'

interface CollaboratorPickerProps {
  sharedWith: string[]
  canEdit: boolean
  onChange: (nextEmails: string[]) => Promise<void> | void
  emptyText?: string
}

export default function CollaboratorPicker({
  sharedWith,
  canEdit,
  onChange,
  emptyText = 'Chưa chia sẻ với tài khoản nào.',
}: CollaboratorPickerProps) {
  const { user } = useAuth()
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([])
  const [search, setSearch] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return subscribeToApprovedUsers(setApprovedUsers)
  }, [])

  const myEmail = user?.email?.trim().toLowerCase() ?? ''
  const selectableUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return approvedUsers.filter((u) => {
      if (u.email === myEmail) return false
      if (!q) return true
      return u.email.includes(q) || u.displayName.toLowerCase().includes(q)
    })
  }, [approvedUsers, myEmail, search])

  async function applyNext(next: string[]) {
    if (!canEdit || busy) return
    setBusy(true)
    try {
      await onChange(next)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleUser(email: string) {
    const normalized = email.trim().toLowerCase()
    const exists = sharedWith.includes(normalized)
    const next = exists ? sharedWith.filter((e) => e !== normalized) : [...sharedWith, normalized]
    await applyNext(next)
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    const email = manualEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      toast.error('Nhập email hợp lệ để chia sẻ.')
      return
    }
    if (email === myEmail) {
      toast.error('Không thể tự chia sẻ với chính mình.')
      return
    }
    if (sharedWith.includes(email)) {
      toast.error('Email này đã được chia sẻ.')
      return
    }
    await applyNext([...sharedWith, email])
    setManualEmail('')
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <form onSubmit={handleManualAdd} className="flex gap-2">
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="Nhập Gmail hoặc chọn bên dưới..."
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-200"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <UserPlus size={14} /> Thêm
          </button>
        </form>
      )}

      {/* Approved users directory */}
      {canEdit && (
        <div className="rounded-xl border border-hairline bg-canvas-soft/60 p-2.5 dark:border-gray-800 dark:bg-dark/40">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              <Users size={12} className="text-primary" /> Tài khoản đã duyệt ({selectableUsers.length})
            </span>
          </div>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên hoặc email..."
              className="w-full rounded-lg border border-hairline bg-canvas py-1 pl-7 pr-2.5 text-xs outline-none focus:border-primary dark:border-gray-800 dark:bg-dark dark:text-gray-200"
            />
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
            {selectableUsers.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-ink-muted">Không có tài khoản đã duyệt nào khác.</p>
            ) : (
              selectableUsers.map((u) => {
                const selected = sharedWith.includes(u.email)
                return (
                  <button
                    key={u.uid}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleToggleUser(u.email)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition',
                      selected
                        ? 'border-primary/50 bg-primary/10 text-ink dark:text-gray-100'
                        : 'border-transparent bg-canvas/80 text-ink-body hover:border-hairline dark:bg-dark-elevated/80 dark:text-gray-300',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{u.displayName}</span>
                        {u.role === 'admin' && <Shield size={11} className="shrink-0 text-primary" />}
                      </div>
                      <p className="truncate font-mono text-[11px] text-ink-muted">{u.email}</p>
                    </div>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                        selected
                          ? 'border-primary bg-primary text-white'
                          : 'border-hairline bg-canvas dark:border-gray-700 dark:bg-dark',
                      )}
                    >
                      {selected && <Check size={12} />}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Selected collaborators */}
      {sharedWith.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-ink-muted">Đang chia sẻ với ({sharedWith.length}):</p>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {sharedWith.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-mono text-primary"
              >
                {email}
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleToggleUser(email)}
                    className="ml-0.5 rounded-full hover:text-error"
                    title="Thu hồi quyền"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">{emptyText}</p>
      )}
    </div>
  )
}

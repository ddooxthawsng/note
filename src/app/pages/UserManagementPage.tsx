import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'
import { Check, X, Shield, User, Trash2, Loader2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmDialog } from '@/shared/utils/dialog'

interface UserProfileDoc {
  uid: string
  email: string | null
  displayName: string | null
  role: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfileDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({
          uid: d.id,
          ...d.data(),
        })) as UserProfileDoc[]
        setUsers(docs)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching users:', error)
        toast.error('Failed to load users list.')
        setLoading(false)
      }
    )

    return unsub
  }, [])

  async function handleUpdateStatus(uid: string, status: 'approved' | 'rejected') {
    if (!db) return
    try {
      await updateDoc(doc(db, 'users', uid), { status })
      toast.success(`User status updated to ${status}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleToggleRole(uid: string, currentRole: 'admin' | 'user') {
    if (!db) return
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const confirm = await confirmDialog(
      'Change Role',
      `Are you sure you want to change this user's role to ${newRole}?`,
      'Change'
    )
    if (!confirm) return

    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole })
      toast.success(`User role updated to ${newRole}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleDeleteUser(uid: string, email: string | null) {
    if (!db) return
    const confirm = await confirmDialog(
      'Delete User Profile',
      `Are you sure you want to delete profile for ${email || 'this user'}? This will remove their authorization record in database.`,
      'Delete'
    )
    if (!confirm) return

    try {
      await deleteDoc(doc(db, 'users', uid))
      toast.success('User deleted successfully')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] p-6 flex flex-col h-full overflow-hidden animate-fade-in-up">
      <div className="mb-6 shrink-0">
        <h1 className="flex items-center gap-2.5 text-3xl font-serif font-normal text-ink dark:text-gray-100 tracking-tight">
          <Users size={28} className="text-primary" /> User Management
        </h1>
        <p className="text-sm text-ink-muted">Approve new registrations and manage user roles.</p>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-hairline bg-canvas-card dark:border-gray-800 dark:bg-dark-elevated shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-ink-muted">
            <Users size={48} className="mb-2 opacity-30" />
            <p>No users registered yet.</p>
          </div>
        ) : (
          <div className="min-w-[800px] overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-ink-body dark:text-gray-300">
              <thead>
                <tr className="border-b border-hairline bg-canvas-soft/50 dark:border-gray-800 dark:bg-dark/20 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline dark:divide-gray-800">
                {users.map((u) => (
                  <tr
                    key={u.uid}
                    className="hover:bg-canvas-soft/30 dark:hover:bg-dark/10 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-ink dark:text-gray-100">
                      {u.displayName || 'Unnamed User'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{u.email}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleRole(u.uid, u.role)}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-hairline transition hover:border-primary/50 hover:bg-primary/5 dark:border-gray-800"
                      >
                        {u.role === 'admin' ? (
                          <>
                            <Shield size={12} className="text-primary" />
                            <span className="text-primary font-semibold">Admin</span>
                          </>
                        ) : (
                          <>
                            <User size={12} className="text-ink-muted" />
                            <span>User</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          u.status === 'approved'
                            ? 'bg-success/15 text-success'
                            : u.status === 'rejected'
                              ? 'bg-error/15 text-error'
                              : 'bg-primary/10 text-primary animate-pulse'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.status !== 'approved' && (
                          <button
                            onClick={() => handleUpdateStatus(u.uid, 'approved')}
                            title="Approve"
                            className="rounded p-1.5 text-success hover:bg-success/10 transition active:scale-90"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {u.status !== 'rejected' && (
                          <button
                            onClick={() => handleUpdateStatus(u.uid, 'rejected')}
                            title="Reject"
                            className="rounded p-1.5 text-error hover:bg-error/10 transition active:scale-90"
                          >
                            <X size={16} />
                          </button>
                        )}
                        <span className="h-4 w-px bg-hairline dark:bg-gray-800" />
                        <button
                          onClick={() => handleDeleteUser(u.uid, u.email)}
                          title="Delete Profile"
                          className="rounded p-1.5 text-ink-muted hover:bg-error/10 hover:text-error transition active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

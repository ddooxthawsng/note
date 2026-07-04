import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/hooks/useAuth'
import { logOut } from '@/shared/services/authService'
import { LogOut, ShieldAlert, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas dark:bg-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.status === 'pending' || user.status === 'rejected') {
    const isPending = user.status === 'pending'

    const handleSignOut = async () => {
      try {
        await logOut()
        toast.success('Signed out')
      } catch (e) {
        toast.error((e as Error).message)
      }
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4 dark:bg-dark">
        <div className="w-full max-w-md animate-scale-in rounded-xl border border-hairline bg-canvas-card p-6 text-center shadow-lg dark:border-gray-800 dark:bg-dark-elevated">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
            {isPending ? <Clock size={24} className="animate-pulse" /> : <ShieldAlert size={24} />}
          </div>
          
          <h2 className="mb-2 font-serif text-xl font-medium text-ink dark:text-gray-100">
            {isPending ? 'Approval Pending' : 'Access Denied'}
          </h2>
          
          <p className="mb-6 text-sm text-ink-muted leading-relaxed">
            {isPending
              ? 'Tài khoản của bạn đang chờ phê duyệt. Vui lòng liên hệ quản trị viên để được cấp quyền truy cập.'
              : 'Tài khoản của bạn đã bị từ chối truy cập. Vui lòng liên hệ quản trị viên.'}
          </p>

          <div className="flex flex-col gap-2">
            <div className="rounded-md bg-canvas-soft px-3 py-2 text-xs font-medium text-ink-body dark:bg-dark dark:text-gray-400 truncate">
              Email: {user.email}
            </div>
            
            <button
              onClick={handleSignOut}
              className="mt-2 flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-medium text-white transition hover:bg-primary-hover active:scale-95"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

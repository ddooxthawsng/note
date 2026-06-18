import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthInit, useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppLayout from '@/components/AppLayout'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import FavoritesPage from '@/pages/FavoritesPage'
import TrashPage from '@/pages/TrashPage'
import SettingsPage from '@/pages/SettingsPage'
import TasksPage from '@/pages/TasksPage'
import UserManagementPage from '@/pages/UserManagementPage'
import ShareNotePage from '@/pages/ShareNotePage'

/** Redirect already-authenticated users away from auth pages. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  useAuthInit()
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
      <Route
        path="/forgot-password"
        element={<PublicOnly><ForgotPasswordPage /></PublicOnly>}
      />
      <Route path="/share/:noteId" element={<ShareNotePage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/folder/:folderId" element={<DashboardPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/users"
          element={user?.role === 'admin' ? <UserManagementPage /> : <Navigate to="/" replace />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

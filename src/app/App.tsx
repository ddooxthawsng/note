import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuthInit, useAuth } from '@/shared/hooks/useAuth'
import ProtectedRoute from '@/shared/components/ProtectedRoute'
import AppLayout from '@/app/layout/AppLayout'
import ToolsDashboardPage from '@/app/pages/ToolsDashboardPage'
import FirebaseMonitorPage from '@/app/pages/FirebaseMonitorPage'
import SettingsPage from '@/app/pages/SettingsPage'
import UserManagementPage from '@/app/pages/UserManagementPage'
import DownloadAppPage from '@/app/pages/DownloadAppPage'
import LoginPage from '@/features/auth/pages/LoginPage'
import SignupPage from '@/features/auth/pages/SignupPage'
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage'
import NotesToolLayout from '@/tools/notes/NotesToolLayout'
import NotesPage from '@/tools/notes/pages/NotesPage'
import FavoritesPage from '@/tools/notes/pages/FavoritesPage'
import TrashPage from '@/tools/notes/pages/TrashPage'
import ShareNotePage from '@/tools/notes/pages/ShareNotePage'
import TasksPage from '@/tools/notes/tasks/pages/TasksPage'
import TelegramToolPage from '@/tools/telegram/TelegramToolPage'

/** Redirect already-authenticated users away from auth pages. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function LegacyFolderRedirect() {
  const { folderId } = useParams<{ folderId: string }>()
  return <Navigate to={`/tools/notes/folder/${folderId}`} replace />
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
        <Route path="/" element={<ToolsDashboardPage />} />
        <Route path="/tools/notes" element={<NotesToolLayout />}>
          <Route index element={<NotesPage />} />
          <Route path="folder/:folderId" element={<NotesPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="trash" element={<TrashPage />} />
        </Route>
        <Route path="/tools/telegram" element={<TelegramToolPage />} />
        <Route path="/tools/tasks" element={<Navigate to="/tools/notes/tasks" replace />} />
        <Route path="/folder/:folderId" element={<LegacyFolderRedirect />} />
        <Route path="/favorites" element={<Navigate to="/tools/notes/favorites" replace />} />
        <Route path="/tasks" element={<Navigate to="/tools/notes/tasks" replace />} />
        <Route path="/trash" element={<Navigate to="/tools/notes/trash" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/download" element={<DownloadAppPage />} />
        <Route
          path="/users"
          element={user?.role === 'admin' ? <UserManagementPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/firebase"
          element={user?.role === 'admin' ? <FirebaseMonitorPage /> : <Navigate to="/" replace />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

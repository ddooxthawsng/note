import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { useNoteStore } from '@/store/noteStore'
import { useTaskStore } from '@/store/taskStore'
import { useFolderStore } from '@/store/folderStore'
import EditorModal from './Editor/EditorModal'
import ContextMenu from './ContextMenu'
import QuickCapture from './QuickCapture'

export default function AppLayout() {
  const { user } = useAuth()
  const subscribeNotes = useNoteStore((s) => s.subscribe)
  const unsubscribeNotes = useNoteStore((s) => s.unsubscribe)
  const subscribeTasks = useTaskStore((s) => s.subscribe)
  const unsubscribeTasks = useTaskStore((s) => s.unsubscribe)
  const subscribeFolders = useFolderStore((s) => s.subscribe)
  const unsubscribeFolders = useFolderStore((s) => s.unsubscribe)

  useEffect(() => {
    if (user) {
      subscribeNotes(user.uid)
      subscribeTasks(user.uid)
      subscribeFolders(user.uid)
    }
    return () => {
      unsubscribeNotes()
      unsubscribeTasks()
      unsubscribeFolders()
    }
  }, [user, subscribeNotes, unsubscribeNotes, subscribeTasks, unsubscribeTasks, subscribeFolders, unsubscribeFolders])

  return (
    <div className="flex h-screen flex-col overflow-x-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col min-w-0">
          <Outlet />
        </main>
      </div>
      <EditorModal />
      <ContextMenu />
      <QuickCapture />
    </div>
  )
}

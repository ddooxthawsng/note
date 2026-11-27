import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ThreeBackground from '@/shared/components/ThreeBackground'
import { useAuth } from '@/shared/hooks/useAuth'
import { subscribeToSharedGeminiConfig } from '@/shared/services/authService'
import { subscribeToSharedTelegramConfig } from '@/tools/telegram/telegramApi'

export default function AppLayout() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const unsubTele = subscribeToSharedTelegramConfig()
    const unsubGemini = subscribeToSharedGeminiConfig()
    return () => {
      unsubTele()
      unsubGemini()
    }
  }, [user])

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-x-hidden">
      <ThreeBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Navbar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

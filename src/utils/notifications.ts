import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

/** Generates a unique 32-bit integer hash from string ID. */
function stringToHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

export async function scheduleTaskNotification(id: string, title: string, dueDateStr: string | null) {
  if (!dueDateStr || !Capacitor.isNativePlatform()) return

  try {
    const dueTime = new Date(dueDateStr).getTime()
    const now = Date.now()

    if (dueTime > now) {
      const status = await LocalNotifications.requestPermissions()
      if (status.display === 'granted') {
        const numericId = stringToHash(id)
        await LocalNotifications.schedule({
          notifications: [
            {
              id: numericId,
              title: 'Task Due: ' + title,
              body: 'Your task is due now!',
              schedule: { at: new Date(dueTime) },
              sound: 'default',
            },
          ],
        })
      }
    }
  } catch (err) {
    console.error('Failed to schedule local notification:', err)
  }
}

export async function cancelTaskNotification(id: string) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const numericId = stringToHash(id)
    await LocalNotifications.cancel({
      notifications: [{ id: numericId }],
    })
  } catch (err) {
    console.error('Failed to cancel local notification:', err)
  }
}

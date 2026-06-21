import { Capacitor } from '@capacitor/core'

/**
 * Native push-notification registration for the iOS shell. No-ops on web and
 * is fully dynamic-imported so the plugin never enters the browser bundle.
 *
 * Flow: ask the OS for permission → register with APNs → POST the returned
 * device token to /api/push/register (stored per-user, migration 0010). When a
 * notification carrying a `path` is tapped, route to it in-app.
 *
 * Returns a cleanup function that removes the listeners.
 */
export async function registerPush(navigate: (path: string) => void): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {}

  let removed = false
  const removers: Array<() => void> = []

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const perm = await PushNotifications.checkPermissions()
    let granted = perm.receive === 'granted'
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      const req = await PushNotifications.requestPermissions()
      granted = req.receive === 'granted'
    }
    if (!granted) return () => {}

    const regHandle = await PushNotifications.addListener('registration', (token) => {
      void fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value, platform: 'ios' }),
      }).catch(() => { /* best-effort; retried next launch */ })
    })
    removers.push(() => { void regHandle.remove() })

    const errHandle = await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] registration error', err)
    })
    removers.push(() => { void errHandle.remove() })

    // Tapping a notification with a deep-link path routes in-app.
    const tapHandle = await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        const path = action.notification?.data?.path
        if (typeof path === 'string' && path.startsWith('/')) navigate(path)
      },
    )
    removers.push(() => { void tapHandle.remove() })

    await PushNotifications.register()
  } catch (err) {
    console.warn('[push] registration failed', err)
  }

  // If cleanup ran before the awaits resolved, tear down immediately.
  if (removed) removers.forEach((fn) => fn())
  return () => { removed = true; removers.forEach((fn) => fn()) }
}

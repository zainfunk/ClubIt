'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { registerPush } from '@/lib/push-client'

/**
 * Native runtime setup for the Capacitor iOS shell. Renders nothing on web.
 *
 * This is part of making ClubIt behave like a real app rather than a wrapped
 * website (App Store Guideline 4.2): it configures the status bar, hides the
 * native splash once the web layer is ready, makes the keyboard resize the
 * view, handles the hardware/back gesture, and routes deep links (e.g. a
 * scanned attendance QR or a notification tap) into in-app navigation instead
 * of a full page reload.
 *
 * All plugins are dynamically imported and only touched on a native platform,
 * so nothing ships to or runs in the browser build.
 */
export default function NativeBootstrap() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const cleanups: Array<() => void> = []

    // Hide the native splash as the VERY FIRST thing once the web layer mounts,
    // independent of the other plugin imports below — so a slow status-bar /
    // keyboard import can't strand the user on the indigo splash (launchAutoHide
    // is false in capacitor.config.ts). A timeout backstop force-hides it even
    // if this import is itself slow.
    let splashHidden = false
    const hideSplash = () => {
      if (splashHidden) return
      splashHidden = true
      import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}))
        .catch(() => {})
    }
    hideSplash()
    const splashTimer = setTimeout(hideSplash, 4000)
    cleanups.push(() => clearTimeout(splashTimer))

    ;(async () => {
      const [{ StatusBar, Style }, { Keyboard, KeyboardResize }, { App }] =
        await Promise.all([
          import('@capacitor/status-bar'),
          import('@capacitor/keyboard'),
          import('@capacitor/app'),
        ])

      // Status bar: dark icons on our light background.
      try {
        await StatusBar.setStyle({ style: Style.Light })
      } catch { /* not fatal */ }

      // Keyboard pushes content up instead of overlaying it.
      try {
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native })
      } catch { /* not fatal */ }

      // Hardware/edge back gesture: navigate back within the app, or stay put
      // at the root rather than killing the app from inside a view.
      const backHandle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
      })
      cleanups.push(() => { void backHandle.remove() })

      // Deep links (custom scheme / universal links): strip the origin and do
      // an in-app client navigation so a scanned QR opens without a reload.
      const urlHandle = await App.addListener('appUrlOpen', async ({ url }) => {
        try {
          const parsed = new URL(url)
          // Clerk native OAuth return:
          //   com.clubit.app://sso-callback?rotating_token_nonce=...
          // For a custom scheme the route lands in `host`, not `pathname`. Close
          // the in-app browser sheet, then hand the query (which carries the
          // nonce) to /sso-callback so the webview's Clerk client finishes
          // sign-in. Must come BEFORE the generic deep-link handling below.
          if (parsed.host === 'sso-callback' || url.includes('sso-callback')) {
            try {
              const { Browser } = await import('@capacitor/browser')
              await Browser.close()
            } catch { /* sheet may already be dismissed */ }
            router.push(`/sso-callback${parsed.search}`)
            return
          }
          const path = `${parsed.pathname}${parsed.search}`
          if (path && path !== '/') router.push(path)
        } catch { /* ignore malformed deep links */ }
      })
      cleanups.push(() => { void urlHandle.remove() })

      // Push notifications: request permission, register the APNs token with the
      // server, and route deep links on tap. Dormant on the server side until
      // the APNs key is configured (lib/push-send.ts), but registration is safe
      // to run now so tokens are already collected when sending goes live.
      const pushCleanup = await registerPush((path) => router.push(path))
      cleanups.push(pushCleanup)
    })()

    return () => { cleanups.forEach((fn) => fn()) }
  }, [router])

  return null
}

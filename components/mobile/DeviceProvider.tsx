'use client'

// Phone vs desktop, decided once server-side (from the user-agent) and refined
// on the client with a viewport media query. Seeding from the server value means
// the native app and mobile browsers render the right shell on first paint — no
// hydration flash — while a resized desktop window still flips correctly.

import { createContext, useContext, useEffect, useState } from 'react'

const PHONE_QUERY = '(max-width: 767px)'

const DeviceContext = createContext<boolean>(false)

export function DeviceProvider({
  initialIsPhone,
  children,
}: {
  initialIsPhone: boolean
  children: React.ReactNode
}) {
  const [isPhone, setIsPhone] = useState(initialIsPhone)

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    // Native app is always phone-class even if the WebView reports a wide viewport.
    const isNative =
      typeof navigator !== 'undefined' && navigator.userAgent.includes('ClubItNativeApp')
    const update = () => setIsPhone(isNative || mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return <DeviceContext.Provider value={isPhone}>{children}</DeviceContext.Provider>
}

export function useIsPhone(): boolean {
  return useContext(DeviceContext)
}

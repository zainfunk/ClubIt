'use client'

import { useEffect, useState } from 'react'
import { isNativeUserAgent } from '@/lib/platform'

/**
 * Client hook: true when running inside the Capacitor iOS shell.
 *
 * Returns `false` on the first render (SSR + hydration) and flips to the real
 * value after mount, so it never causes a hydration mismatch. Detection uses
 * the appended user-agent token (no @capacitor/core import needed), which is
 * present in the WKWebView UA on every native render.
 *
 * Use this to hide Apple-disallowed Stripe purchase UI on iOS (Guideline 3.1.1).
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    setIsNative(isNativeUserAgent(navigator.userAgent))
  }, [])
  return isNative
}

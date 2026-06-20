'use client'

// Lightweight toast matching the design (dark pill, green check, bottom-center,
// auto-dismiss). Exposed via useToast() so any mobile screen can fire one.

import { createContext, useContext, useEffect, useState } from 'react'
import { css, BOTTOM } from './css'

type ToastFn = (msg: string) => void
const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)
  const [n, setN] = useState(0)

  const show: ToastFn = (msg) => {
    setToast(msg)
    setN((x) => x + 1)
  }

  useEffect(() => {
    if (toast === null) return
    const id = setTimeout(() => setToast(null), 1900)
    return () => clearTimeout(id)
  }, [toast, n])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          style={{
            ...css(
              'position:fixed;left:50%;transform:translateX(-50%);z-index:200;background:#0f1729;color:#fff;font-size:13px;font-weight:600;padding:11px 18px;border-radius:14px;box-shadow:0 10px 26px rgba(15,23,41,.32);max-width:88%;animation:toastIn .26s cubic-bezier(.32,.72,0,1);display:flex;align-items:center;gap:8px;'
            ),
            bottom: `calc(${BOTTOM(0)} + 96px)`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFn {
  return useContext(ToastContext)
}

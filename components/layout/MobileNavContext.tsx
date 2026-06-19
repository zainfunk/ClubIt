'use client'

import { createContext, useContext, useState } from 'react'

// Shared open/close state for the mobile navigation drawer. The drawer markup
// lives in Navbar (already styled, with every nav item + sign out); the opener
// lives in the MobileTabBar "More" tab. Without this, the drawer had no trigger
// on mobile and Events / Elections / Leaderboard were unreachable.
type MobileNavState = {
  open: boolean
  setOpen: (open: boolean) => void
}

const MobileNavCtx = createContext<MobileNavState | null>(null)

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <MobileNavCtx.Provider value={{ open, setOpen }}>{children}</MobileNavCtx.Provider>
}

export function useMobileNav() {
  const ctx = useContext(MobileNavCtx)
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider')
  return ctx
}

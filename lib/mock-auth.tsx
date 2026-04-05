'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { User } from '@/types'
import { USERS } from '@/lib/mock-data'

const DEFAULT_USER = USERS.find((u) => u.role === 'student')!

interface MockAuthContextValue {
  currentUser: User
  setCurrentUser: (user: User) => void
  logout: () => void
}

const MockAuthContext = createContext<MockAuthContextValue | null>(null)

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER)

  return (
    <MockAuthContext.Provider
      value={{ currentUser, setCurrentUser, logout: () => setCurrentUser(DEFAULT_USER) }}
    >
      {children}
    </MockAuthContext.Provider>
  )
}

export function useMockAuth(): MockAuthContextValue {
  const ctx = useContext(MockAuthContext)
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider')
  return ctx
}

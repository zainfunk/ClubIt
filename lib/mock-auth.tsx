'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { User, Role } from '@/types'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  currentUser: User
  devRole: Role | null
  setDevRole: (role: Role | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LOADING_USER: User = { id: '', name: 'Loading...', email: '', role: 'student' }

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser()
  const [baseUser, setBaseUser] = useState<User>(LOADING_USER)
  const [devRole, setDevRole] = useState<Role | null>(null)

  useEffect(() => {
    if (!isLoaded || !clerkUser) return

    const id = clerkUser.id
    const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''

    // Ensure this user exists in Supabase (insert only, don't overwrite existing role)
    supabase.from('users').upsert(
      { id, name, email, role: 'student' },
      { onConflict: 'id', ignoreDuplicates: true }
    ).then(() => {
      // Fetch their stored role
      supabase.from('users').select('role').eq('id', id).maybeSingle().then(({ data }) => {
        setBaseUser({ id, name, email, role: (data?.role as Role) ?? 'student' })
      })
    })
  }, [isLoaded, clerkUser?.id])

  // devRole overrides the role for UI/permission testing only.
  // currentUser.id is always the real Clerk user — data always saves to your account.
  const currentUser: User = devRole
    ? { ...baseUser, role: devRole }
    : baseUser

  return (
    <AuthContext.Provider value={{ currentUser, devRole, setDevRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useMockAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider')
  return ctx
}

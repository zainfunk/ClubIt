'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import Avatar from '@/components/Avatar'
import { AlertTriangle, CheckCircle, Clock, MapPin, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { haptic } from '@/lib/haptics'

type Status =
  | 'loading'
  | 'idle'
  | 'checking'
  | 'success'
  | 'expired'
  | 'already'
  | 'distance'
  | 'no-session'
  | 'location-error'
  | 'forbidden'

interface AttendData {
  session: {
    id: string
    clubId: string
    meetingDate: string
    expiresAt: string
    maxDistanceMeters: number
    requiresLocation: boolean
  }
  club: { id: string; name: string; iconUrl: string | null } | null
  canCheckIn: boolean
  alreadyRecorded: boolean
}

function AttendContent() {
  const { currentUser } = useMockAuth()
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''

  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<AttendData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const autoFiredRef = useRef(false)

  // Load the session + eligibility from the server (service-role; not blocked by
  // RLS the way the old client read was — that's what showed "Invalid Link").
  useEffect(() => {
    if (!token) {
      setNotFound(true)
      return
    }
    let cancelled = false
    fetch(`/api/attend/${token}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setSubmitError('Could not load this attendance link. Please try again.')
          setStatus('idle')
          return
        }
        const json = (await res.json()) as AttendData
        if (cancelled) return
        setData(json)
        setStatus(json.alreadyRecorded ? 'already' : 'idle')
      })
      .catch(() => {
        if (!cancelled) {
          setSubmitError('Could not load this attendance link. Please try again.')
          setStatus('idle')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const checkIn = useCallback(async () => {
    if (!data) return
    if (!data.canCheckIn) {
      setStatus('forbidden')
      return
    }
    if (new Date() > new Date(data.session.expiresAt)) {
      setStatus('expired')
      return
    }
    if (data.alreadyRecorded) {
      setStatus('already')
      return
    }

    setSubmitError(null)
    setStatus('checking')

    let coords: { lat: number; lng: number } | null = null
    if (data.session.requiresLocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
        )
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch {
        setStatus('location-error')
        return
      }
    }

    try {
      const res = await fetch(`/api/attend/${token}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coords ?? {}),
      })
      const json = (await res.json().catch(() => null)) as { status?: Status; distanceM?: number } | null
      if (!json?.status) {
        setSubmitError('Something went wrong. Please try again.')
        setStatus('idle')
        return
      }
      if (typeof json.distanceM === 'number') setDistanceM(json.distanceM)
      setStatus(json.status)
      if (json.status === 'success') void haptic('success')
    } catch {
      setSubmitError('Network error. Please try again.')
      setStatus('idle')
    }
  }, [data, token])

  // Auto-fire check-in as soon as the student is eligible. The page is reached by
  // scanning the advisor's QR, so there's no reason to wait for a tap. Full gating
  // still runs server-side. Guarded so it only fires once per mount.
  useEffect(() => {
    if (autoFiredRef.current) return
    if (!data || !data.canCheckIn || data.alreadyRecorded) return
    if (status !== 'idle') return
    autoFiredRef.current = true
    void checkIn()
  }, [data, status, checkIn])

  // Missing/invalid token, or the server couldn't find the session.
  if (!token || notFound) {
    return (
      <div className="text-center py-20">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
        <p className="text-gray-500 mb-6">This attendance link is not valid or has been deleted.</p>
        <Link href="/" className="text-blue-600 hover:underline">Go home</Link>
      </div>
    )
  }

  if (status === 'loading' || !data) {
    return <div className="text-center py-20 text-gray-400">Loading…</div>
  }

  const { session, club } = data
  const expiresAt = new Date(session.expiresAt)
  const isExpired = new Date() > expiresAt

  return (
    <div className="max-w-sm mx-auto py-12">
      <div className="bg-white rounded-2xl border p-8 text-center shadow-sm">
        <div className="mb-6">
          <span className="text-5xl">{club?.iconUrl ?? '📌'}</span>
          <h1 className="text-xl font-bold text-gray-900 mt-3">{club?.name ?? 'Club'}</h1>
          <p className="text-sm text-gray-500 mt-1">Attendance check-in</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {session.meetingDate}
            </span>
            {session.maxDistanceMeters > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Within {session.maxDistanceMeters}m
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 justify-center mb-4 p-3 bg-gray-50 rounded-xl">
          <Avatar name={currentUser.name} size="sm" />
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-xs text-gray-400 capitalize">{currentUser.role}</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-6">
          Not you? Use the user selector in the top bar to switch accounts.
        </p>

        {status === 'success' && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-800">Successfully checked in</p>
            <p className="text-sm text-green-600 mt-1">{session.meetingDate}</p>
          </div>
        )}

        {/* Full-screen celebratory overlay on first success */}
        <AnimatePresence>
          {status === 'success' && (
            <motion.div
              key="attend-success-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-emerald-500/95 to-emerald-700/95 backdrop-blur-sm px-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.05 }}
                  className="mx-auto mb-6 inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-2xl"
                >
                  <CheckCircle className="w-20 h-20 text-emerald-500" strokeWidth={2.5} />
                </motion.div>
                {/* Radiating sparkle dots */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <motion.span
                      key={deg}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0.6],
                        x: Math.cos((deg * Math.PI) / 180) * 110,
                        y: Math.sin((deg * Math.PI) / 180) * 110,
                      }}
                      transition={{ duration: 0.9, delay: 0.2 + i * 0.04, ease: 'easeOut' }}
                      className="absolute h-3 w-3 rounded-full bg-white"
                    />
                  ))}
                </div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-3xl font-extrabold text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
                >
                  Successfully checked in
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 text-base text-white/90 font-medium"
                >
                  {club?.name ?? 'Club'} · {session.meetingDate}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                  className="mt-8"
                >
                  <Link
                    href="/"
                    className="inline-block bg-white text-emerald-700 font-bold text-sm rounded-full px-6 py-3 shadow-lg active:translate-y-px"
                  >
                    Done
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'already' && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <CheckCircle className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="font-semibold text-blue-800">Already checked in</p>
            <p className="text-sm text-blue-600 mt-1">
              Your attendance for {session.meetingDate} is already recorded.
            </p>
          </div>
        )}

        {/* Full-screen overlay when a student re-scans after already checking in. */}
        <AnimatePresence>
          {status === 'already' && (
            <motion.div
              key="attend-already-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-sky-500/95 to-blue-700/95 backdrop-blur-sm px-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.05 }}
                  className="mx-auto mb-6 inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-2xl"
                >
                  <CheckCircle className="w-20 h-20 text-blue-500" strokeWidth={2.5} />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-extrabold text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
                >
                  Already checked in
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-2 text-base text-white/90 font-medium"
                >
                  You scanned in earlier for {session.meetingDate}.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mt-8"
                >
                  <Link
                    href="/"
                    className="inline-block bg-white text-blue-700 font-bold text-sm rounded-full px-6 py-3 shadow-lg active:translate-y-px"
                  >
                    Done
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(status === 'expired' || isExpired) && status !== 'success' && status !== 'already' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-800">Link expired</p>
            <p className="text-sm text-red-600 mt-1">
              This check-in link expired at {expiresAt.toLocaleTimeString()}.
            </p>
          </div>
        )}

        {status === 'distance' && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-semibold text-amber-800">Too far away</p>
            <p className="text-sm text-amber-600 mt-1">
              You are {distanceM}m away. Must be within {session.maxDistanceMeters}m to check in.
            </p>
          </div>
        )}

        {status === 'location-error' && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <MapPin className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-semibold text-amber-800">Location required</p>
            <p className="text-sm text-amber-600 mt-1">
              This check-in requires location access. Please allow location and try again.
            </p>
          </div>
        )}

        {status === 'forbidden' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-800">You cannot check in to this club</p>
            <p className="text-sm text-red-600 mt-1">
              This attendance link only works for members, the club advisor, or school admins in the same school.
            </p>
          </div>
        )}

        {status === 'no-session' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-800">Session not found</p>
          </div>
        )}

        {submitError && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{submitError}</p>
        )}

        {!isExpired && status !== 'success' && status !== 'already' && (
          <p className="text-xs text-gray-400 mb-4">
            Expires at {expiresAt.toLocaleTimeString()}
          </p>
        )}

        {status !== 'success' && status !== 'already' && !isExpired && (
          <Button className="w-full" onClick={checkIn} disabled={status === 'checking'}>
            {status === 'checking' ? 'Checking…' : 'Mark me present'}
          </Button>
        )}

        <div className="mt-4">
          <Link href="/" className="text-xs text-blue-600 hover:underline">Back to home</Link>
        </div>
      </div>
    </div>
  )
}

export default function AttendPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">Loading...</div>}>
      <AttendContent />
    </Suspense>
  )
}

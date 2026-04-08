'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { getSessionById, haversineMeters, markSessionCheckin, upsertRecord } from '@/lib/attendance-store'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import { AlertTriangle, CheckCircle, Clock, MapPin, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Status =
  | 'idle'
  | 'checking'
  | 'success'
  | 'expired'
  | 'already'
  | 'distance'
  | 'no-session'
  | 'location-error'
  | 'forbidden'

function AttendContent() {
  const { currentUser } = useMockAuth()
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''

  const [status, setStatus] = useState<Status>('idle')
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSessionById>> | null | undefined>(undefined)
  const [club, setClub] = useState<{ id: string; name: string; icon_url?: string | null; school_id?: string | null; advisor_id?: string | null } | null>(null)
  const [canCheckIn, setCanCheckIn] = useState(false)

  useEffect(() => {
    getSessionById(token).then(setSession)
  }, [token])

  useEffect(() => {
    if (!session || !currentUser.id || !currentUser.schoolId) return

    let cancelled = false

    Promise.all([
      supabase
        .from('clubs')
        .select('id, name, icon_url, school_id, advisor_id')
        .eq('id', session.clubId)
        .maybeSingle(),
      supabase
        .from('memberships')
        .select('user_id')
        .eq('club_id', session.clubId)
        .eq('user_id', currentUser.id)
        .maybeSingle(),
    ]).then(([clubRes, membershipRes]) => {
      if (cancelled) return

      setClub(clubRes.data ?? null)

      const sameSchool = clubRes.data?.school_id === currentUser.schoolId
      const isAdvisor = clubRes.data?.advisor_id === currentUser.id
      const isMember = Boolean(membershipRes.data)
      const isAdmin = currentUser.role === 'admin'

      setCanCheckIn(Boolean(sameSchool && (isAdmin || isAdvisor || isMember)))
    })

    return () => {
      cancelled = true
    }
  }, [currentUser.id, currentUser.role, currentUser.schoolId, session])

  async function checkIn() {
    if (!session) {
      setStatus('no-session')
      return
    }

    if (!canCheckIn) {
      setStatus('forbidden')
      return
    }

    if (new Date() > new Date(session.expiresAt)) {
      setStatus('expired')
      return
    }

    if (session.recordedUserIds.includes(currentUser.id)) {
      setStatus('already')
      return
    }

    setStatus('checking')

    if (session.maxDistanceMeters > 0 && session.advisorLat !== undefined && session.advisorLng !== undefined) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        )
        const dist = haversineMeters(
          session.advisorLat,
          session.advisorLng,
          pos.coords.latitude,
          pos.coords.longitude
        )
        setDistanceM(Math.round(dist))
        if (dist > session.maxDistanceMeters) {
          setStatus('distance')
          return
        }
      } catch {
        setStatus('location-error')
        return
      }
    }

    await upsertRecord(session.clubId, currentUser.id, session.meetingDate, true)
    await markSessionCheckin(token, currentUser.id)
    setStatus('success')
  }

  if (!token || !session) {
    return (
      <div className="text-center py-20">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
        <p className="text-gray-500 mb-6">This attendance link is not valid or has been deleted.</p>
        <Link href="/" className="text-blue-600 hover:underline">Go home</Link>
      </div>
    )
  }

  const expiresAt = new Date(session.expiresAt)
  const isExpired = new Date() > expiresAt

  return (
    <div className="max-w-sm mx-auto py-12">
      <div className="bg-white rounded-2xl border p-8 text-center shadow-sm">
        <div className="mb-6">
          <span className="text-5xl">{club?.icon_url ?? '📌'}</span>
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
            <p className="font-semibold text-green-800">Attendance recorded!</p>
            <p className="text-sm text-green-600 mt-1">{session.meetingDate}</p>
          </div>
        )}

        {status === 'already' && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <CheckCircle className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="font-semibold text-blue-800">Already checked in</p>
            <p className="text-sm text-blue-600 mt-1">
              Your attendance for {session.meetingDate} is already recorded.
            </p>
          </div>
        )}

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

        {!isExpired && status !== 'success' && status !== 'already' && (
          <p className="text-xs text-gray-400 mb-4">
            Expires at {expiresAt.toLocaleTimeString()}
          </p>
        )}

        {status !== 'success' && status !== 'already' && !isExpired && (
          <Button
            className="w-full"
            onClick={checkIn}
            disabled={status === 'checking'}
          >
            {status === 'checking' ? 'Checking location...' : 'Mark me present'}
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

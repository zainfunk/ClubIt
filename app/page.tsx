'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GraduationCap, Users, Calendar, Shield } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="text-center py-20 max-w-2xl mx-auto">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-100 rounded-2xl">
            <GraduationCap className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Smarter club selection for your school
        </h1>
        <p className="text-lg text-gray-500 mb-8 leading-relaxed">
          Browse clubs, sign up instantly, track your attendance, and stay on top of events — all in one place.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/clubs" className={cn(buttonVariants({ size: 'lg' }))}>
            Browse Clubs
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
            My Dashboard
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl pb-20">
        <div className="bg-white rounded-xl p-5 border text-center">
          <Users className="w-6 h-6 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Easy Sign-Ups</h3>
          <p className="text-sm text-gray-500">Join clubs in seconds. Capacity is tracked automatically.</p>
        </div>
        <div className="bg-white rounded-xl p-5 border text-center">
          <Calendar className="w-6 h-6 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Events & Meetings</h3>
          <p className="text-sm text-gray-500">Stay up to date with club events and meeting schedules.</p>
        </div>
        <div className="bg-white rounded-xl p-5 border text-center">
          <Shield className="w-6 h-6 text-purple-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Role-Based Access</h3>
          <p className="text-sm text-gray-500">Admins, advisors, and students each have the right tools.</p>
        </div>
      </section>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ContactForm from '@/components/contact/ContactForm'
import { isNativeUserAgent } from '@/lib/platform'

export const metadata: Metadata = {
  title: 'Contact — ClubIt',
  description: 'Get in touch to bring ClubIt to your school.',
}

// Public "contact sales" page. ClubIt is billed per student, so prospective
// schools reach out here to get a quote instead of self-serve checkout.
// Mirrors /landing: never shown inside the iOS app (Apple Guideline 3.1.1 / 4.2).
export default async function ContactPage() {
  if (isNativeUserAgent((await headers()).get('user-agent'))) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Decorative background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full bg-gradient-to-br from-indigo-100 via-emerald-50 to-transparent blur-3xl opacity-70" />
      </div>

      <header className="max-w-3xl mx-auto px-6 lg:px-8 pt-8">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <img src="/clubit-logo.png" alt="ClubIt" className="w-10 h-10 rounded-xl object-contain group-hover:scale-105 transition-transform" />
          <span className="text-lg font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
            ClubIt
          </span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="max-w-xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 mb-4">
            Get in touch
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
            Bring ClubIt to your school.
          </h1>
          <p className="text-lg text-slate-600">
            Tell us about your school and district, and our team will reach out within the next week
            to get you set up — billed simply at
            {' '}<span className="font-semibold text-slate-900">$1.50 per student, per year</span>. Purchase orders welcome.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <ContactForm />
        </div>
      </main>
    </div>
  )
}

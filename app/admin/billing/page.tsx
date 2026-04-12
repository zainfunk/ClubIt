'use client'

import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import RoleGuard from '@/components/layout/RoleGuard'
import { CreditCard, ExternalLink, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, Sparkles } from 'lucide-react'

interface Subscription {
  plan: 'monthly' | 'yearly'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
  trialEndsAt?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
}

interface PaymentEventRow {
  id: string
  eventType: string
  amountCents: number | null
  currency: string
  status: string
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  trialing:  { label: 'Free Trial', bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: <Clock className="w-3 h-3" /> },
  active:    { label: 'Active',     bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle className="w-3 h-3" /> },
  past_due:  { label: 'Past Due',   bg: 'bg-amber-50',   text: 'text-amber-700',   icon: <AlertTriangle className="w-3 h-3" /> },
  canceled:  { label: 'Canceled',   bg: 'bg-rose-50',    text: 'text-rose-700',    icon: <XCircle className="w-3 h-3" /> },
  unpaid:    { label: 'Unpaid',     bg: 'bg-rose-50',    text: 'text-rose-700',    icon: <XCircle className="w-3 h-3" /> },
  paused:    { label: 'Paused',     bg: 'bg-amber-50',   text: 'text-amber-700',   icon: <AlertTriangle className="w-3 h-3" /> },
}

export default function BillingPage() {
  const { actualUser } = useMockAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [events, setEvents] = useState<PaymentEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/school/billing')
      .then((r) => r.json())
      .then((data) => {
        setSubscription(data.subscription)
        setEvents(data.paymentEvents ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout(plan: 'monthly' | 'yearly') {
    setActionLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePortal() {
    setActionLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Portal error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(iso?: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function daysUntil(iso?: string) {
    if (!iso) return 0
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
  }

  function formatAmount(cents: number | null) {
    if (cents == null) return '—'
    return `$${(cents / 100).toFixed(2)}`
  }

  const content = (
    <div className="max-w-2xl mx-auto space-y-5" style={{ fontFamily: 'var(--font-inter)' }}>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : !subscription ? (
        /* No subscription — plan picker */
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Choose a Plan</h2>
            <p className="text-sm text-slate-500 mt-1">Start with a 30-day free trial. No card required.</p>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            {/* Monthly */}
            <div className="rounded-xl border border-slate-200 p-5 space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Monthly</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>$50</span>
                  <span className="text-sm text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">$600/year. Cancel anytime.</p>
              </div>
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={!!actionLoading}
                className="w-full h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                {actionLoading === 'monthly' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Start Free Trial'}
              </button>
            </div>

            {/* Yearly */}
            <div className="rounded-xl border-2 border-indigo-500 p-5 space-y-4 relative">
              <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-gradient-to-r from-indigo-600 to-emerald-500 text-white text-[10px] font-bold uppercase rounded-full shadow-sm">
                Save $100
              </span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Yearly</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>$500</span>
                  <span className="text-sm text-slate-400">/ year</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">$41.67/month equivalent.</p>
              </div>
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={!!actionLoading}
                className="w-full h-9 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm transition disabled:opacity-50"
              >
                {actionLoading === 'yearly' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Start Free Trial'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Has subscription */
        <>
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><CreditCard className="w-4 h-4 text-slate-600" /></div>
                <h2 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Subscription</h2>
              </div>
              {(() => {
                const cfg = STATUS_CONFIG[subscription.status]
                return cfg ? (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.icon}{cfg.label}
                  </span>
                ) : null
              })()}
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Plan</div>
                  <div className="font-semibold text-slate-900 capitalize">{subscription.plan} — {subscription.plan === 'yearly' ? '$500/yr' : '$50/mo'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Next billing</div>
                  <div className="font-medium text-sm text-slate-900">
                    {subscription.cancelAtPeriodEnd ? 'Cancels' : formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
              </div>

              {subscription.status === 'trialing' && subscription.trialEndsAt && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 text-sm text-indigo-800">
                  Trial ends in <span className="font-bold">{daysUntil(subscription.trialEndsAt)} days</span> ({formatDate(subscription.trialEndsAt)}).
                </div>
              )}

              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-sm text-amber-800">
                  Cancels at end of period ({formatDate(subscription.currentPeriodEnd)}).
                </div>
              )}

              {(subscription.status === 'past_due' || subscription.status === 'unpaid') && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-4 py-2.5 text-sm text-rose-800">
                  Payment failed. Update your payment method to avoid interruption.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Current period</div>
                  <div className="font-medium text-slate-700">{formatDate(subscription.currentPeriodStart)} — {formatDate(subscription.currentPeriodEnd)}</div>
                </div>
              </div>

              <button
                onClick={handlePortal}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                {actionLoading === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ExternalLink className="w-3.5 h-3.5" />Manage Billing</>}
              </button>
            </div>
          </div>

          {/* Payment History */}
          {events.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Payment History</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="px-5 py-2.5 text-left">Date</th>
                    <th className="px-5 py-2.5 text-left">Event</th>
                    <th className="px-5 py-2.5 text-left">Amount</th>
                    <th className="px-5 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-2.5 text-slate-700">{formatDate(e.createdAt)}</td>
                      <td className="px-5 py-2.5 text-slate-600">{e.eventType.replace(/_/g, ' ').replace(/\./g, ' ')}</td>
                      <td className="px-5 py-2.5 text-slate-700 font-medium">{formatAmount(e.amountCents)}</td>
                      <td className="px-5 py-2.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          e.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' :
                          e.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <RoleGuard allowed={['admin']}>
      {content}
    </RoleGuard>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import RoleGuard from '@/components/layout/RoleGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, ExternalLink, Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

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

const STATUS_STYLES: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  trialing: { label: 'Free Trial', class: 'bg-blue-50 text-blue-700', icon: <Clock className="w-3 h-3" /> },
  active: { label: 'Active', class: 'bg-green-50 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
  past_due: { label: 'Past Due', class: 'bg-amber-50 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> },
  canceled: { label: 'Canceled', class: 'bg-red-50 text-red-700', icon: <XCircle className="w-3 h-3" /> },
  unpaid: { label: 'Unpaid', class: 'bg-red-50 text-red-700', icon: <XCircle className="w-3 h-3" /> },
  paused: { label: 'Paused', class: 'bg-orange-50 text-orange-700', icon: <AlertTriangle className="w-3 h-3" /> },
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
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function daysUntil(iso?: string) {
    if (!iso) return 0
    const diff = new Date(iso).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  function formatAmount(cents: number | null) {
    if (cents == null) return '—'
    return `$${(cents / 100).toFixed(2)}`
  }

  const content = (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your school's subscription and payment history.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !subscription ? (
        /* No subscription — show plan options */
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Choose a Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-6">
                Start with a 30-day free trial. No credit card required until the trial ends.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Monthly */}
                <div className="rounded-xl border border-gray-200 p-6 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Monthly</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-extrabold">$50</span>
                      <span className="text-gray-500">/ month</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">$600/year. Cancel anytime.</p>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleCheckout('monthly')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'monthly' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Start Free Trial'
                    )}
                  </Button>
                </div>

                {/* Yearly */}
                <div className="rounded-xl border-2 border-indigo-500 p-6 space-y-4 relative">
                  <span className="absolute -top-3 left-4 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-full">
                    Save $100/year
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Yearly</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-extrabold">$500</span>
                      <span className="text-gray-500">/ year</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">$41.67/month equivalent.</p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleCheckout('yearly')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'yearly' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Start Free Trial'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Has subscription — show status */
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Plan</div>
                  <div className="font-semibold capitalize">{subscription.plan} — {subscription.plan === 'yearly' ? '$500/year' : '$50/month'}</div>
                </div>
                <Badge className={STATUS_STYLES[subscription.status]?.class ?? 'bg-gray-100 text-gray-700'}>
                  <span className="flex items-center gap-1">
                    {STATUS_STYLES[subscription.status]?.icon}
                    {STATUS_STYLES[subscription.status]?.label ?? subscription.status}
                  </span>
                </Badge>
              </div>

              {subscription.status === 'trialing' && subscription.trialEndsAt && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <p className="text-sm text-blue-800">
                    Your free trial ends in <span className="font-bold">{daysUntil(subscription.trialEndsAt)} days</span> ({formatDate(subscription.trialEndsAt)}).
                    You won't be charged until then.
                  </p>
                </div>
              )}

              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                  <p className="text-sm text-amber-800">
                    Your subscription will cancel at the end of the current period ({formatDate(subscription.currentPeriodEnd)}).
                  </p>
                </div>
              )}

              {(subscription.status === 'past_due' || subscription.status === 'unpaid') && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-sm text-red-800">
                    Your payment has failed. Please update your payment method to avoid service interruption.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Current period</div>
                  <div className="font-medium">{formatDate(subscription.currentPeriodStart)} — {formatDate(subscription.currentPeriodEnd)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Next billing date</div>
                  <div className="font-medium">
                    {subscription.cancelAtPeriodEnd ? 'Cancels' : formatDate(subscription.currentPeriodEnd)}
                  </div>
                </div>
              </div>

              <Button onClick={handlePortal} disabled={!!actionLoading} variant="outline" className="gap-2">
                {actionLoading === 'portal' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Manage Billing
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Payment History */}
          {events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-gray-500">Date</th>
                        <th className="pb-2 font-medium text-gray-500">Event</th>
                        <th className="pb-2 font-medium text-gray-500">Amount</th>
                        <th className="pb-2 font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {events.map((e) => (
                        <tr key={e.id}>
                          <td className="py-2 text-gray-700">{formatDate(e.createdAt)}</td>
                          <td className="py-2 text-gray-700">{e.eventType.replace(/_/g, ' ').replace(/\./g, ' ')}</td>
                          <td className="py-2 text-gray-700">{formatAmount(e.amountCents)}</td>
                          <td className="py-2">
                            <Badge className={
                              e.status === 'succeeded' ? 'bg-green-50 text-green-700' :
                              e.status === 'failed' ? 'bg-red-50 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }>
                              {e.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )

  return (
    <RoleGuard allowed={['admin']}>
      {content}
    </RoleGuard>
  )
}

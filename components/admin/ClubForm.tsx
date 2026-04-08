'use client'

import { useState } from 'react'
import { Club, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ClubFormProps {
  advisors: User[]
  onSubmit: (data: Omit<Club, 'id' | 'memberIds' | 'leadershipPositions' | 'socialLinks' | 'meetingTimes' | 'createdAt'>) => void
}

export default function ClubForm({ advisors, onSubmit }: ClubFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [unlimited, setUnlimited] = useState(false)
  const [capacity, setCapacity] = useState(20)
  const [advisorId, setAdvisorId] = useState(advisors[0]?.id ?? '')
  const [tags, setTags] = useState('')
  const hasAdminFallbackOnly = advisors.length === 1 && advisors[0]?.role === 'admin'
  const selectedAdvisorId = advisors.some((advisor) => advisor.id === advisorId)
    ? advisorId
    : (advisors[0]?.id ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !description.trim() || !selectedAdvisorId) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      iconUrl: iconUrl.trim() || undefined,
      capacity: unlimited ? null : capacity,
      advisorId: selectedAdvisorId,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      autoAccept: false,
      eventCreatorIds: [],
    })
    setName('')
    setDescription('')
    setIconUrl('')
    setUnlimited(false)
    setCapacity(20)
    setTags('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create New Club</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-gray-700 block mb-1">Club Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Photography Club"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Icon (emoji)</label>
              <Input
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="e.g. 📷"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this club is about..."
              required
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Advisor or owner *</label>
              <select
                value={selectedAdvisorId}
                onChange={(e) => setAdvisorId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {advisors.length === 0 && (
                  <option value="">No advisors or admins available yet</option>
                )}
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.role === 'admin' ? ' (admin owner)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                {hasAdminFallbackOnly
                  ? 'No advisors have joined yet, so you can assign this club to your admin account for testing and reassign it later.'
                  : 'Promote a user to advisor, or assign the club to an admin while the school is setting up.'}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Member Limit *</label>
              <label className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                />
                Unlimited
              </label>
              {!unlimited && (
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  required
                />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Tags <span className="text-gray-400">(comma separated)</span>
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. STEM, Art, Competition"
            />
          </div>
          <Button type="submit" className="w-full" disabled={advisors.length === 0}>
            Create Club
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

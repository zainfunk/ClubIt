'use client'

import { MapPin, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { ClubEvent, MeetingTime } from '@/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

interface ClubEventsProps {
  events: ClubEvent[]
  meetingTimes: MeetingTime[]
  canCreateContent: boolean
  isAdvisor: boolean
  currentUserId: string
  // Event form
  showEventForm: boolean
  setShowEventForm: (v: boolean | ((prev: boolean) => boolean)) => void
  newEventTitle: string; setNewEventTitle: (v: string) => void
  newEventDesc: string; setNewEventDesc: (v: string) => void
  newEventDate: string; setNewEventDate: (v: string) => void
  newEventLocation: string; setNewEventLocation: (v: string) => void
  newEventPublic: boolean; setNewEventPublic: (v: boolean) => void
  onCreateEvent: () => void
  onDeleteEvent: (id: string) => void
  // Meeting time form
  newMeetingDay: number; setNewMeetingDay: (v: number) => void
  newMeetingStart: string; setNewMeetingStart: (v: string) => void
  newMeetingEnd: string; setNewMeetingEnd: (v: string) => void
  newMeetingLocation: string; setNewMeetingLocation: (v: string) => void
  onAddMeetingTime: () => void
  onRemoveMeetingTime: (id: string) => void
}

export default function ClubEvents({
  events, meetingTimes, canCreateContent, isAdvisor, currentUserId,
  showEventForm, setShowEventForm,
  newEventTitle, setNewEventTitle, newEventDesc, setNewEventDesc,
  newEventDate, setNewEventDate, newEventLocation, setNewEventLocation,
  newEventPublic, setNewEventPublic, onCreateEvent, onDeleteEvent,
  newMeetingDay, setNewMeetingDay, newMeetingStart, setNewMeetingStart,
  newMeetingEnd, setNewMeetingEnd, newMeetingLocation, setNewMeetingLocation,
  onAddMeetingTime, onRemoveMeetingTime,
}: ClubEventsProps) {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter((e) => e.date >= today)

  return (
    <section className="col-span-3 space-y-5" data-tour-id="tour-events-section">
      {/* Upcoming Events */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
            Upcoming Events
          </h3>
          {canCreateContent && (
            <button onClick={() => setShowEventForm((v) => !v)}
              className="text-[#0058be] font-bold text-xs hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />Add
            </button>
          )}
        </div>

        {canCreateContent && showEventForm && (
          <div className="mb-6 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Event</p>
            <Input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Event title…" className="h-8 text-sm" />
            <textarea value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Description…" rows={2}
              className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none border border-gray-100" />
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Location</label>
                <Input value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} placeholder="Room 204…" className="h-8 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={newEventPublic} onChange={(e) => setNewEventPublic(e.target.checked)} />
              Public event
            </label>
            <div className="flex gap-2">
              <button onClick={onCreateEvent} disabled={!newEventTitle.trim() || !newEventDate}
                className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 transition-colors">
                Create
              </button>
              <button onClick={() => setShowEventForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        )}

        {upcoming.length === 0 && !showEventForm && (
          <p className="text-sm text-gray-400 italic">No upcoming events scheduled.</p>
        )}

        <div className="space-y-5">
          {upcoming.map((event) => {
            const date = new Date(event.date + 'T00:00:00')
            const canDelete = isAdvisor || event.createdBy === currentUserId
            return (
              <div key={event.id} className="flex gap-4 group">
                <div className="w-14 h-16 flex-shrink-0 date-spine-gradient rounded-2xl flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-[#0058be] uppercase leading-none">
                    {date.toLocaleString('en', { month: 'short' })}
                  </span>
                  <span className="text-xl font-black text-[#0058be] leading-none mt-1">
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-bold text-slate-900 group-hover:text-[#0058be] transition-colors leading-snug text-sm">
                      {event.title}
                    </h4>
                    {canDelete && (
                      <button onClick={() => onDeleteEvent(event.id)}
                        className="text-gray-200 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {event.location && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{event.location}
                    </p>
                  )}
                  {!event.isPublic && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      Members only
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Schedule */}
      {(meetingTimes.length > 0 || isAdvisor) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-5" style={{ fontFamily: 'var(--font-manrope)' }}>
            Schedule
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Weekly Times</p>
          <div className="space-y-3">
            {meetingTimes.map((mt) => (
              <div key={mt.id} className="group/mt flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-sm text-slate-900">{DAY_NAMES[mt.dayOfWeek]}s &nbsp;·&nbsp; {fmtTime(mt.startTime)} – {fmtTime(mt.endTime)}</p>
                  {mt.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <p className="text-xs text-slate-500">{mt.location}</p>
                    </div>
                  )}
                </div>
                {isAdvisor && (
                  <button onClick={() => onRemoveMeetingTime(mt.id)}
                    className="text-gray-200 hover:text-red-400 opacity-0 group-hover/mt:opacity-100 transition-all shrink-0 mt-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {meetingTimes.length === 0 && (
              <p className="text-slate-400 text-sm italic">No schedule set.</p>
            )}

            {isAdvisor && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Add time</p>
                <select value={newMeetingDay} onChange={(e) => setNewMeetingDay(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none">
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}s</option>)}
                </select>
                <div className="grid grid-cols-2 gap-1.5">
                  <input type="time" value={newMeetingStart} onChange={(e) => setNewMeetingStart(e.target.value)}
                    className="text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none" />
                  <input type="time" value={newMeetingEnd} onChange={(e) => setNewMeetingEnd(e.target.value)}
                    className="text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none" />
                </div>
                <input value={newMeetingLocation} onChange={(e) => setNewMeetingLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="w-full text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none placeholder:text-slate-400" />
                <button onClick={onAddMeetingTime}
                  className="w-full py-2 bg-[#0058be] hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

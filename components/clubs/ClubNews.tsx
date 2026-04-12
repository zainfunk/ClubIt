'use client'

import { Clock, Newspaper, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { ClubNews as ClubNewsType, User } from '@/types'

interface ClubNewsProps {
  news: ClubNewsType[]
  canCreateContent: boolean
  isMember: boolean
  isAdvisor: boolean
  currentUserId: string
  resolveUser: (id: string) => User | undefined
  // Form state
  showForm: boolean
  setShowForm: (v: boolean | ((prev: boolean) => boolean)) => void
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  pinned: boolean
  setPinned: (v: boolean) => void
  onPost: () => void
  onDelete: (newsId: string) => void
  formatTime: (iso: string) => string
}

export default function ClubNews({
  news, canCreateContent, isMember, isAdvisor, currentUserId, resolveUser,
  showForm, setShowForm, title, setTitle, content, setContent,
  pinned, setPinned, onPost, onDelete, formatTime,
}: ClubNewsProps) {
  return (
    <section className="col-span-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
          News
        </h2>
        {canCreateContent && (
          <button onClick={() => setShowForm((v) => !v)}
            className="text-[#0058be] font-bold text-sm hover:underline flex items-center gap-1">
            <Plus className="w-4 h-4" />Post Update
          </button>
        )}
      </div>

      {canCreateContent && showForm && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>New Post</h3>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title…" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Write your update…" rows={4}
            className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top
            </label>
            <div className="flex gap-2">
              <button onClick={onPost} disabled={!title.trim() || !content.trim()}
                className="text-xs font-bold bg-[#0058be] text-white rounded-xl px-5 py-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Post
              </button>
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!(isMember || isAdvisor) && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
          <p className="text-gray-400 text-sm">Join the club to see updates.</p>
        </div>
      )}

      {(isMember || isAdvisor) && news.length === 0 && !showForm && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
          <p className="text-gray-400 text-sm">No posts yet.</p>
        </div>
      )}

      {(isMember || isAdvisor) && news.map((item) => {
        const author = resolveUser(item.authorId)
        const canDelete = isAdvisor || item.authorId === currentUserId
        if (item.isPinned) {
          return (
            <div key={item.id} className="bg-[#0058be]/5 rounded-3xl p-8 border border-[#0058be]/10 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Newspaper className="w-4 h-4 text-[#0058be]" />
              </div>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-8 h-8 rounded-full bg-[#0058be] flex items-center justify-center text-white shrink-0">
                  <Newspaper className="w-4 h-4" />
                </span>
                <span className="text-[#0058be] font-bold text-xs uppercase tracking-widest">Pinned Update</span>
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                {item.title}
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6">{item.content}</p>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium">
                  {author?.name} · {formatTime(item.createdAt)}
                </span>
                {canDelete && (
                  <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )
        }
        return (
          <div key={item.id} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">General Update</span>
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
              {item.title}
            </h3>
            <p className="text-gray-600 leading-relaxed">{item.content}</p>
            <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
              <span className="text-slate-400 text-xs font-medium">
                {author?.name} · {formatTime(item.createdAt)}
              </span>
              {canDelete && (
                <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

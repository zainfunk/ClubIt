'use client'

import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto rounded-2xl p-0 shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-sm max-w-sm w-full border-none"
      style={{ background: '#ffffff' }}
    >
      <div className="p-6">
        <h3
          className="text-lg font-bold text-[#191c1d] mb-1"
          style={{ fontFamily: 'var(--font-manrope, sans-serif)', letterSpacing: '-0.02em' }}
        >
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[#727785] leading-relaxed mb-6">{description}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[#727785] transition-colors hover:bg-[#f3f4f5]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onCancel() }}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
            style={{
              background: isDanger ? '#EF4444' : '#0058be',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

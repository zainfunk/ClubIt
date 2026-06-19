'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { haptic } from '@/lib/haptics'

/**
 * Native-only "Scan to check in" button. Opens the in-app camera, decodes a
 * club attendance QR code, and routes to /attend?t=... entirely in-app.
 *
 * This is the highest-value native capability for App Store Guideline 4.2:
 * a real device feature (camera) wired to a core flow, instead of relying on
 * the OS camera to open the link. Renders nothing on the web build, and the
 * scanner plugin is only imported on a native platform.
 */
export default function ScanCheckInButton({ className }: { className?: string }) {
  const router = useRouter()
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])

  if (!isNative) return null

  async function scan() {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')

      const supported = await BarcodeScanner.isSupported()
      if (!supported.supported) {
        toast.error('Scanning is not supported on this device')
        return
      }

      const perm = await BarcodeScanner.requestPermissions()
      if (perm.camera !== 'granted' && perm.camera !== 'limited') {
        toast.error('Camera access is needed to scan a check-in code')
        return
      }

      const { barcodes } = await BarcodeScanner.scan()
      const raw = barcodes[0]?.rawValue
      if (!raw) return

      // Accept either a full URL or a bare path; only allow our check-in route.
      let path = raw
      try {
        const url = new URL(raw)
        path = `${url.pathname}${url.search}`
      } catch {
        /* not a URL — treat raw as a path */
      }

      if (!path.startsWith('/attend')) {
        toast.error("That QR code isn't a ClubIt check-in code")
        return
      }

      void haptic('success')
      router.push(path)
    } catch (err) {
      console.error('QR scan failed', err)
      toast.error('Could not scan the code. Try again.')
    }
  }

  return (
    <button
      type="button"
      onClick={scan}
      className={
        className ??
        'inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-[#0058be] text-white text-sm font-bold px-4 py-3 shadow-lg shadow-blue-500/20 active:translate-y-px transition-transform touch-manipulation'
      }
    >
      <QrCode className="w-5 h-5" />
      Scan to check in
    </button>
  )
}

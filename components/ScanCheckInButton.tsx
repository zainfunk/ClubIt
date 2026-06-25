'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { QrCode, X } from 'lucide-react'
import { toast } from 'sonner'
import { haptic } from '@/lib/haptics'

/**
 * "Scan to check in" button.
 *
 * Native (iOS/Android): uses @capacitor-mlkit/barcode-scanning for the in-app
 * camera and routes /attend?t=... in-app — primary path for App Store
 * Guideline 4.2 (real device feature wired to a core flow).
 *
 * Web (desktop or mobile browser): falls back to html5-qrcode in a modal so
 * users without the native app can still scan an advisor's QR.
 */
export default function ScanCheckInButton({ className }: { className?: string }) {
  const router = useRouter()
  const [isNative, setIsNative] = useState<boolean | null>(null)
  const [webOpen, setWebOpen] = useState(false)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])

  if (isNative === null) return null

  /** Accept either a full URL or a bare path; only allow our check-in route. */
  function resolveAttendPath(raw: string): string | null {
    let path = raw
    try {
      const url = new URL(raw)
      path = `${url.pathname}${url.search}`
    } catch {
      /* not a URL — treat raw as a path */
    }
    return path.startsWith('/attend') ? path : null
  }

  /** Returns true if MLKit handled the scan (success or hard-stop error).
   *  Returns false to signal "fall back to the web scanner modal" — used
   *  when the native plugin isn't compiled into the iOS binary (SPM project
   *  without CocoaPods can't link MLKit). */
  async function scanNative(): Promise<boolean> {
    let BarcodeScanner: typeof import('@capacitor-mlkit/barcode-scanning').BarcodeScanner
    try {
      ;({ BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning'))
    } catch {
      return false
    }

    try {
      const supported = await BarcodeScanner.isSupported()
      if (!supported.supported) return false

      const perm = await BarcodeScanner.requestPermissions()
      if (perm.camera !== 'granted' && perm.camera !== 'limited') {
        toast.error('Camera access is needed to scan a check-in code')
        return true
      }

      const { barcodes } = await BarcodeScanner.scan()
      const raw = barcodes[0]?.rawValue
      if (!raw) return true

      const path = resolveAttendPath(raw)
      if (!path) {
        toast.error("That QR code isn't a ClubIt check-in code")
        return true
      }

      void haptic('success')
      router.push(path)
      return true
    } catch (err) {
      // "Plugin not implemented" / "UNIMPLEMENTED" → fall through to web.
      const msg = err instanceof Error ? err.message : String(err)
      if (/not.?implemented|UNIMPLEMENTED|unavailable/i.test(msg)) return false
      console.warn('QR scan failed', err)
      toast.error('Could not scan the code. Try again.')
      return true
    }
  }

  async function handleClick() {
    if (isNative) {
      const handled = await scanNative()
      if (!handled) setWebOpen(true)
    } else {
      setWebOpen(true)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          className ??
          'inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-[#0058be] text-white text-sm font-bold px-4 py-3 shadow-lg shadow-blue-500/20 active:translate-y-px transition-transform touch-manipulation'
        }
      >
        <QrCode className="w-5 h-5" />
        Scan to check in
      </button>
      {webOpen && (
        <WebScannerModal
          onClose={() => setWebOpen(false)}
          onScan={(raw) => {
            const path = resolveAttendPath(raw)
            if (!path) {
              toast.error("That QR code isn't a ClubIt check-in code")
              return false
            }
            setWebOpen(false)
            router.push(path)
            return true
          }}
        />
      )}
    </>
  )
}

/**
 * Modal camera scanner backed by html5-qrcode. Web-only; native uses MLKit.
 * onScan returns true if the scan was accepted (modal closes); false keeps
 * scanning so the user can try another code without re-opening the camera.
 */
function WebScannerModal({
  onClose,
  onScan,
}: {
  onClose: () => void
  onScan: (raw: string) => boolean
}) {
  const containerId = 'scan-checkin-html5qr'
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    void (async () => {
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const Html5Qrcode = mod.Html5Qrcode
        const QR_CODE = mod.Html5QrcodeSupportedFormats.QR_CODE
        // Restrict to QR-only + opt into the native BarcodeDetector API
        // (Safari iOS 17+, Chrome) — orders of magnitude faster than the JS
        // jsQR fallback, which is why scanning was sluggish/no-op before.
        const instance = new Html5Qrcode(containerId, {
          verbose: false,
          formatsToSupport: [QR_CODE],
          useBarCodeDetectorIfSupported: true,
        })
        scannerRef.current = instance

        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 25,
            // Scale the scan box with the viewfinder so the QR doesn't need
            // to be aimed at a tiny fixed 240px square.
            qrbox: (vw: number, vh: number) => {
              const side = Math.floor(Math.min(vw, vh) * 0.75)
              return { width: side, height: side }
            },
            aspectRatio: 1,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 1280 },
            },
            disableFlip: false,
          },
          (decoded) => {
            const accepted = onScan(decoded)
            if (accepted) void instance.stop().catch(() => {})
          },
          () => { /* per-frame decode errors are noisy; ignore */ },
        )

        cleanup = () => {
          instance.stop()
            .then(() => instance.clear())
            .catch(() => {})
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const name = err instanceof Error ? err.name : ''
        const isPermissionDenied = /permission|denied|NotAllowed/i.test(msg) || name === 'NotAllowedError'
        const isNoCamera =
          /NotFound|no.*camera|no.*device|device.*not.*found/i.test(msg) ||
          name === 'NotFoundError' ||
          name === 'OverconstrainedError'
        // Use warn for expected/handled cases — console.error triggers the
        // Next.js dev overlay even when the UI shows the error gracefully.
        console.warn('web scanner failed to start', err)
        if (!cancelled) {
          setError(
            isPermissionDenied
              ? "Camera blocked. Click the camera icon in your browser's address bar to allow access, then reopen the scanner."
              : isNoCamera
                ? "No camera detected on this device. Connect a webcam or open ClubIt on a phone to scan."
                : 'Could not start the camera on this device',
          )
        }
      }
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [onScan])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-gray-900 mb-1">Scan check-in QR</h2>
        <p className="text-xs text-gray-500 mb-4">
          Point your camera at the advisor's QR code.
        </p>
        {error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div
            id={containerId}
            ref={containerRef}
            className="overflow-hidden rounded-xl bg-black aspect-square"
          />
        )}
      </div>
    </div>
  )
}

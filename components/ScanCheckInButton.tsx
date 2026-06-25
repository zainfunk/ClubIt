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
            // Tell /attend to auto-fire check-in instead of waiting for a tap.
            const sep = path.includes('?') ? '&' : '?'
            const target = `${path}${sep}auto=1`
            void haptic('success')
            setWebOpen(false)
            router.push(target)
            return true
          }}
        />
      )}
    </>
  )
}

type ScanState = 'starting' | 'scanning' | 'invalid' | 'error'

/**
 * Modal camera scanner with three layered strategies, in order of preference:
 *   1. Native BarcodeDetector API — Safari iOS 17+, Chrome. Fastest, most
 *      reliable. Decodes 60+ frames/sec straight off the <video> element.
 *   2. html5-qrcode library — JS-only decoder fallback for older browsers.
 *   3. Manual paste fallback — always available, so a student can still
 *      check in by pasting the link if the camera flow fails.
 *
 * onScan returns true if the modal should close (valid + routed), false to
 * keep scanning (invalid QR — show "Invalid QR" then resume scanning).
 */
function WebScannerModal({
  onClose,
  onScan,
}: {
  onClose: () => void
  onScan: (raw: string) => boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const html5ContainerId = 'scan-checkin-html5qr'
  const [state, setState] = useState<ScanState>('starting')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [invalidPreview, setInvalidPreview] = useState<string>('')
  const [manual, setManual] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let rafId = 0
    let html5Instance: { stop: () => Promise<unknown>; clear: () => void } | null = null
    let invalidResetId: ReturnType<typeof setTimeout> | null = null

    function flashInvalid(raw: string) {
      setInvalidPreview(raw.length > 60 ? raw.slice(0, 60) + '…' : raw)
      setState('invalid')
      if (invalidResetId) clearTimeout(invalidResetId)
      invalidResetId = setTimeout(() => {
        if (!cancelled) setState('scanning')
      }, 2200)
    }

    function handleDecoded(raw: string): boolean {
      const accepted = onScan(raw)
      if (!accepted) flashInvalid(raw)
      return accepted
    }

    void (async () => {
      // --- Path 1: native BarcodeDetector ---
      const BD = (globalThis as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
      const BDStatic = BD as unknown as { getSupportedFormats?: () => Promise<string[]> } | undefined
      let supportsQR = false
      try {
        if (BD) {
          const formats = (await BDStatic?.getSupportedFormats?.()) ?? []
          supportsQR = formats.includes('qr_code')
        }
      } catch {
        supportsQR = false
      }

      if (BD && supportsQR) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          })
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }

          const video = videoRef.current
          if (!video) return
          video.srcObject = stream
          video.setAttribute('playsinline', 'true')
          video.muted = true
          await video.play()

          const detector = new BD({ formats: ['qr_code'] })
          setState('scanning')

          const loop = async () => {
            if (cancelled) return
            try {
              const codes = await detector.detect(video)
              if (codes.length > 0) {
                const raw = codes[0].rawValue
                const accepted = handleDecoded(raw)
                if (accepted) return
              }
            } catch {
              /* per-frame decode errors are expected — ignore */
            }
            rafId = requestAnimationFrame(loop)
          }
          loop()
          return
        } catch (err) {
          handleStartError(err)
          return
        }
      }

      // --- Path 2: html5-qrcode fallback ---
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const Html5Qrcode = mod.Html5Qrcode
        const QR_CODE = mod.Html5QrcodeSupportedFormats.QR_CODE
        const instance = new Html5Qrcode(html5ContainerId, {
          verbose: false,
          formatsToSupport: [QR_CODE],
          useBarCodeDetectorIfSupported: true,
        })
        html5Instance = instance

        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 25,
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
            const accepted = handleDecoded(decoded)
            if (accepted) void instance.stop().catch(() => {})
          },
          () => { /* per-frame decode errors are noisy; ignore */ },
        )
        setState('scanning')
      } catch (err) {
        handleStartError(err)
      }
    })()

    function handleStartError(err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const name = err instanceof Error ? err.name : ''
      const isPermissionDenied = /permission|denied|NotAllowed/i.test(msg) || name === 'NotAllowedError'
      const isNoCamera =
        /NotFound|no.*camera|no.*device|device.*not.*found/i.test(msg) ||
        name === 'NotFoundError' ||
        name === 'OverconstrainedError'
      console.warn('web scanner failed to start', err)
      if (!cancelled) {
        setErrorMsg(
          isPermissionDenied
            ? "Camera blocked. Allow camera access in your browser settings, then reopen the scanner."
            : isNoCamera
              ? "No camera detected on this device. Use the manual entry below or open ClubIt on a phone."
              : 'Could not start the camera. Use the manual entry below.',
        )
        setState('error')
      }
    }

    return () => {
      cancelled = true
      if (invalidResetId) clearTimeout(invalidResetId)
      if (rafId) cancelAnimationFrame(rafId)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (html5Instance) {
        html5Instance.stop().then(() => html5Instance!.clear()).catch(() => {})
      }
    }
  }, [onScan])

  function submitManual() {
    const v = manual.trim()
    if (!v) return
    const accepted = onScan(v)
    if (!accepted) {
      setInvalidPreview(v.length > 60 ? v.slice(0, 60) + '…' : v)
      setState('invalid')
    }
  }

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

        {state === 'error' ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-3">
            {errorMsg}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-black aspect-square">
            {/* Native-path video */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* html5-qrcode container (only used as fallback; harmless if unused) */}
            <div id={html5ContainerId} className="absolute inset-0" />

            {/* Scan box overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`relative w-3/4 aspect-square rounded-2xl border-4 transition-colors ${
                  state === 'invalid' ? 'border-red-400' : 'border-white/80'
                }`}
              >
                {/* corner accents */}
                <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-2xl" />
              </div>
            </div>

            {/* Status pill */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
              {state === 'starting' && (
                <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur">
                  Starting camera…
                </span>
              )}
              {state === 'scanning' && (
                <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Scanning…
                </span>
              )}
              {state === 'invalid' && (
                <span className="px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold backdrop-blur">
                  Invalid QR
                </span>
              )}
            </div>
          </div>
        )}

        {state === 'invalid' && invalidPreview && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            <p className="font-bold mb-1">That QR isn't a ClubIt check-in code.</p>
            <p className="font-mono break-all opacity-70">{invalidPreview}</p>
          </div>
        )}

        {/* Manual paste fallback */}
        <div className="mt-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
            Or paste the check-in link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="https://…/attend?t=…"
              className="flex-1 text-xs rounded-lg px-2 py-2 bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={submitManual}
              disabled={!manual.trim()}
              className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-3 py-2 disabled:opacity-40"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

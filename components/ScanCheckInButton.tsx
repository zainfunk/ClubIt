'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { QrCode, X, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
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
  const [errorOverlay, setErrorOverlay] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [])

  function showError(message: string) {
    void haptic('error')
    setErrorOverlay(message)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setErrorOverlay(null), 2200)
  }

  if (isNative === null) return null

  /** Add ?auto=1 so /attend auto-fires checkIn() instead of waiting for a tap. */
  function withAuto(path: string): string {
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}auto=1`
  }

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
        showError('Camera access is needed to scan a check-in code')
        return true
      }

      const { barcodes } = await BarcodeScanner.scan()
      const raw = barcodes[0]?.rawValue
      // User dismissed the scanner without capturing a code — stay quiet.
      if (!raw) return true

      const path = resolveAttendPath(raw)
      if (!path) {
        showError("That QR code isn't a ClubIt check-in code")
        return true
      }

      void haptic('success')
      router.push(withAuto(path))
      return true
    } catch (err) {
      // "Plugin not implemented" / "UNIMPLEMENTED" → fall through to web.
      const msg = err instanceof Error ? err.message : String(err)
      if (/not.?implemented|UNIMPLEMENTED|unavailable/i.test(msg)) return false
      console.warn('QR scan failed', err)
      showError('Could not scan the code. Try again.')
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
              // The modal itself flashes "Invalid QR" inside the camera view —
              // no extra overlay needed here.
              return false
            }
            void haptic('success')
            setWebOpen(false)
            router.push(withAuto(path))
            return true
          }}
        />
      )}
      <ScanErrorOverlay message={errorOverlay} onDismiss={() => setErrorOverlay(null)} />
    </>
  )
}

/**
 * Full-screen animated overlay shown after a failed scan. Auto-dismisses on a
 * timer set by the caller, but tapping anywhere also dismisses it so a student
 * who realized the issue mid-animation isn't stuck waiting.
 */
function ScanErrorOverlay({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="scan-error-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onDismiss}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-red-500/95 to-red-700/95 backdrop-blur-sm px-6"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: 30 }}
              animate={{
                scale: 1,
                rotate: 0,
                x: [0, -10, 10, -8, 8, -4, 4, 0],
              }}
              transition={{
                scale: { type: 'spring', stiffness: 260, damping: 14, delay: 0.05 },
                rotate: { type: 'spring', stiffness: 260, damping: 14, delay: 0.05 },
                x: { duration: 0.5, delay: 0.25, ease: 'easeInOut' },
              }}
              className="mx-auto mb-6 inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-2xl"
            >
              <XCircle className="w-20 h-20 text-red-500" strokeWidth={2.5} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-extrabold text-white tracking-tight"
              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
            >
              Scan failed
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-base text-white/90 font-medium max-w-xs mx-auto"
            >
              {message}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
  // Visible decoder tag so users (and we) can tell which path is active
  // when scans aren't being picked up.
  const [decoder, setDecoder] = useState<'native' | 'html5' | null>(null)
  const [frames, setFrames] = useState(0)

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
          setDecoder('native')
          setState('scanning')

          let frameCount = 0
          const loop = async () => {
            if (cancelled) return
            try {
              const codes = await detector.detect(video)
              frameCount++
              if (frameCount % 15 === 0) setFrames(frameCount)
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
        // useBarCodeDetectorIfSupported lives under experimentalFeatures —
        // not at the top level. Setting it at the top level was a silent
        // no-op, which is why we were stuck on the slow JS decoder even
        // on browsers that could have used the native API.
        const instance = new Html5Qrcode(html5ContainerId, {
          verbose: false,
          formatsToSupport: [QR_CODE],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        })
        html5Instance = instance

        let frameCount = 0
        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 30,
            qrbox: (vw: number, vh: number) => {
              const side = Math.floor(Math.min(vw, vh) * 0.8)
              return { width: side, height: side }
            },
            aspectRatio: 1,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1920 },
            },
            disableFlip: false,
          },
          (decoded) => {
            const accepted = handleDecoded(decoded)
            if (accepted) void instance.stop().catch(() => {})
          },
          () => {
            // Count attempts via the error callback (fires every frame jsQR
            // tried and didn't find a code). Lets us prove the loop is alive.
            frameCount++
            if (frameCount % 15 === 0) setFrames(frameCount)
          },
        )
        setDecoder('html5')
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

            {/* Decoder/frames diagnostic tag — top-left */}
            {decoder && (
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-mono backdrop-blur">
                {decoder} · {frames}f
              </div>
            )}

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

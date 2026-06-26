import Foundation
import Capacitor
import AVFoundation

/**
 * Native QR scanner backed by AVFoundation (AVCaptureMetadataOutput) — the
 * same detector the iOS Camera app uses. The web/WKWebView decoders (zxing-js,
 * jsQR) could not read a real photographed QR even when the pixels were fine
 * (lum ~140), so check-in scanning runs natively here.
 *
 * JS side calls `BarcodeScan.scan()` and gets `{ value }` on a successful
 * decode or `{ cancelled: true }` if the user backs out. Reject codes:
 *   - "permission-denied": camera permission not granted
 *   - "unavailable": no usable capture device / session
 */
@objc(BarcodeScanPlugin)
public class BarcodeScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarcodeScanPlugin"
    public let jsName = "BarcodeScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    @objc public func scan(_ call: CAPPluginCall) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            presentScanner(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                if granted {
                    self?.presentScanner(call)
                } else {
                    call.reject("permission-denied")
                }
            }
        default:
            call.reject("permission-denied")
        }
    }

    private func presentScanner(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController else {
                call.reject("unavailable")
                return
            }
            let scanner = BarcodeScannerViewController()
            scanner.modalPresentationStyle = .fullScreen
            scanner.onFinish = { value in
                scanner.dismiss(animated: true) {
                    if let value = value {
                        call.resolve(["value": value])
                    } else {
                        call.resolve(["cancelled": true])
                    }
                }
            }
            scanner.onUnavailable = {
                scanner.dismiss(animated: true) {
                    call.reject("unavailable")
                }
            }
            host.present(scanner, animated: true)
        }
    }
}

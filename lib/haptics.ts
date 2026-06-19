// Thin wrapper around @capacitor/haptics. No-ops on the web build and is fully
// tree-safe: the plugin is only imported on a native platform, so nothing ships
// to the browser. Adds tactile feedback on key actions (check-in, vote) — a
// genuine native capability that also helps App Store Guideline 4.2.
import { Capacitor } from '@capacitor/core'

type Feel = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

export async function haptic(feel: Feel = 'medium'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')

    if (feel === 'success' || feel === 'warning' || feel === 'error') {
      const type =
        feel === 'success'
          ? NotificationType.Success
          : feel === 'warning'
            ? NotificationType.Warning
            : NotificationType.Error
      await Haptics.notification({ type })
      return
    }

    const style =
      feel === 'light' ? ImpactStyle.Light : feel === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Medium
    await Haptics.impact({ style })
  } catch {
    /* plugin unavailable — silently ignore */
  }
}

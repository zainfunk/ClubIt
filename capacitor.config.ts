import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.APP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.clubit.app',
  appName: 'ClubIt',
  webDir: 'public',
  // Token appended to the WKWebView user-agent so BOTH client and server code
  // can detect the native app. Server components read it from the UA header to
  // strip Apple-disallowed Stripe purchase UI (App Store Guideline 3.1.1).
  // Keep this string in sync with NATIVE_APP_UA_TOKEN in lib/platform.ts.
  appendUserAgent: 'ClubItNativeApp',
  server: {
    // In CI, APP_SERVER_URL is set to the deployed Vercel URL.
    // For local dev, run: APP_SERVER_URL=http://localhost:3000 npx cap sync ios
    ...(serverUrl ? { url: serverUrl } : {}),
    androidScheme: 'https',
  },
  plugins: {
    // Keep the branded splash up until the web layer mounts, then hide it from
    // NativeBootstrap. Prevents a flash of blank/white "website" on cold start
    // (App Store Guideline 4.2). #4f46e5 = ClubIt indigo.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#4f46e5',
      showSpinner: false,
    },
  },
};

export default config;

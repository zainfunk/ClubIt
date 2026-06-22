import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Manrope, Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { isMobileUserAgent } from "@/lib/platform";
import { DeviceProvider } from "@/components/mobile/DeviceProvider";
import { MockAuthProvider } from "@/lib/mock-auth";
import { ChatProvider } from "@/lib/chat-store";
import AppShell from "@/components/layout/AppShell";
import SettingsProvider from "@/components/SettingsProvider";
import RealtimeSyncProvider from "@/components/RealtimeSyncProvider";
import TourWrapper from "@/components/TourWrapper";
import ErrorBoundary from "@/components/ErrorBoundary";
import NativeBootstrap from "@/components/NativeBootstrap";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Clubit",
  description: "Your school's club hub",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon.svg",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "ClubIt",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lock zoom so focusing a sub-16px input (e.g. the chat composer) doesn't
  // auto-zoom the page and leave it pannable. WKWebView (the Capacitor native
  // app) honors these; iOS Safari ignores them for accessibility, so web users
  // can still pinch-zoom.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seed phone vs desktop from the request UA so the native app and mobile
  // browsers render the right shell on first paint (no hydration flash).
  const ua = (await headers()).get("user-agent");
  const initialIsPhone = isMobileUserAgent(ua);
  return (
    // Telemetry disabled: ClubIt serves minors, so we don't emit any
    // third-party usage telemetry (App Store kids/privacy posture).
    <ClerkProvider telemetry={{ disabled: true }}>
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f8f9fa]">
        <NativeBootstrap />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: 'var(--font-inter, sans-serif)', fontSize: '0.875rem' },
          }}
        />
        <DeviceProvider initialIsPhone={initialIsPhone}>
        <MockAuthProvider>
          <RealtimeSyncProvider>
          <ChatProvider>
            <SettingsProvider>
              <TourWrapper>
                <ErrorBoundary>
                  <AppShell>{children}</AppShell>
                </ErrorBoundary>
              </TourWrapper>
            </SettingsProvider>
          </ChatProvider>
          </RealtimeSyncProvider>
        </MockAuthProvider>
        </DeviceProvider>
      </body>
    </html>
    </ClerkProvider>
  );
}

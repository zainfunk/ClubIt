import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope, Inter } from "next/font/google";
import "./globals.css";
import { MockAuthProvider } from "@/lib/mock-auth";
import { ChatProvider } from "@/lib/chat-store";
import Navbar from "@/components/layout/Navbar";
import TopBar from "@/components/layout/TopBar";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f8f9fa]">
        <MockAuthProvider>
          <ChatProvider>
            <Navbar />
            <TopBar />
            <main className="ml-64 pt-16 min-h-screen px-8 py-8 overflow-y-auto">{children}</main>
          </ChatProvider>
        </MockAuthProvider>
      </body>
    </html>
  );
}

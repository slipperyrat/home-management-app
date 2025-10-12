import { ClerkProvider } from "@clerk/nextjs";
import { SyncUserClient } from "@/components/SyncUserClient";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/QueryProvider";
import { Analytics } from "@vercel/analytics/react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAStatus from "@/components/PWAStatus";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import HeartbeatProvider from "@/components/HeartbeatProvider";
import "./globals.css";
import type { ReactNode } from "react";
import { NavProvider } from "@/components/layout/NavProvider";
import Shell from "@/components/layout/Shell";

export const metadata = {
  title: "Home Management App",
  description: "Collaborative tools for everyday life - manage your household with ease",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Home Manager",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Home Management App",
    title: "Home Management App",
    description: "Collaborative tools for everyday life",
  },
  twitter: {
    card: "summary",
    title: "Home Management App",
    description: "Collaborative tools for everyday life",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0f19",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/icons/icon-192x192.png" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Home Manager" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#0b0f19" />
          <meta name="msapplication-tap-highlight" content="no" />
        </head>
        <body className="min-h-screen bg-[#0b0f19] text-slate-100 antialiased">
          <ErrorBoundary>
            <QueryProvider>
              <PWAStatus />
              <NavProvider>
                <SyncUserClient />
                <HeartbeatProvider>
                  <Shell>{children}</Shell>
                </HeartbeatProvider>
              </NavProvider>
              <Toaster position="top-right" />
              <PWAInstallPrompt />
              <PushNotificationSetup />
              <Analytics />
            </QueryProvider>
          </ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}

import { ClerkProvider } from "@clerk/nextjs";
import { SyncUserClient } from "@/components/SyncUserClient";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/QueryProvider";
import { Analytics } from '@vercel/analytics/react';
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAStatus from "@/components/PWAStatus";
import PushNotificationSetup from "@/components/PushNotificationSetup";
// import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Home Management App",
  description: "Collaborative tools for everyday life - manage your household with ease",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
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
};

// Add NavBar as a client component for auth state
import NavBar from "@/components/NavBar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="icon" href="/icons/icon-192x192.png" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Home Manager" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#2563eb" />
          <meta name="msapplication-tap-highlight" content="no" />
          <meta name="theme-color" content="#2563eb" />
        </head>
        <body>
          <QueryProvider>
            <PWAStatus />
            <NavBar />
            <SyncUserClient />
            {children}
            <Toaster position="top-right" />
            <PWAInstallPrompt />
                              <PushNotificationSetup />
            <Analytics />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

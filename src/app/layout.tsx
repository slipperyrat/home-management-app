import { ClerkProvider } from "@clerk/nextjs";
import { SyncUserClient } from "@/components/SyncUserClient";
import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Home Management App",
  description: "Collaborative tools for everyday life",
};

// Add NavBar as a client component for auth state
import NavBar from "@/components/NavBar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <NavBar />
          <SyncUserClient />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

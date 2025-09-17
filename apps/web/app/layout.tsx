import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

const currentYear = new Date().getFullYear();

export const metadata: Metadata = {
  title: "Proof of Play",
  description: "Nostr-powered indie game marketplace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-800 bg-slate-950/70">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <p className="text-lg font-semibold tracking-tight">Proof of Play</p>
              <p className="text-sm text-slate-400">Lightning-fast publishing for indie worlds.</p>
            </div>
          </header>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-slate-800 bg-slate-950/70">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>&copy; {currentYear} Proof of Play.</p>
              <p className="text-xs sm:text-sm">Building in public with Nostr, Lightning, and a love for games.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

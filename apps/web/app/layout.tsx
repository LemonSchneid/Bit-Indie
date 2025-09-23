import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { ClientProviders } from "./providers";

const currentYear = new Date().getFullYear();

export const metadata: Metadata = {
  title: "Proof of Play",
  description: "Lightning-first indie game marketplace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-800 bg-slate-950/70">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
              <div className="space-y-1">
                <Link
                  href="/"
                  className="text-lg font-semibold tracking-tight text-white transition hover:text-emerald-200"
                >
                  Proof of Play
                </Link>
                <p className="text-sm text-slate-400">Lightning-fast publishing for indie worlds.</p>
              </div>
              <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Simple MVP preview</span>
            </div>
          </header>

          <ClientProviders>
            <div className="flex-1">{children}</div>
          </ClientProviders>

          <footer className="border-t border-slate-800 bg-slate-950/70">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>&copy; {currentYear} Proof of Play.</p>
              <p className="text-xs sm:text-sm">Building in public with Lightning and a love for games.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

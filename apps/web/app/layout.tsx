import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { ClientProviders } from "./providers";

const currentYear = new Date().getFullYear();

export const metadata: Metadata = {
  title: "Bit Indie",
  description: "Lightning-first indie game marketplace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-800 bg-slate-950/70">
            <div className="mx-auto w-full max-w-6xl px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <Link
                    href="/"
                    className="text-lg font-semibold tracking-tight text-white transition hover:text-emerald-200"
                  >
                    Bit Indie
                  </Link>
                  <p className="text-sm text-slate-400">Lightning-fast publishing for indie worlds.</p>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <nav className="flex flex-wrap items-center gap-3 text-[0.65rem] uppercase tracking-[0.35em] text-slate-300">
                    <Link className="transition hover:text-emerald-200" href="/games">
                      Catalog
                    </Link>
                    <Link className="transition hover:text-emerald-200" href="/sell">
                      Sell Your Game
                    </Link>
                    <Link className="transition hover:text-emerald-200" href="/players">
                      Info for Players
                    </Link>
                    <Link className="transition hover:text-emerald-200" href="/chat">
                      Chat
                    </Link>
                  </nav>
                  <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70 lg:text-right">
                    Simple MVP preview
                  </span>
                </div>
              </div>
            </div>
          </header>

          <ClientProviders>
            <div className="flex-1">{children}</div>
          </ClientProviders>

          <footer className="border-t border-slate-800 bg-slate-950/70">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>&copy; {currentYear} Bit Indie.</p>
              <p className="text-xs sm:text-sm">Building in public with Lightning and a love for games.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { ClientProviders } from "./providers";
import { HeaderAccountStatus } from "../components/nav/header-account-status";

const currentYear = new Date().getFullYear();

export const metadata: Metadata = {
  title: "Bit Indie",
  description: "Lightning-first indie game marketplace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#050505] text-[#e8f9f1] antialiased">
        <ClientProviders>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-white/10 bg-black/40 backdrop-blur">
              <div className="mx-auto w-full max-w-6xl px-6 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <Link
                      href="/games"
                      className="text-lg font-semibold tracking-tight text-white transition hover:text-[#7bffc8]"
                    >
                      Bit Indie
                    </Link>
                    <p className="text-sm text-[#b8ffe5]/70">Lightning-fast publishing for indie worlds.</p>
                  </div>
                  <div className="flex flex-col gap-2 lg:items-end">
                    <nav className="flex flex-wrap items-center gap-3 text-[0.65rem] uppercase tracking-[0.35em] text-[#dcfff2]/70">
                      <Link className="transition hover:text-[#7bffc8]" href="/games">
                        Catalog
                      </Link>
                      <Link className="transition hover:text-[#7bffc8]" href="/sell">
                        Sell Your Game
                      </Link>
                      <Link className="transition hover:text-[#7bffc8]" href="/players">
                        Info for Players
                      </Link>
                      <Link className="transition hover:text-[#7bffc8]" href="/chat">
                        Chat
                      </Link>
                    </nav>
                    <div className="flex items-center gap-3">
                      <HeaderAccountStatus />
                      <Link
                        href="/sign-in"
                        className="text-xs uppercase tracking-[0.35em] text-[#7bffc8]/70 transition hover:text-[#a9ffe4] lg:text-right"
                      >
                        Sign In
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1">{children}</div>

            <footer className="border-t border-white/10 bg-black/40 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-[#b8ffe5]/60 sm:flex-row sm:items-center sm:justify-between">
                <p>&copy; {currentYear} Bit Indie.</p>
                <p className="text-xs text-[#dcfff2]/70 sm:text-sm">Building in public with Lightning and a love for games.</p>
              </div>
            </footer>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}

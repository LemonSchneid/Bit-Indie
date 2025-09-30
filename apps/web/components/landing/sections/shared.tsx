"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

export function MicroLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.55em] text-emerald-300/70">{children}</p>
  );
}

export function Pill({
  children,
  intent = "emerald",
}: {
  children: ReactNode;
  intent?: "emerald" | "magenta" | "slate";
}): JSX.Element {
  const intentClasses = {
    emerald: "text-emerald-200 border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    magenta: "text-fuchsia-200 border-fuchsia-400/40 bg-fuchsia-500/10 shadow-[0_0_20px_rgba(232,121,249,0.25)]",
    slate: "text-slate-200 border-slate-500/40 bg-slate-500/10 shadow-[0_0_20px_rgba(148,163,184,0.12)]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em]",
        intentClasses[intent],
      )}
    >
      {children}
    </span>
  );
}

export function NeonCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-emerald-500/10 bg-slate-950/60 p-6 shadow-[0_0_45px_rgba(16,185,129,0.18)] backdrop-blur-xl",
        "before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-emerald-500/20 before:opacity-60",
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function NeonLinkButton({ href, children }: { href: string; children: ReactNode }): JSX.Element {
  const isDisabled = href === "#";
  const baseClasses =
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition";
  const enabledClasses =
    "border-emerald-400/60 bg-emerald-500/10 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:border-emerald-300 hover:text-emerald-50";
  const disabledClasses = "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-500";

  if (isDisabled) {
    return <span className={cn(baseClasses, disabledClasses)}>{children}</span>;
  }

  return (
    <Link href={href} className={cn(baseClasses, enabledClasses)}>
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

export function MicroLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.55em] text-[#69ffb0]/80">{children}</p>
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
    emerald:
      "text-[#c2ffe7] border-[#2dff85]/60 bg-[rgba(23,36,27,0.9)] shadow-[0_0_25px_rgba(57,255,20,0.28)]",
    magenta:
      "text-[#9bf5ff] border-[#3ab4ff]/50 bg-[rgba(12,30,36,0.88)] shadow-[0_0_25px_rgba(58,180,255,0.25)]",
    slate: "text-slate-100 border-[#2a2a2a] bg-[rgba(14,14,14,0.92)] shadow-[0_0_18px_rgba(15,15,15,0.6)]",
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
        "relative overflow-hidden rounded-3xl border border-[#1f1f1f] bg-[rgba(9,9,9,0.92)] p-6 shadow-[0_0_45px_rgba(57,255,20,0.14)] backdrop-blur",
        "before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#2dff85]/15 before:bg-[radial-gradient(circle_at_top,_rgba(57,255,20,0.09),_transparent_70%)] before:opacity-70",
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
    "border-[#2dff85]/70 bg-[rgba(15,34,22,0.9)] text-[#d7ffe9] shadow-[0_0_24px_rgba(57,255,20,0.32)] hover:border-[#7affc8] hover:text-white";
  const disabledClasses = "cursor-not-allowed border-[#232323] bg-[rgba(12,12,12,0.9)] text-[#5b5b5b]";

  if (isDisabled) {
    return <span className={cn(baseClasses, disabledClasses)}>{children}</span>;
  }

  return (
    <Link href={href} className={cn(baseClasses, enabledClasses)}>
      {children}
    </Link>
  );
}

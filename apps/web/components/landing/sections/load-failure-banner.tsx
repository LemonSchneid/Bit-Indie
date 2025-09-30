"use client";

import { cn } from "./shared";

export function LoadFailureBanner({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.25)] backdrop-blur",
        className,
      )}
    >
      <p className="font-semibold uppercase tracking-[0.35em]">Live data unavailable</p>
      <p className="mt-2 text-xs text-amber-100/80">
        We could not reach the API just now, so you are seeing the showroom data only. Refresh or retry once connections settle.
      </p>
    </div>
  );
}

"use client";

import { cn } from "./shared";

export function LoadFailureBanner({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#facc15]/50 bg-[rgba(56,48,7,0.85)] px-5 py-4 text-sm text-[#fef3c7] shadow-[0_0_24px_rgba(250,204,21,0.25)] backdrop-blur",
        className,
      )}
    >
      <p className="font-semibold uppercase tracking-[0.35em] text-[#fde68a]">Live data unavailable</p>
      <p className="mt-2 text-xs text-[#fef3c7]/80">
        We could not reach the API just now, so you are seeing the showroom data only. Refresh or retry once connections settle.
      </p>
    </div>
  );
}

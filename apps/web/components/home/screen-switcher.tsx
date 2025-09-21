"use client";

import { cn } from "./utils";

const labels = ["STOREFRONT", "SELL YOUR GAME", "INFO FOR PLAYERS", "PLATFORM ROADMAP"];

export function ScreenSwitcher({
  activeScreen,
  onSelect,
}: {
  activeScreen: number;
  onSelect: (screen: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {labels.map((label, index) => {
        const screenIndex = index + 1;
        const isActive = activeScreen === screenIndex;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(screenIndex)}
            className={cn(
              "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition",
              isActive
                ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-emerald-400/60 hover:text-emerald-200",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

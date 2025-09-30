"use client";

import type { Dispatch, SetStateAction } from "react";

import { cn } from "./shared";

const SCREEN_OPTIONS = [
  { label: "Storefront", value: 1 },
  { label: "Sell your game", value: 2 },
  { label: "Lightning checkout", value: 3 },
  { label: "Receipt flow", value: 4 },
] as const;

function uppercaseLabel(value: string): string {
  return value.toUpperCase();
}

export function ScreenSwitcher({
  activeScreen,
  onSelect,
}: {
  activeScreen: number;
  onSelect: Dispatch<SetStateAction<number>>;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-3">
      {SCREEN_OPTIONS.map((option) => {
        const isActive = activeScreen === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition",
              isActive
                ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-emerald-400/60 hover:text-emerald-200",
            )}
          >
            {uppercaseLabel(option.label)}
          </button>
        );
      })}
    </div>
  );
}

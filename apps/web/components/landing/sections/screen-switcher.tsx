"use client";

import type { Dispatch, SetStateAction } from "react";

import { cn } from "./shared";

const SCREEN_OPTIONS = [
  { label: "Catalog", value: 1 },
  { label: "Sell Your Game", value: 2 },
  { label: "Info for Players", value: 3 },
  { label: "Chat", value: 4 },
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
                ? "border-[#2dff85]/80 bg-[rgba(20,37,26,0.95)] text-[#cffff0] shadow-[0_0_24px_rgba(57,255,20,0.35)]"
                : "border-[#262626] bg-[rgba(12,12,12,0.85)] text-[#6e6e6e] hover:border-[#2dff85]/60 hover:text-[#adffd8]",
            )}
          >
            {uppercaseLabel(option.label)}
          </button>
        );
      })}
    </div>
  );
}

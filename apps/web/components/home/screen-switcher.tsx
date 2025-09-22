"use client";

import { HomeScreen } from "./home-state-machine";
import { cn } from "./utils";

const screenOptions: Array<{ id: HomeScreen; label: string }> = [
  { id: HomeScreen.Storefront, label: "STOREFRONT" },
  { id: HomeScreen.SellGame, label: "SELL YOUR GAME" },
  { id: HomeScreen.InfoForPlayers, label: "INFO FOR PLAYERS" },
  { id: HomeScreen.PlatformRoadmap, label: "PLATFORM ROADMAP" },
];

export function ScreenSwitcher({
  activeScreen,
  onSelect,
}: {
  activeScreen: HomeScreen;
  onSelect: (screen: HomeScreen) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {screenOptions.map((option) => {
        const isActive = activeScreen === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={cn(
              "rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition",
              isActive
                ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-emerald-400/60 hover:text-emerald-200",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

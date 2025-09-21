"use client";

import { MicroLabel, NeonCard } from "./ui";

export function SellGameScreen() {
  return (
    <NeonCard className="p-8">
      <div className="space-y-6 text-center text-slate-200">
        <MicroLabel>Sell your game</MicroLabel>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Launch your build to Lightning-powered players
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300">
          Upload a build, set a price in sats, and plug in your Lightning address. Once approved,
          you&apos;ll take the spotlight in Discovery and Featured rotations with verified-purchase
          reviews and zap analytics out of the box.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            className="rounded-full border border-emerald-400/70 bg-emerald-500/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-50"
          >
            Start developer signup
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-700 bg-slate-900/70 px-6 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
          >
            View publishing checklist
          </button>
        </div>
      </div>
    </NeonCard>
  );
}

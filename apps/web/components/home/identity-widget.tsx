"use client";

import { identityBenefits } from "./data";
import { MicroLabel, NeonCard } from "./ui";

export function IdentityWidget() {
  return (
    <NeonCard className="w-full p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-4">
          <MicroLabel>Proof ID access</MicroLabel>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold tracking-tight text-white">Sign in or create one</h3>
            <p className="text-sm text-emerald-200/80">
              Proof IDs connect purchases, receipts, and creator tooling under a single account while
              keeping guest checkout lightweight.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-50">Proof IDs &amp; guest passes</p>
            <p className="mt-1 text-emerald-100/80">
              Accounts sync entitlements across devices. Guest purchases still get a recoverable device ID and
              receipt link for instant restores.
            </p>
          </div>
          <ul className="grid gap-4 pt-2 text-sm text-slate-200 sm:grid-cols-2 md:grid-cols-3">
            {identityBenefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-emerald-100">
                  ✶
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-100">{benefit.title}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200"
          >
            Sign in with Proof ID — Coming soon
          </button>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-full border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
          >
            Create a Proof ID — Coming soon
          </button>
          <p className="text-xs text-emerald-200/80">
            Guest checkout is live today. Proof ID sign-in launches soon — track progress on the roadmap.
          </p>
        </div>
      </div>
    </NeonCard>
  );
}

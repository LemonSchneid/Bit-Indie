"use client";

import { SIGN_IN_OPTIONS } from "../landing-fallbacks";
import { MicroLabel, NeonCard } from "./shared";

export function AccountAccessWidget(): JSX.Element {
  return (
    <NeonCard className="w-full max-w-sm p-6 lg:ml-10">
      <MicroLabel>Accounts & guest access</MicroLabel>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">Guest checkout first</h3>
      <p className="mt-2 text-sm text-emerald-200/80">
        Lightning checkout works without an account today. Sign-in will return soon with first-party credentials that stay on our
        own infrastructure.
      </p>
      <ul className="mt-5 space-y-4 text-sm text-slate-200">
        {SIGN_IN_OPTIONS.map((benefit) => (
          <li key={benefit.title} className="flex gap-3">
            <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-emerald-100">
              ✶
            </span>
            <div>
              <p className="font-semibold text-slate-100">{benefit.title}</p>
              <p className="text-xs leading-relaxed text-slate-400">{benefit.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          disabled
          className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
        >
          Sign in (coming soon)
        </button>
        <button
          type="button"
          className="w-full rounded-full border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
        >
          Continue as guest
        </button>
      </div>
    </NeonCard>
  );
}

"use client";

import { SIGN_IN_OPTIONS } from "../landing-fallbacks";
import { MicroLabel, NeonCard } from "./shared";

export function AccountAccessWidget(): JSX.Element {
  return (
    <NeonCard className="w-full max-w-sm p-6 lg:ml-10">
      <MicroLabel>Accounts & guest access</MicroLabel>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">Guest checkout first</h3>
      <p className="mt-2 text-sm text-[#7bffc8]/80">
        Lightning checkout works without an account today. Sign-in will return soon with first-party credentials that stay on our
        own infrastructure.
      </p>
      <ul className="mt-5 space-y-4 text-sm text-[#cbd5f5]/80">
        {SIGN_IN_OPTIONS.map((benefit) => (
          <li key={benefit.title} className="flex gap-3">
            <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#2dff85]/60 bg-[rgba(21,34,26,0.9)] text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#c6ffe9]">
              ✶
            </span>
            <div>
              <p className="font-semibold text-[#f5fff8]">{benefit.title}</p>
              <p className="text-xs leading-relaxed text-[#7a7a7a]">{benefit.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          disabled
          className="w-full rounded-full border border-[#232323] bg-[rgba(15,15,15,0.9)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#585858]"
        >
          Sign in (coming soon)
        </button>
        <button
          type="button"
          className="w-full rounded-full border border-[#2dff85]/60 bg-[rgba(17,32,23,0.95)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#d6ffe8] transition hover:border-[#7affc8] hover:text-white"
        >
          Continue as guest
        </button>
      </div>
    </NeonCard>
  );
}

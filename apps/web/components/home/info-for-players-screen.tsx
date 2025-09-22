"use client";

import { nostrEnabled } from "../../lib/flags";
import { MicroLabel, NeonCard } from "./ui";

export function InfoForPlayersScreen() {
  return (
    <NeonCard className="p-8">
      <div className="space-y-6 text-center text-slate-200">
        <MicroLabel>Info for players</MicroLabel>
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Get the most out of your Lightning-powered library
        </h2>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300">
          Pair your favorite Lightning wallet to unlock instant purchases and verified reviews.
          {nostrEnabled
            ? " Link your Proof ID to sync progress across every Proof of Play world."
            : " Proof ID sign-in is rolling out after the Simple MVP launch."}
        </p>
        <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
          <NeonCard className="p-5">
            <MicroLabel>Setup checklist</MicroLabel>
            <ul className="mt-4 space-y-3 text-left text-xs text-slate-300">
              <li>Install a Lightning wallet that supports BOLT11 invoices.</li>
              <li>Whitelist <code>localhost:3000</code> (or your deployed domain) in the wallet.</li>
              <li>Save guest receipts so you can restore downloads anytime.</li>
            </ul>
          </NeonCard>
          <NeonCard className="p-5">
            <MicroLabel>Quick tips</MicroLabel>
            <ul className="mt-4 space-y-3 text-left text-xs text-slate-300">
              <li>Use the download audit trail to keep track of builds per device.</li>
              <li>Drop a review to boost your favorite updates (zap weighting coming later).</li>
              <li>Follow dev devlogs on Proof of Play; Proof ID feeds arrive post-MVP.</li>
            </ul>
          </NeonCard>
        </div>
      </div>
    </NeonCard>
  );
}

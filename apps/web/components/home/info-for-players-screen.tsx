"use client";

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
          Pair your favorite Lightning wallet, link your Nostr identity, and you&apos;ll unlock
          instant purchases, zap-backed reviews, and portable saves across every Proof of Play
          world.
        </p>
        <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
          <NeonCard className="p-5">
            <MicroLabel>Setup checklist</MicroLabel>
            <ul className="mt-4 space-y-3 text-left text-xs text-slate-300">
              <li>Install a Lightning wallet that supports BOLT11 invoices.</li>
              <li>Enable NIP-07 in your browser for seamless npub sign-ins.</li>
              <li>Whitelist <code>localhost:3000</code> (or your deployed domain) in the wallet.</li>
            </ul>
          </NeonCard>
          <NeonCard className="p-5">
            <MicroLabel>Quick tips</MicroLabel>
            <ul className="mt-4 space-y-3 text-left text-xs text-slate-300">
              <li>Use the download audit trail to keep track of builds per device.</li>
              <li>Drop a zap-backed review to boost your favorite updates.</li>
              <li>Follow devs via Nostr relays for early access patches.</li>
            </ul>
          </NeonCard>
        </div>
      </div>
    </NeonCard>
  );
}

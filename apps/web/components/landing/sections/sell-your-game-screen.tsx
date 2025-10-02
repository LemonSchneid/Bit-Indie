"use client";

import Link from "next/link";

import type { DeveloperChecklistItem, LiveMetrics } from "../landing-types";

import { cn, MicroLabel, NeonCard, Pill } from "./shared";

const DEVELOPER_FORM_URL =
  process.env.NEXT_PUBLIC_DEVELOPER_FORM_URL ?? "https://bitindie.dev/developer-form";

type SellYourGameScreenProps = {
  checklist: DeveloperChecklistItem[];
  metrics: LiveMetrics;
  lightningAddress: string | null;
  priceLabel: string;
  tipLabel: string;
  gameTitle: string;
};

export function SellYourGameScreen({
  checklist,
  metrics,
  lightningAddress,
  priceLabel,
  tipLabel,
  gameTitle,
}: SellYourGameScreenProps): JSX.Element {
  const developerLightningAddress = lightningAddress ?? "you@studio.dev";
  const metricEntries = [
    { label: "Invoices settled today", value: metrics.invoicesToday.toLocaleString("en-US") },
    { label: "Downloads today", value: metrics.downloadsToday.toLocaleString("en-US") },
    { label: "First-party comments", value: metrics.firstPartyComments.toLocaleString("en-US") },
    { label: "Uptime", value: metrics.uptime },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <NeonCard className="p-8">
        <MicroLabel>Sell your game</MicroLabel>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Pill>Lightning-native</Pill>
          <Pill intent="magenta">Verified purchases</Pill>
          <Pill intent="slate">Realtime ops</Pill>
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">
          Launch {gameTitle} to the catalog and start earning sats.
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-[#9fb5aa]">
          Connect <span className="font-semibold text-[#abffd9]">{developerLightningAddress}</span>, upload your latest build,
          and flip on verified reviews. The developer console walks you from draft to featured slot without leaving the control
          deck, and you keep 85% of every sale while Bit Indie retains 15% to keep the marketplace humming.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#2dff85]/35 bg-[rgba(13,19,15,0.92)] p-5 shadow-[0_0_35px_rgba(57,255,20,0.22)]">
            <MicroLabel>Lightning-ready pricing</MicroLabel>
            <p className="mt-3 text-sm text-[#8fa39a]">
              Your catalog price broadcasts instantly to every player browsing the marketplace. Suggested tip keeps supporters in
              sync with your preferred range.
            </p>
            <div className="mt-5 grid gap-3 text-sm text-[#c2f5de] sm:grid-cols-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Base price</span>
                <p className="mt-1 text-lg font-semibold text-white">{priceLabel}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Suggested tip</span>
                <p className="mt-1 text-lg font-semibold text-white">{tipLabel}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#2dff85]/20 bg-[rgba(9,12,10,0.9)] p-5">
            <MicroLabel>Publishing flow</MicroLabel>
            <ul className="mt-4 space-y-3 text-sm text-[#8fa39a]">
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#2dff85]/50 bg-[rgba(18,34,24,0.95)] text-[0.65rem] font-semibold text-[#c7ffe9]">
                  1
                </span>
                <span>Upload your build & checksum straight from the dashboard.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#2dff85]/50 bg-[rgba(18,34,24,0.95)] text-[0.65rem] font-semibold text-[#c7ffe9]">
                  2
                </span>
                <span>Wire in your Lightning address and preview the instant checkout flow.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#2dff85]/50 bg-[rgba(18,34,24,0.95)] text-[0.65rem] font-semibold text-[#c7ffe9]">
                  3
                </span>
                <span>Flip on verified reviews to broadcast crew feedback on day one.</span>
              </li>
            </ul>
            <Link
              href={DEVELOPER_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full rounded-full border border-[#2dff85]/70 bg-[rgba(18,34,24,0.95)] px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.35em] text-[#d9ffe9] shadow-[0_0_28px_rgba(57,255,20,0.3)] transition hover:border-[#7affc8] hover:text-white"
            >
              Apply via the developer form
            </Link>
          </div>
        </div>
      </NeonCard>
      <div className="space-y-6">
        <NeonCard className="p-6">
          <MicroLabel>Checklist</MicroLabel>
          <ul className="mt-4 space-y-3 text-sm text-[#b6d7c7]">
            {checklist.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem] font-semibold",
                    item.complete
                      ? "border-[#2dff85]/70 bg-[rgba(18,34,24,0.95)] text-[#c7ffe9]"
                      : "border-[#262626] text-[#565656]",
                  )}
                >
                  {item.complete ? "✓" : ""}
                </span>
                <span className="uppercase tracking-[0.3em] text-[#6f7f77]">{item.title}</span>
              </li>
            ))}
          </ul>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Live metrics</MicroLabel>
          <div className="mt-4 space-y-4 text-sm text-[#8fa39a]">
            {metricEntries.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">{metric.label}</span>
                <span className="font-semibold text-[#abffd9]">{metric.value}</span>
              </div>
            ))}
          </div>
        </NeonCard>
      </div>
    </div>
  );
}

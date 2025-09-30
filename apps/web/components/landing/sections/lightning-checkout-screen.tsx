"use client";

import type { InvoiceSnapshot, InvoiceStep } from "../landing-types";

import { cn, MicroLabel, NeonCard, Pill } from "./shared";

export function LightningCheckoutScreen({ invoice, steps }: { invoice: InvoiceSnapshot; steps: InvoiceStep[] }): JSX.Element {
  return (
    <div className="flex justify-center">
      <NeonCard className="w-full max-w-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MicroLabel>Lightning checkout</MicroLabel>
          <Pill>Invoice active</Pill>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 shadow-[0_0_45px_rgba(16,185,129,0.35)]">
              <span className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">QR Code</span>
            </div>
            <p className="text-[0.7rem] uppercase tracking-[0.4em] text-emerald-300/70">Scan with a Lightning wallet</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <MicroLabel>BOLT11 invoice</MicroLabel>
              <textarea
                readOnly
                className="h-32 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4 text-xs text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                value={invoice.invoiceBolt11}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
                >
                  Copy invoice
                </button>
                <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Expires in {invoice.expiresInLabel}</span>
              </div>
            </div>
            <div>
              <MicroLabel>Status timeline</MicroLabel>
              <div className="mt-4 space-y-4">
                {steps.map((step) => (
                  <div key={step.label} className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border text-[0.6rem] uppercase tracking-[0.35em]",
                        step.status === "done"
                          ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200"
                          : step.status === "active"
                          ? "border-emerald-400/60 text-emerald-200"
                          : "border-slate-700 text-slate-500",
                      )}
                    >
                      {step.status === "done" ? "✓" : step.status === "active" ? "•" : ""}
                    </span>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="uppercase tracking-[0.35em] text-emerald-200/70">{step.label}</span>
                      <span className="text-xs uppercase tracking-[0.25em] text-slate-500">{step.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Game</span>
                <p className="mt-2 text-lg font-semibold text-slate-100">{invoice.gameTitle}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Lightning address</span>
                <p className="mt-2 text-sm font-semibold text-emerald-200">{invoice.lightningAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}

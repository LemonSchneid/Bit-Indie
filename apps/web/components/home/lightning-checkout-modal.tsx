"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { invoiceSteps } from "./data";
import { MicroLabel, Pill } from "./ui";
import { cn } from "./utils";

export function LightningCheckoutModal({ onClose }: { onClose: () => void }) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  useEffect(() => {
    if (!portalContainer) {
      return undefined;
    }

    const originalOverflow = portalContainer.style.overflow;
    portalContainer.style.overflow = "hidden";
    return () => {
      portalContainer.style.overflow = originalOverflow;
    };
  }, [portalContainer]);

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-0">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        aria-label="Close Lightning checkout"
      />
      <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/50" />
      <div className="pointer-events-none absolute inset-0 z-40 bg-[radial-gradient(circle_at_center,theme(colors.slate.950/55),theme(colors.slate.950/95))]" />
      <div className="relative z-50 flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-y-auto rounded-[32px] border border-emerald-400/25 bg-slate-950 shadow-[0_40px_120px_rgba(16,185,129,0.28)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
        >
          Close
        </button>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="relative bg-gradient-to-br from-slate-900/40 via-slate-950 to-slate-950 px-8 py-12 text-slate-100">
            <div className="absolute -top-36 -right-36 h-96 w-96 rounded-full bg-slate-500/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-slate-600/10 blur-3xl" />
            <div className="relative flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <MicroLabel>Lightning checkout</MicroLabel>
                <Pill>Invoice active</Pill>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold tracking-tight text-white">Scan or copy to complete your purchase</h3>
                <p className="text-sm text-emerald-200/80">
                  Use any Lightning wallet to pay the invoice. The download unlocks as soon as payment settles on the network.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-400/30 bg-slate-950/60 p-6 shadow-[0_0_60px_rgba(16,185,129,0.35)]">
                <div className="flex h-72 w-72 items-center justify-center rounded-[28px] border border-emerald-400/40 bg-gradient-to-br from-emerald-400/15 via-transparent to-emerald-400/10">
                  <span className="text-sm uppercase tracking-[0.35em] text-emerald-100">QR CODE</span>
                </div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/80">Scan with a Lightning wallet</p>
              </div>
              <div className="space-y-3">
                <MicroLabel>BOLT11 invoice</MicroLabel>
                <textarea
                  readOnly
                  className="h-36 w-full rounded-2xl border border-emerald-400/30 bg-slate-950/80 p-4 text-[11px] text-emerald-100 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
                  value="lnbc220u1pj3zsyapp5j42rfq3p63t0m4pq6smef7u66n4vz8yq5n3y5c0q3zd4l8p2d4sdp6xysxxatzd3skxct5ypmkxmmwypmk7mf5yppk7mfqgcqzpgxqyz5vqsp5rgl5e3qg7syeu4j6q9zw7u4m5c5d6f62mdla9qurcgr7yp3ynq9qyyssq0lf7ne9cfp3nd5s4jn4zxr3c0e7jfk8p0s8e0kaxsf6k9c3w7xjnk5d76v0ydf8tlyfmlc2j7a"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-emerald-400/60 bg-emerald-500/15 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-50"
                  >
                    Copy invoice
                  </button>
                  <span className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/80">Expires in 14:32</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-emerald-100">
                <p className="font-semibold uppercase tracking-[0.3em]">Need a wallet?</p>
                <p className="mt-2 leading-relaxed text-emerald-50/90">
                  Breez, Phoenix, Muun, and Zeus are great Lightning wallets that support scanning QR codes or pasting invoices.
                </p>
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-6 bg-slate-950 px-8 py-12 text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
              <MicroLabel>Purchase summary</MicroLabel>
              <div className="mt-4 grid gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.35em] text-slate-400">Amount due</span>
                  <span className="text-lg font-semibold text-emerald-200">22,000 sats</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.35em] text-slate-400">Game</span>
                  <span className="font-semibold text-slate-100">Neon Drift Syndicate</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.35em] text-slate-400">Invoice ID</span>
                  <span className="font-mono text-[11px] text-slate-300">pop-20240314-8842</span>
                </div>
              </div>
            </div>
            <div>
              <MicroLabel>Status timeline</MicroLabel>
              <div className="mt-4 space-y-4">
                {invoiceSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full border text-[0.6rem] uppercase tracking-[0.35em]",
                        step.status === "done"
                          ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-200"
                          : step.status === "active"
                          ? "border-emerald-400/60 text-emerald-200"
                          : "border-slate-700 text-slate-500",
                      )}
                    >
                      {step.status === "pending" ? "" : step.timestamp}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{step.label}</p>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
                        {step.status === "done"
                          ? "Captured"
                          : step.status === "active"
                          ? "Awaiting payment"
                          : "Pending"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm leading-relaxed text-slate-300">
              <p className="font-semibold text-slate-200">What happens next?</p>
              <ul className="mt-3 space-y-2">
                <li>• Your wallet confirms payment instantly.</li>
                <li>• The download unlocks within a few seconds.</li>
                <li>• You&apos;ll receive a receipt under your npub account for verified purchase status.</li>
              </ul>
              <p className="mt-4 text-[12px] text-slate-500">
                Need help? Ping <span className="font-semibold text-emerald-200">support@proof-of-play.gg</span> with the invoice ID above.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    portalContainer,
  );
}

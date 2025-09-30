"use client";

import type { ReceiptSnapshot } from "../landing-types";

import { MicroLabel, NeonCard } from "./shared";

export function ReceiptScreen({ receipt }: { receipt: ReceiptSnapshot }): JSX.Element {
  return (
    <div className="flex justify-center">
      <NeonCard className="w-full max-w-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MicroLabel>Purchase receipt</MicroLabel>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
            {receipt.status}
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <div className="h-52 rounded-xl bg-slate-900/80" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">Game cover art</p>
          </div>
          <div className="space-y-6">
            <div className="grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Amount paid</span>
                <p className="mt-2 text-lg font-semibold text-emerald-200">{receipt.amountLabel}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Order</span>
                <p className="mt-2 text-lg font-semibold text-slate-100">{receipt.orderId}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-200/70">Buyer ID</span>
                <p className="mt-2 break-all text-lg font-semibold text-slate-100">{receipt.buyerAccountId}</p>
              </div>
            </div>
            <NeonCard className="p-6">
              <MicroLabel>Next steps</MicroLabel>
              <p className="mt-3 text-sm text-slate-300">
                Jump back into {receipt.orderId.split("-")[0]} and share a first-party review with the crew.
              </p>
              <button
                type="button"
                className="mt-6 w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)]"
              >
                {receipt.nextStepLabel}
              </button>
            </NeonCard>
          </div>
        </div>
      </NeonCard>
    </div>
  );
}

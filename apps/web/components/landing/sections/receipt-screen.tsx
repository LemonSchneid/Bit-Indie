"use client";

import type { ReceiptSnapshot } from "../landing-types";

import { MicroLabel, NeonCard } from "./shared";

export function ReceiptScreen({ receipt }: { receipt: ReceiptSnapshot }): JSX.Element {
  return (
    <div className="flex justify-center">
      <NeonCard className="w-full max-w-3xl p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MicroLabel>Purchase receipt</MicroLabel>
          <span className="rounded-full border border-[#2dff85]/60 bg-[rgba(18,34,24,0.95)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#caffea]">
            {receipt.status}
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="rounded-2xl border border-[#2dff85]/35 bg-[radial-gradient(circle_at_top,_rgba(57,255,20,0.2),_transparent_70%)] p-4 shadow-[0_0_40px_rgba(57,255,20,0.28)]">
            <div className="h-52 rounded-xl bg-[rgba(15,15,15,0.9)]" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-[#7bffc8]/80">Game cover art</p>
          </div>
          <div className="space-y-6">
            <div className="grid gap-4 text-sm text-[#9fb5aa] sm:grid-cols-2">
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Amount paid</span>
                <p className="mt-2 text-lg font-semibold text-[#abffd9]">{receipt.amountLabel}</p>
              </div>
              <div>
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Order</span>
                <p className="mt-2 text-lg font-semibold text-white">{receipt.orderId}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.4em] text-[#7bffc8]/70">Buyer ID</span>
                <p className="mt-2 break-all text-lg font-semibold text-white">{receipt.buyerAccountId}</p>
              </div>
            </div>
            <NeonCard className="p-6">
              <MicroLabel>Next steps</MicroLabel>
              <p className="mt-3 text-sm text-[#8fa39a]">
                Jump back into {receipt.orderId.split("-")[0]} and share a first-party review with the crew.
              </p>
              <button
                type="button"
                className="mt-6 w-full rounded-full border border-[#2dff85]/70 bg-[rgba(18,34,24,0.95)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#d9ffe9] shadow-[0_0_30px_rgba(57,255,20,0.3)]"
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

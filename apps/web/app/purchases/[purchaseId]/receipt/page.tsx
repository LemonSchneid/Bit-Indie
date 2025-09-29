import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { InvoiceStatus, PurchaseReceipt } from "../../../../lib/api";
import { getPurchaseReceipt } from "../../../../lib/api";

type PurchaseReceiptPageProps = {
  params: {
    purchaseId: string;
  };
};

function formatSats(amountMsats: number | null): string {
  if (amountMsats == null) {
    return "—";
  }

  const sats = amountMsats / 1000;
  if (Number.isInteger(sats)) {
    return `${Number(sats).toLocaleString("en-US")} sats`;
  }

  return `${Number(sats).toLocaleString("en-US", { maximumFractionDigits: 3 })} sats`;
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) {
    return "—";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeStatus(
  status: InvoiceStatus,
  downloadGranted: boolean,
): { label: string; message: string; badgeClass: string } {
  switch (status) {
    case "PAID":
      return {
        label: "Payment received",
        message: downloadGranted
          ? "The download is unlocked for your account."
          : "Payment confirmed. The download will unlock shortly.",
        badgeClass: "border-emerald-400/60 bg-emerald-500/10 text-emerald-200",
      };
    case "EXPIRED":
      return {
        label: "Invoice expired",
        message: "This Lightning invoice expired before payment was detected.",
        badgeClass: "border-rose-400/60 bg-rose-500/10 text-rose-100",
      };
    case "REFUNDED":
      return {
        label: "Purchase refunded",
        message: "The payment was refunded. Future downloads are locked until you repurchase.",
        badgeClass: "border-sky-400/60 bg-sky-500/10 text-sky-100",
      };
    case "PENDING":
    default:
      return {
        label: "Awaiting payment",
        message: "Scan or pay the Lightning invoice to unlock your download.",
        badgeClass: "border-amber-400/60 bg-amber-400/10 text-amber-200",
      };
  }
}

function formatBuyerName(receipt: PurchaseReceipt["buyer"]): string {
  if (receipt.display_name) {
    return receipt.display_name;
  }

  const pubkey = receipt.pubkey_hex;
  if (pubkey.length <= 12) {
    return pubkey;
  }

  return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`;
}

export default async function PurchaseReceiptPage({
  params,
}: PurchaseReceiptPageProps): Promise<JSX.Element> {
  let receipt: PurchaseReceipt;
  try {
    receipt = await getPurchaseReceipt(params.purchaseId);
  } catch (error) {
    if (error instanceof Error && error.message === "Purchase not found.") {
      notFound();
    }

    throw error;
  }

  const { purchase, buyer, game } = receipt;
  const statusDetails = describeStatus(purchase.invoice_status, purchase.download_granted);
  const amountLabel = formatSats(purchase.amount_msats);
  const createdLabel = formatDateTime(purchase.created_at);
  const paidLabel = formatDateTime(purchase.paid_at);
  const buyerName = formatBuyerName(buyer);
  const gameUrl = `/games/${game.slug}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="space-y-10">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Lightning receipt</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {game.title} receipt
            </h1>
            <p className="max-w-2xl text-base text-slate-300">
              Thanks for supporting {game.title}. Save or bookmark this page—the link is your proof of purchase and lets you
              restore the download later.
            </p>
          </header>

          <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-emerald-500/10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Payment summary</p>
                    <p className="mt-1 text-sm text-slate-300">Receipt ID {purchase.id}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${statusDetails.badgeClass}`}
                  >
                    {statusDetails.label}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-200">{statusDetails.message}</p>

                <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Amount</dt>
                    <dd className="mt-2 text-lg font-semibold text-white">{amountLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Invoice ID</dt>
                    <dd className="mt-2 font-mono text-sm text-slate-200">{purchase.invoice_id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Issued</dt>
                    <dd className="mt-2 text-sm text-slate-200">{createdLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Payment detected</dt>
                    <dd className="mt-2 text-sm text-slate-200">{paidLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Download status</dt>
                    <dd className="mt-2 text-sm text-slate-200">
                      {purchase.download_granted ? "Unlocked for this account" : "Locked until payment is received"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Buyer</h2>
                <p className="mt-3 text-base text-white">{buyerName}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">{buyer.pubkey_hex}</p>
                <p className="mt-4 text-sm text-slate-300">
                  Anyone with this receipt link can re-open the download. Keep it handy in your password manager or browser
                  bookmarks.
                </p>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
                {game.cover_url ? (
                  <Image
                    src={game.cover_url}
                    alt={`${game.title} cover art`}
                    width={960}
                    height={540}
                    className="h-full w-full object-cover"
                    priority
                    unoptimized
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-500">
                    Cover art coming soon
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Next steps</h2>
                {purchase.invoice_status === "PAID" ? (
                  <p className="mt-3">
                    Head back to the game page to grab the latest build. If you paid as a guest, keep this receipt handy to
                    restore downloads on any device.
                  </p>
                ) : (
                  <p className="mt-3">
                    Pay the Lightning invoice from any compatible wallet. We&apos;ll unlock the download automatically once
                    payment is confirmed.
                  </p>
                )}
                <Link
                  href={gameUrl}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  View game page
                </Link>
                {game.build_available ? null : (
                  <p className="mt-3 text-xs text-slate-400">
                    The developer hasn&apos;t uploaded a downloadable build yet. You&apos;ll receive access as soon as it&apos;s
                    available.
                  </p>
                )}
              </div>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}

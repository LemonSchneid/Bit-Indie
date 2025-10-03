import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { InvoiceStatus, PurchaseReceipt } from "../../../../lib/api";
import { getPurchaseReceipt } from "../../../../lib/api";
import { ReceiptDownloadActions } from "./restore-download";
import { MatteShell } from "../../../../components/layout/matte-shell";

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
        badgeClass: "border-[#7bffc8]/60 bg-[#7bffc8]/15 text-white",
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
        badgeClass: "border-sky-400/60 bg-sky-500/15 text-sky-100",
      };
    case "PENDING":
    default:
      return {
        label: "Awaiting payment",
        message: "Scan or pay the Lightning invoice to unlock your download.",
        badgeClass: "border-amber-400/60 bg-amber-400/15 text-amber-200",
      };
  }
}

function formatBuyerName(receipt: PurchaseReceipt["buyer"]): string {
  if (receipt.display_name) {
    return receipt.display_name;
  }

  const identifier = receipt.account_identifier;
  if (identifier.length <= 12) {
    return identifier;
  }

  return `${identifier.slice(0, 8)}…${identifier.slice(-4)}`;
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
    <MatteShell containerClassName="mx-auto w-full max-w-4xl space-y-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Lightning receipt</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{game.title} receipt</h1>
        <p className="max-w-2xl text-base text-[#b8ffe5]/70">
          Thanks for supporting {game.title}. Save or bookmark this page—the link is your proof of purchase and lets you restore the download later.
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_45px_rgba(123,255,200,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Payment summary</p>
                <p className="mt-1 text-sm text-[#dcfff2]/80">Receipt ID {purchase.id}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${statusDetails.badgeClass}`}
              >
                {statusDetails.label}
              </span>
            </div>
            <p className="mt-4 text-sm text-[#f3fff9]/80">{statusDetails.message}</p>

            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Amount</dt>
                <dd className="mt-2 text-lg font-semibold text-white">{amountLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Invoice ID</dt>
                <dd className="mt-2 font-mono text-sm text-[#dcfff2]/80">{purchase.invoice_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Issued</dt>
                <dd className="mt-2 text-sm text-[#dcfff2]/80">{createdLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Payment detected</dt>
                <dd className="mt-2 text-sm text-[#dcfff2]/80">{paidLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Download status</dt>
                <dd className="mt-2 text-sm text-[#dcfff2]/80">
                  {purchase.download_granted ? "Unlocked for this account" : "Locked until payment is received"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Buyer</h2>
            <p className="mt-3 text-base text-white">{buyerName}</p>
            <p className="mt-1 font-mono text-xs text-[#b8ffe5]/60">{buyer.account_identifier}</p>
            <p className="mt-4 text-sm text-[#dcfff2]/80">
              Anyone with this receipt link can re-open the download. Keep it handy in your password manager or browser bookmarks.
            </p>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            {game.receipt_thumbnail_url || game.cover_url ? (
              <Image
                src={game.receipt_thumbnail_url ?? game.cover_url ?? ""}
                alt={`${game.title} receipt thumbnail`}
                width={960}
                height={540}
                className="h-full w-full object-cover"
                priority
                unoptimized
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] text-[#7bffc8]/60">
                Receipt art coming soon
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-[#dcfff2]/80">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Next steps</h2>
            <ReceiptDownloadActions
              purchaseId={purchase.id}
              invoiceStatus={purchase.invoice_status}
              downloadGranted={purchase.download_granted}
              buildAvailable={game.build_available}
            />
            <Link
              href={gameUrl}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-[#7bffc8]/60 bg-[#7bffc8]/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#7bffc8] hover:text-[#050505] hover:bg-[#7bffc8]/90"
            >
              View game page
            </Link>
          </div>
        </aside>
      </section>
    </MatteShell>
  );
}

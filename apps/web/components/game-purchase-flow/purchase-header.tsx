import type { FC } from "react";

type PurchaseHeaderProps = {
  gameTitle: string;
  priceLabel: string;
};

export const PurchaseHeader: FC<PurchaseHeaderProps> = ({ gameTitle, priceLabel }) => {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
          Purchase &amp; download
        </h2>
        <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-400/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-emerald-200">
          Lightning
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">
        Pay {priceLabel} with any Lightning wallet to unlock the current build of {gameTitle}.
      </p>
    </>
  );
};

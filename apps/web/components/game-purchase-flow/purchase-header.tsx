import type { FC } from "react";

type PurchaseHeaderProps = {
  gameTitle: string;
  priceLabel: string;
};

export const PurchaseHeader: FC<PurchaseHeaderProps> = ({ gameTitle, priceLabel }) => {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
          Purchase &amp; download
        </h2>
        <span className="inline-flex items-center rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-400/20 via-teal-400/10 to-cyan-500/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow shadow-emerald-500/20">
          Lightning
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-200">
        Pay {priceLabel} with any Lightning wallet to unlock the current build of {gameTitle}.
      </p>
    </>
  );
};

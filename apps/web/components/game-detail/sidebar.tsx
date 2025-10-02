import { GamePurchaseFlow } from "../game-purchase-flow";

type GameDetailSidebarProps = {
  hasPaidPrice: boolean;
  checkoutAvailable: boolean;
  priceLabel: string;
  buildAvailable: boolean;
  gameId: string;
  gameTitle: string;
  priceMsats: number | null;
  developerLightningAddress: string | null;
};

export function GameDetailSidebar({
  hasPaidPrice,
  checkoutAvailable,
  priceLabel,
  buildAvailable,
  gameId,
  gameTitle,
  priceMsats,
  developerLightningAddress,
}: GameDetailSidebarProps): JSX.Element {
  return (
    <aside className="space-y-5">
      {hasPaidPrice ? (
        checkoutAvailable ? (
          <GamePurchaseFlow
            gameId={gameId}
            gameTitle={gameTitle}
            priceMsats={priceMsats}
            priceLabel={priceLabel}
            buildAvailable={buildAvailable}
            developerLightningAddress={developerLightningAddress}
          />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-[#dcfff2]/80 shadow-[0_0_45px_rgba(123,255,200,0.08)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#7bffc8]/70">Checkout locked</h2>
            <p className="mt-3 text-sm text-[#f3fff9]/80">
              Lightning checkout opens once this listing is published. The developer can finish their launch checklist to make purchases available.
            </p>
          </div>
        )
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-[#dcfff2]/80 shadow-[0_0_45px_rgba(123,255,200,0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#7bffc8]/70">Free download</h2>
          <p className="mt-3 text-sm text-[#f3fff9]/80">
            This build will be shared for free once the developer uploads the files. Check back soon for the download link.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-[#dcfff2]/80 shadow-[0_0_45px_rgba(123,255,200,0.08)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#7bffc8]/70">Support the developer</h2>
        <p className="mt-3 text-sm text-[#f3fff9]/80">
          Share playtest notes or spread the word about {gameTitle} to help the team finish their next milestone. Lightning tips will return once direct creator tipping launches.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-[#dcfff2]/80 shadow-[0_0_45px_rgba(123,255,200,0.08)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#7bffc8]/70">Release status</h2>
        <p className="text-[#f3fff9]/80">
          Unlisted games are ready for direct sharing. Developers can finalize their launch checklist to move into the public catalog.
        </p>
        <div className="rounded-2xl border border-[#7bffc8]/40 bg-[#7bffc8]/10 p-4 text-[#f3fff9]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]">Visibility</p>
          <p className="mt-1 text-sm">
            Share this link with playtesters to gather feedback before promoting the game to the Discover feed.
          </p>
        </div>
      </div>
    </aside>
  );
}

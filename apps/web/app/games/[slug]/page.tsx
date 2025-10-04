import { notFound } from "next/navigation";

import { GameDetailDescription } from "../../../components/game-detail/description-section";
import { GameDetailHero } from "../../../components/game-detail/hero";
import { GameCommentsSection } from "../../../components/game-detail/comments-section";
import { GameDetailSidebar } from "../../../components/game-detail/sidebar";
import { MatteShell } from "../../../components/layout/matte-shell";
import {
  getGameBySlug,
  getGameComments,
  type GameComment,
  type GameDraft,
} from "../../../lib/api";
import {
  formatCategory,
  formatDateLabel,
  formatPriceMsats,
  formatStatus,
} from "../../../lib/format";

type GamePageProps = {
  params: {
    slug: string;
  };
};

export default async function GameDetailPage({ params }: GamePageProps) {
  let game: GameDraft;
  try {
    game = await getGameBySlug(params.slug);
  } catch (error) {
    if (error instanceof Error && error.message === "Game not found.") {
      notFound();
    }

    throw error;
  }

  const priceLabel = formatPriceMsats(game.price_msats);
  const updatedLabel = formatDateLabel(game.updated_at, { fallback: "Recently updated" });
  const statusLabel = formatStatus(game.status);
  const categoryLabel = formatCategory(game.category);
  const hasPaidPrice = game.price_msats != null && game.price_msats > 0;
  const buildAvailable = Boolean(game.build_object_key);
  const checkoutAvailable = hasPaidPrice && game.active;
  let comments: GameComment[] = [];
  let commentsError: string | null = null;

  try {
    comments = await getGameComments(game.id);
  } catch (error) {
    if (error instanceof Error && error.message === "Comments are not available for this game.") {
      comments = [];
    } else {
      commentsError =
        error instanceof Error
          ? error.message
          : "Unable to load community comments right now.";
    }
  }

  return (
    <MatteShell>
      <GameDetailHero
        title={game.title}
        summary={game.summary}
        statusLabel={statusLabel}
        categoryLabel={categoryLabel}
        heroUrl={game.hero_url}
        coverUrl={game.cover_url}
        priceLabel={priceLabel}
        updatedLabel={updatedLabel}
      />

      <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <GameDetailDescription description={game.description_md} />
        <GameDetailSidebar
          hasPaidPrice={hasPaidPrice}
          checkoutAvailable={checkoutAvailable}
          priceLabel={priceLabel}
          buildAvailable={buildAvailable}
          gameId={game.id}
          gameTitle={game.title}
          priceMsats={game.price_msats}
          developerLightningAddress={game.developer_lightning_address}
        />
      </section>

      <GameCommentsSection gameTitle={game.title} comments={comments} commentsError={commentsError} />
    </MatteShell>
  );
}

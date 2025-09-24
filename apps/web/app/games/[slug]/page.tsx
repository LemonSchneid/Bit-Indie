import { notFound } from "next/navigation";

import { GameDetailDescription } from "../../../components/game-detail/description-section";
import { GameDetailHero } from "../../../components/game-detail/hero";
import { GameCommentsSection } from "../../../components/game-detail/comments-section";
import { GameDetailSidebar } from "../../../components/game-detail/sidebar";
import { GameReviewsSection } from "../../../components/game-detail/reviews-section";
import {
  getGameBySlug,
  getGameComments,
  getGameReviews,
  type GameComment,
  type GameDraft,
  type GameReview,
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
  let reviews: GameReview[] = [];
  let reviewsError: string | null = null;

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

  try {
    reviews = await getGameReviews(game.id);
  } catch (error) {
    if (error instanceof Error && error.message === "Reviews are not available for this game.") {
      reviews = [];
    } else {
      reviewsError =
        error instanceof Error
          ? error.message
          : "Unable to load community reviews right now.";
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-20 w-full max-w-4xl bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-20 h-72 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
      <div className="absolute left-1/2 top-24 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <GameDetailHero
          title={game.title}
          summary={game.summary}
          statusLabel={statusLabel}
          categoryLabel={categoryLabel}
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

        <GameCommentsSection
          gameTitle={game.title}
          comments={comments}
          commentsError={commentsError}
        />

        <GameReviewsSection
          gameTitle={game.title}
          reviews={reviews}
          reviewsError={reviewsError}
        />
      </div>
    </main>
  );
}

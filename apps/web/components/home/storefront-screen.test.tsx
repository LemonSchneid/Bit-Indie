import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";

import {
  communityComments,
  discoverGames,
  featuredGames,
  gameDetails,
  liveMetrics,
} from "./data";
import { GameDetailScreen } from "./game-detail-screen";
import { PlatformRoadmapScreen } from "./platform-roadmap-screen";
import { StorefrontScreen } from "./storefront-screen";

test("storefront screen renders featured and discovery sections", () => {
  const html = renderToString(
    <StorefrontScreen
      featured={featuredGames}
      discover={discoverGames}
      metrics={liveMetrics}
      onGameSelect={() => undefined}
    />,
  );

  assert.ok(html.includes("Featured rotation"));
  assert.ok(html.includes(featuredGames[0]?.title ?? ""));
  assert.ok(html.includes(discoverGames[0]?.title ?? ""));
});

test("platform roadmap screen surfaces roadmap content", () => {
  const html = renderToString(<PlatformRoadmapScreen />);

  assert.ok(html.includes("Platform roadmap"));
  assert.ok(html.includes("Live right now"));
});

test("game detail screen lists community comments", () => {
  const [firstGame] = Object.values(gameDetails);
  const html = renderToString(
    <GameDetailScreen
      game={firstGame}
      comments={communityComments}
      onBack={() => undefined}
      onLaunchCheckout={() => undefined}
    />,
  );

  if (communityComments[0]) {
    assert.ok(html.includes(communityComments[0].body));
  }
});

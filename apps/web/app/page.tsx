"use client";

import { useState } from "react";

import {
  communityComments,
  discoverGames,
  featuredGames,
  gameDetails,
  liveMetrics,
  createPlaceholderGameDetail,
} from "../components/home/data";
import { GameDetailScreen } from "../components/home/game-detail-screen";
import { InfoForPlayersScreen } from "../components/home/info-for-players-screen";
import { LightningCheckoutModal } from "../components/home/lightning-checkout-modal";
import { NpubIdentityWidget } from "../components/home/npub-identity-widget";
import { PlatformRoadmapScreen } from "../components/home/platform-roadmap-screen";
import { ScreenSwitcher } from "../components/home/screen-switcher";
import { SellGameScreen } from "../components/home/sell-game-screen";
import { StorefrontScreen } from "../components/home/storefront-screen";
import type { GameDetail } from "../components/home/types";
import { MicroLabel } from "../components/home/ui";

export default function HomePage() {
  const [activeScreen, setActiveScreen] = useState(1);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleGameSelect = (title: string) => {
    const detail = gameDetails[title] ?? createPlaceholderGameDetail(title);
    setSelectedGame(detail);
    setShowCheckout(false);
    setActiveScreen(1);
  };

  const handleCloseDetail = () => {
    setSelectedGame(null);
    setShowCheckout(false);
  };

  const handleScreenSelect = (screen: number) => {
    setSelectedGame(null);
    setShowCheckout(false);
    setActiveScreen(screen);
  };

  const handleLaunchCheckout = () => {
    setShowCheckout(true);
  };

  const handleCloseCheckout = () => {
    setShowCheckout(false);
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-1/2 bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <MicroLabel>Proof of Play marketplace</MicroLabel>
              </div>
              <div className="mx-auto max-w-3xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl text-center">
                  Neon storefront for indie worlds powered by Lightning.
                </h1>
                <p className="mx-auto max-w-2xl text-sm uppercase tracking-[0.3em] text-emerald-200/80">
                  Browse featured drops, fund creators with instant zaps, and watch live metrics pulse in real time.
                </p>
              </div>
            </div>
            <NpubIdentityWidget />
          </div>
          <ScreenSwitcher activeScreen={activeScreen} onSelect={handleScreenSelect} />
        </header>
        <main className="space-y-10 pb-16">
          {selectedGame ? (
            <>
              <GameDetailScreen
                game={selectedGame}
                comments={communityComments}
                onBack={handleCloseDetail}
                onLaunchCheckout={handleLaunchCheckout}
              />
              {showCheckout ? <LightningCheckoutModal onClose={handleCloseCheckout} /> : null}
            </>
          ) : (
            <>
              {activeScreen === 1 && (
                <StorefrontScreen
                  featured={featuredGames}
                  discover={discoverGames}
                  metrics={liveMetrics}
                  onGameSelect={handleGameSelect}
                />
              )}
              {activeScreen === 2 && <SellGameScreen />}
              {activeScreen === 3 && <InfoForPlayersScreen />}
              {activeScreen === 4 && <PlatformRoadmapScreen />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

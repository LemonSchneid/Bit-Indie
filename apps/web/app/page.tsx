import { FeaturedRotation } from "../components/featured-rotation";
import { LoginCard } from "../components/login-card";
import { ZapButton } from "../components/zap-button";
import { getApiHealth, getFeaturedGames, getZapSummary } from "../lib/api";
import type { FeaturedGameSummary, ZapSummary } from "../lib/api";

type FeatureHighlight = {
  title: string;
  description: string;
};

type MilestoneCallout = {
  label: string;
  detail: string;
};

const featureHighlights: FeatureHighlight[] = [
  {
    title: "Creators own the storefront",
    description: "Publish builds, set Lightning prices, and broadcast updates straight from your Nostr identity.",
  },
  {
    title: "Players tap into open conversations",
    description: "Comments and reviews live on relays, with zap-enabled reputation that travels anywhere the notes are mirrored.",
  },
  {
    title: "Trust through transparent receipts",
    description: "Verified purchases, signed downloads, and refund controls keep both sides confident from launch day onward.",
  },
];

const milestoneCallouts: MilestoneCallout[] = [
  {
    label: "Milestone 1",
    detail: "NIP-07 login, profile claims, and the path to verified developers.",
  },
  {
    label: "Milestone 2",
    detail: "Lightning invoices, purchase polling, and instant download unlocks.",
  },
  {
    label: "Milestone 3",
    detail: "Comments, reviews, and zap-weighted ranking to surface the good stuff.",
  },
];

export default async function HomePage() {
  let isApiOnline = false;
  let apiMessage = "Unable to reach the backend API.";
  let featuredGames: FeaturedGameSummary[] = [];
  let featuredError: string | null = null;
  let zapSummary: ZapSummary | null = null;
  let zapError: string | null = null;

  const toErrorMessage = (reason: unknown, fallback: string): string =>
    reason instanceof Error ? reason.message : fallback;

  const [healthResult, featuredResult, zapResult] = await Promise.allSettled([
    getApiHealth(),
    getFeaturedGames(6),
    getZapSummary(),
  ]);

  if (healthResult.status === "fulfilled") {
    const health = healthResult.value;
    isApiOnline = health.status.toLowerCase() === "ok";
    apiMessage = isApiOnline
      ? "The backend API is responding normally."
      : `The API responded with "${health.status}".`;
  } else {
    apiMessage = toErrorMessage(healthResult.reason, apiMessage);
  }

  if (featuredResult.status === "fulfilled") {
    featuredGames = featuredResult.value;
  } else {
    featuredError = toErrorMessage(
      featuredResult.reason,
      "Featured games are still being selected. Please check back soon.",
    );
  }

  if (zapResult.status === "fulfilled") {
    zapSummary = zapResult.value;
  } else {
    zapError = toErrorMessage(zapResult.reason, "Zap activity is still loading.");
  }

  const totalDeveloperSats = zapSummary ? Math.floor(zapSummary.games.total_msats / 1000) : null;
  const forwardedDeveloperSats = zapSummary
    ? Math.floor(
        (zapSummary.games.source_totals.find((item) => item.source === "FORWARDED")?.total_msats ?? 0) /
          1000,
      )
    : null;
  const platformSats = zapSummary ? Math.floor(zapSummary.platform.total_msats / 1000) : null;
  const platformLnurl = zapSummary?.platform.lnurl ?? null;
  const topZapGames = zapSummary?.games.top_games ?? [];

  return (
    <main className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_65%)]" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16 sm:gap-20 sm:py-24">
        <section className="max-w-3xl space-y-6">
          <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Milestone 0 · Foundation in progress
          </span>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Launching the Nostr-native marketplace for indie games.
          </h1>
          <p className="text-lg text-slate-300">
            Proof of Play connects developers and players through Lightning payments and Nostr identity. The MVP focuses on
            discoverability, frictionless downloads, and conversations that live on the open web.
          </p>
          <p className="text-sm text-slate-400">
            Follow along as we wire up authentication, game publishing flows, and zap-powered reviews across the coming
            milestones.
          </p>
        </section>

        <section>
          {featuredGames.length > 0 ? (
            <FeaturedRotation entries={featuredGames} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Featured rotation warming up
                </span>
                <h2 className="text-xl font-semibold text-white">Spotlight coming soon</h2>
                <p className="text-sm text-slate-300">
                  {featuredError ??
                    "We promote games to the featured shelf once they earn verified reviews, keep refund rates healthy, and ship fresh updates."}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-emerald-500/5 backdrop-blur">
            <h2 className="text-xl font-semibold text-white">What we&apos;re building</h2>
            <ul className="mt-6 space-y-5 text-sm text-slate-300">
              {featureHighlights.map((item) => (
                <li key={item.title} className="rounded-2xl border border-white/5 bg-slate-900/40 p-5">
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">API status</h3>
              <p className={`mt-4 text-3xl font-semibold ${isApiOnline ? "text-emerald-400" : "text-rose-400"}`}>
                {isApiOnline ? "Online" : "Offline"}
              </p>
              <p className="mt-3 text-sm text-slate-300">{apiMessage}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Zap momentum</h3>
              {zapSummary ? (
                <>
                  <p className="mt-4 text-3xl font-semibold text-amber-300">
                    {totalDeveloperSats?.toLocaleString() ?? "0"} sats
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Players have zapped indie developers across Proof of Play.
                  </p>
                  {forwardedDeveloperSats && forwardedDeveloperSats > 0 ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Includes {forwardedDeveloperSats.toLocaleString()} sats forwarded through multi-hop payments.
                    </p>
                  ) : null}
                  {topZapGames.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Top recipients</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {topZapGames.map((entry) => {
                          const href = entry.slug ? `/games/${entry.slug}` : "#";
                          const totalSats = Math.floor(entry.total_msats / 1000);
                          return (
                            <li
                              key={entry.game_id}
                              className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3"
                            >
                              <a
                                href={href}
                                className="font-medium text-white transition hover:text-amber-200 hover:underline"
                              >
                                {entry.title}
                              </a>
                              <span>{totalSats.toLocaleString()} sats</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-5 rounded-2xl border border-white/5 bg-slate-950/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Platform support</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {platformSats !== null
                        ? `${platformSats.toLocaleString()} sats have been tipped to keep Proof of Play running.`
                        : "Help keep Proof of Play online with a quick zap."}
                    </p>
                    {platformLnurl ? (
                      <ZapButton
                        lnurl={platformLnurl}
                        recipientLabel="Proof of Play"
                        comment="Thanks for building the open marketplace!"
                        className="mt-3"
                      />
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">Platform zap address coming soon.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-300">{zapError ?? "Zap totals will appear once activity begins."}</p>
              )}
            </div>
            <LoginCard />
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Upcoming milestones</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {milestoneCallouts.map((callout) => (
                  <li key={callout.label} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{callout.label}</p>
                    <p className="mt-1 text-sm text-slate-300">{callout.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

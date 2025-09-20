import Link from "next/link";

import { FeaturedRotation } from "../components/featured-rotation";
import { LoginCard } from "../components/login-card";
import { ZapButton } from "../components/zap-button";
import { getApiHealth, getFeaturedGames, getZapSummary } from "../lib/api";
import type { FeaturedGameSummary, ZapSummary } from "../lib/api";

type FeatureHighlight = {
  title: string;
  description: string;
  icon: string;
};

type QuickStartItem = {
  title: string;
  detail: string;
};

type JourneyStep = {
  badge: string;
  title: string;
  description: string;
};

type MilestoneStatus = "shipped" | "in-progress";

type MilestoneCallout = {
  label: string;
  title: string;
  detail: string;
  status: MilestoneStatus;
};

const featureHighlights: FeatureHighlight[] = [
  {
    title: "Lightning-first checkout",
    description:
      "Spin up invoices, unlock downloads instantly, and let zaps roll in from any compatible wallet.",
    icon: "⚡",
  },
  {
    title: "Creators own their listings",
    description:
      "Draft games, upload builds, and publish once the checklist confirms covers, pricing, and downloadable builds.",
    icon: "🛠️",
  },
  {
    title: "Community-powered reputation",
    description:
      "Verified-purchase reviews and zap-weighted helpfulness keep the catalog fresh without locking feedback into a silo.",
    icon: "🌐",
  },
];

const creatorQuickstart: QuickStartItem[] = [
  {
    title: "Draft your listing",
    detail: "Create a game draft tied to your Nostr pubkey and add the high-level pitch.",
  },
  {
    title: "Upload builds & pricing",
    detail: "Attach downloadable builds, choose a category, and set sats for Lightning checkout.",
  },
  {
    title: "Publish with confidence",
    detail: "Checklist enforcement ensures every listing ships with a summary, cover, and verified download.",
  },
];

const creatorJourney: JourneyStep[] = [
  {
    badge: "Step 1",
    title: "Connect your Nostr identity",
    description: "Use NIP-07 sign-in to pull your pubkey into Proof of Play and unlock the creator tooling.",
  },
  {
    badge: "Step 2",
    title: "Build the draft",
    description:
      "Upload builds, artwork, and pricing in msats. The publish checklist keeps you honest about store-quality details.",
  },
  {
    badge: "Step 3",
    title: "Publish & iterate",
    description:
      "Go live once requirements are satisfied, then track purchases, refunds, and player sentiment in one place.",
  },
];

const playerJourney: JourneyStep[] = [
  {
    badge: "Step 1",
    title: "Browse Lightning-ready games",
    description:
      "Featured and discover shelves promote builds with healthy refund rates, fresh updates, and active zaps.",
  },
  {
    badge: "Step 2",
    title: "Checkout in seconds",
    description:
      "Lightning invoices unlock downloads as soon as they settle, and receipts stay tied to your Nostr identity.",
  },
  {
    badge: "Step 3",
    title: "Shape the conversation",
    description:
      "Post comments, leave verified-purchase reviews, and zap the content that deserves more visibility.",
  },
];

const milestoneCallouts: MilestoneCallout[] = [
  {
    label: "Milestone 1",
    title: "Creator onboarding",
    detail: "NIP-07 login, developer claims, and draft tooling are live so teams can ship builds.",
    status: "shipped",
  },
  {
    label: "Milestone 2",
    title: "Lightning checkout",
    detail: "LNbits invoices, webhook verification, and download gating keep purchases seamless.",
    status: "shipped",
  },
  {
    label: "Milestone 3",
    title: "Community feedback",
    detail: "Comments, verified-purchase reviews, and zap-weighted ranking are rolling out next.",
    status: "in-progress",
  },
];

function formatPriceMsats(value: number | null): string {
  if (value === null) {
    return "Free download";
  }

  const sats = value / 1000;
  if (Number.isInteger(sats)) {
    return `${Number(sats).toLocaleString()} sats`;
  }

  return `${Number(sats).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;
}

function formatRefundRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "Refund rate under 1%";
  }

  const bounded = Math.max(0, Math.min(rate, 1));
  const percentage = bounded * 100;
  const fractionDigits = percentage >= 10 ? 0 : 1;
  return `${percentage.toLocaleString(undefined, { maximumFractionDigits: fractionDigits })}% refund rate`;
}

function formatUpdatedAt(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently updated";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCategory(category: FeaturedGameSummary["game"]["category"]): string {
  switch (category) {
    case "PROTOTYPE":
      return "Prototype";
    case "EARLY_ACCESS":
      return "Early Access";
    case "FINISHED":
      return "Finished";
    default:
      return category.replaceAll("_", " ").toLowerCase();
  }
}

function formatStatus(status: FeaturedGameSummary["game"]["status"]): string {
  switch (status) {
    case "FEATURED":
      return "Featured";
    case "DISCOVER":
      return "Discover";
    case "UNLISTED":
      return "Unlisted preview";
    default:
      return status.toLowerCase();
  }
}

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
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_65%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.12),_transparent_60%)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-20 px-6 py-16 sm:py-24 lg:gap-24">
        <section className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Proof of Play · Lightning-native store
              </span>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Launch your indie game on a marketplace that speaks Nostr and Lightning.
              </h1>
              <p className="text-lg text-slate-200 lg:text-xl">
                Publish builds, price them in sats, and let the community power discovery through verified-purchase reviews and zap-weighted reputation.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {featureHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                    <span aria-hidden className="mr-2 text-lg">{highlight.icon}</span>
                    {highlight.title}
                  </p>
                  <p className="mt-3 text-sm text-slate-300">{highlight.description}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="space-y-6">
            <LoginCard />
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Creator quickstart</h2>
              <p className="mt-3 text-sm text-slate-300">
                Everything you need to open your storefront is already wired in. Follow the flow and you&apos;re ready to sell.
              </p>
              <ul className="mt-5 space-y-4 text-sm text-slate-200">
                {creatorQuickstart.map((item) => (
                  <li key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-xs text-slate-400">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Platform health</h3>
            <div className="mt-6 flex items-baseline gap-3">
              <span
                className={`inline-flex h-3 w-3 rounded-full ${
                  isApiOnline ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" : "bg-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.6)]"
                }`}
              />
              <p className={`text-2xl font-semibold ${isApiOnline ? "text-emerald-300" : "text-rose-300"}`}>
                {isApiOnline ? "API online" : "API offline"}
              </p>
            </div>
            <p className="mt-3 text-sm text-slate-300">{apiMessage}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Zap momentum</h3>
            {zapSummary ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-3xl font-semibold text-amber-300">{totalDeveloperSats?.toLocaleString() ?? "0"} sats</p>
                  <p className="mt-1 text-xs text-slate-400">Total tipped directly to developers.</p>
                  {forwardedDeveloperSats && forwardedDeveloperSats > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Includes {forwardedDeveloperSats.toLocaleString()} sats forwarded through multi-hop payments.
                    </p>
                  ) : null}
                </div>
                {topZapGames.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Top recipients</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {topZapGames.slice(0, 4).map((entry) => {
                        const href = entry.slug ? `/games/${entry.slug}` : "#";
                        const totalSats = Math.floor(entry.total_msats / 1000);
                        return (
                          <li
                            key={entry.game_id}
                            className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/70 px-4 py-3"
                          >
                            <Link
                              href={href}
                              className="font-medium text-white transition hover:text-amber-200 hover:underline"
                            >
                              {entry.title}
                            </Link>
                            <span>{totalSats.toLocaleString()} sats</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">{zapError ?? "Zap totals will appear once activity begins."}</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Support the platform</h3>
            <p className="mt-4 text-sm text-slate-300">
              {platformSats !== null
                ? `${platformSats.toLocaleString()} sats have been tipped to keep Proof of Play running.`
                : "Help keep Proof of Play online with a quick zap."}
            </p>
            {platformLnurl ? (
              <ZapButton
                lnurl={platformLnurl}
                recipientLabel="Proof of Play"
                comment="Thanks for building the open marketplace!"
                className="mt-5"
              />
            ) : (
              <p className="mt-5 text-xs text-slate-500">Platform zap address coming soon.</p>
            )}
          </div>
        </section>

        <section>
          {featuredGames.length > 0 ? (
            <FeaturedRotation entries={featuredGames} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur">
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">
                  Featured rotation warming up
                </span>
                <h2 className="text-xl font-semibold text-white">Spotlight coming soon</h2>
                <p className="text-sm text-slate-300">
                  {featuredError ??
                    "Games earn the featured slot once they deliver verified reviews, healthy refund performance, and recent updates."}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">
              Discover the catalog
            </span>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Built for the long tail of indie releases</h2>
            <p className="text-sm text-slate-300 sm:text-base">
              Featured listings highlight the full purchase and feedback loop—Lightning sales, refund telemetry, and community reviews.
            </p>
          </div>

          {featuredGames.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featuredGames.map((entry) => {
                const { game } = entry;
                const href = game.slug ? `/games/${game.slug}` : "#";
                const priceLabel = formatPriceMsats(game.price_msats);
                const refundLabel = formatRefundRate(entry.refund_rate);
                const updatedLabel = formatUpdatedAt(game.updated_at);
                const topStat = `${entry.paid_purchase_count.toLocaleString()} paid purchases`;
                const reviewStat = `${entry.verified_review_count.toLocaleString()} verified reviews`;

                return (
                  <article
                    key={game.id}
                    className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-lg shadow-emerald-500/5"
                  >
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
                      style={game.cover_url ? { backgroundImage: `url(${game.cover_url})` } : undefined}
                    />
                    <div className="relative flex h-full flex-col justify-between gap-6 p-6 backdrop-blur-sm">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200">
                          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                            {formatCategory(game.category)}
                          </span>
                          <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                            {priceLabel}
                          </span>
                          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{formatStatus(game.status)}</span>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-semibold text-white">{game.title}</h3>
                          <p className="text-sm text-slate-200">
                            {game.summary ?? "This developer is still crafting the perfect pitch—jump in to see the latest build."}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200">
                          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100">{topStat}</span>
                          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100">{reviewStat}</span>
                          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100">{refundLabel}</span>
                          <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100">Updated {updatedLabel}</span>
                        </div>
                        <Link
                          href={href}
                          className="inline-flex w-fit items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/15 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-emerald-200 hover:bg-emerald-400/25 hover:text-emerald-50"
                        >
                          View listing
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300 backdrop-blur">
              {featuredError ?? "Featured games will appear here once listings graduate from the publish checklist."}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 backdrop-blur">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex w-fit items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200">
                For creators
              </span>
              <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">A publishing pipeline tuned for small teams</h2>
              <p className="mt-3 text-sm text-slate-300">
                Proof of Play automates the boring parts—draft validation, pricing, and distribution—so you can focus on shipping playable builds.
              </p>
              <ul className="mt-6 space-y-4 text-sm text-slate-200">
                {creatorJourney.map((step) => (
                  <li key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{step.badge}</p>
                    <p className="mt-2 text-base font-semibold text-white">{step.title}</p>
                    <p className="mt-2 text-xs text-slate-400">{step.description}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="inline-flex w-fit items-center rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-200">
                For players
              </span>
              <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Transparent purchases and feedback loops</h2>
              <p className="mt-3 text-sm text-slate-300">
                Every purchase, review, and zap is tied to a verifiable action, letting communities rally around the games they love.
              </p>
              <ul className="mt-6 space-y-4 text-sm text-slate-200">
                {playerJourney.map((step) => (
                  <li key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{step.badge}</p>
                    <p className="mt-2 text-base font-semibold text-white">{step.title}</p>
                    <p className="mt-2 text-xs text-slate-400">{step.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">
              Roadmap snapshot
            </span>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Where the build is headed next</h2>
            <p className="text-sm text-slate-300 sm:text-base">
              We ship in tight iterations—every milestone locks in the flows that make Proof of Play feel like a real store.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {milestoneCallouts.map((callout) => (
              <div
                key={callout.label}
                className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200 backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{callout.label}</p>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${
                      callout.status === "shipped"
                        ? "border border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                        : "border border-amber-400/60 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {callout.status === "shipped" ? "Shipped" : "In progress"}
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold text-white">{callout.title}</p>
                <p className="mt-3 text-xs text-slate-400">{callout.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

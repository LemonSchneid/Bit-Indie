import Image from "next/image";

type GameDetailHeroProps = {
  title: string;
  summary: string | null;
  statusLabel: string;
  categoryLabel: string;
  coverUrl: string | null;
  priceLabel: string;
  updatedLabel: string;
};

export function GameDetailHero({
  title,
  summary,
  statusLabel,
  categoryLabel,
  coverUrl,
  priceLabel,
  updatedLabel,
}: GameDetailHeroProps): JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_65%)]" />
      <div className="absolute -right-32 top-1/2 -z-10 h-80 w-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.18),_transparent_70%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
            <span className="rounded-full border border-white/10 bg-slate-900/50 px-4 py-1">{statusLabel}</span>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-1 text-emerald-200">
              {categoryLabel}
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          {summary ? (
            <p className="max-w-2xl text-lg text-slate-200">{summary}</p>
          ) : (
            <p className="max-w-2xl text-lg text-slate-400">
              This game is still being prepared for its public launch.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 shadow shadow-emerald-500/10">
              {priceLabel}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              Updated {updatedLabel}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-lg shadow-emerald-500/10">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`${title} cover art`}
              width={1280}
              height={720}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-500">
              Cover art coming soon
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

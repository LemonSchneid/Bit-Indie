import Image from "next/image";

type GameDetailHeroProps = {
  title: string;
  summary: string | null;
  statusLabel: string;
  categoryLabel: string;
  heroUrl: string | null;
  coverUrl: string | null;
  priceLabel: string;
  updatedLabel: string;
};

export function GameDetailHero({
  title,
  summary,
  statusLabel,
  categoryLabel,
  heroUrl,
  coverUrl,
  priceLabel,
  updatedLabel,
}: GameDetailHeroProps): JSX.Element {
  const primaryImage = heroUrl ?? coverUrl;
  const altLabel = heroUrl ? `${title} hero art` : `${title} cover art`;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_55px_rgba(123,255,200,0.1)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(123,255,200,0.2),_transparent_65%)]" />
      <div className="absolute -right-32 top-1/2 -z-10 h-80 w-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,107,138,0.18),_transparent_70%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-[#7bffc8]/70">
            <span className="rounded-full border border-white/15 bg-[#060606]/80 px-4 py-1 text-white">{statusLabel}</span>
            <span className="rounded-full border border-[#7bffc8]/60 bg-[#7bffc8]/20 px-4 py-1 text-[#f3fff9]">
              {categoryLabel}
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          {summary ? (
            <p className="max-w-2xl text-lg text-[#f3fff9]/85">{summary}</p>
          ) : (
            <p className="max-w-2xl text-lg text-[#b8ffe5]/70">
              This game is still being prepared for its public launch.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#dcfff2]/75">
            <div className="rounded-2xl border border-[#7bffc8]/60 bg-[#7bffc8]/20 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_35px_rgba(123,255,200,0.2)]">
              {priceLabel}
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#f3fff9]/80">
              Updated {updatedLabel}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#060606]/90 shadow-[0_0_35px_rgba(123,255,200,0.07)]">
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={altLabel}
              width={1280}
              height={720}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center bg-gradient-to-br from-[#0f0f0f] via-[#121212] to-[#070707] text-[#7bffc8]/60">
              Showcase art coming soon
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

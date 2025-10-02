import Link from "next/link";

export default function GameNotFound() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
        <span className="rounded-full border border-white/10 bg-slate-900/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Game not found
        </span>
        <h1 className="text-4xl font-semibold text-white">This game isn&apos;t available yet.</h1>
        <p className="text-base text-slate-300">
          The listing you&apos;re looking for may still be in draft or the developer removed direct access. Check the catalog for
          other games or ask the developer for an updated link.
        </p>
        <Link
          href="/games"
          className="rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/20"
        >
          Back to catalog
        </Link>
      </div>
    </main>
  );
}

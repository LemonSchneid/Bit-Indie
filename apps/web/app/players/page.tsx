import Link from "next/link";

const gradientBackdrop =
  "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_55%)]";
const gradientAccent =
  "absolute inset-y-0 left-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_left,_rgba(59,130,246,0.12),_transparent_60%)]";
const cardClasses =
  "relative overflow-hidden rounded-3xl border border-emerald-500/15 bg-slate-950/60 p-6 shadow-[0_0_35px_rgba(16,185,129,0.18)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-emerald-500/15 before:opacity-60";

const highlights = [
  {
    title: "Lightning-fast checkout",
    body: "Pay with sats and receive your build instantly. Each invoice tracks status in real time so you can see confirmation within seconds.",
  },
  {
    title: "Verified downloads",
    body: "Every purchase unlocks a secure download link tied to your account. Revisit your library anytime to grab the latest build.",
  },
  {
    title: "Trusted reviews",
    body: "Player reviews are tagged when the reviewer has purchased the game, helping you separate real feedback from noise.",
  },
];

const faqs = [
  {
    question: "How do I start playing?",
    answer:
      "Browse the catalog, choose a game, and use the Lightning checkout flow. Your download key appears immediately after the invoice settles.",
  },
  {
    question: "What if my payment fails?",
    answer:
      "If a payment expires or fails, the chat crew can regenerate an invoice instantly. No funds are withdrawn until your wallet confirms the payment.",
  },
  {
    question: "Can I gift a game?",
    answer:
      "Yes. Purchase the build and forward the secure download link to a friend, or request a gift receipt directly from chat support.",
  },
];

export default function PlayersPage(): JSX.Element {
  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className={gradientBackdrop} />
      <div className={gradientAccent} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Info for Players</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Discover, purchase, and download Lightning-powered indie worlds.
          </h1>
          <p className="text-base text-slate-300">
            Bit Indie keeps the player journey fast and transparent. Learn how purchases work, what verified reviews mean, and where to go for help.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {highlights.map((highlight) => (
            <div className={cardClasses} key={highlight.title}>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">{highlight.title}</p>
                <p className="text-sm text-slate-200">{highlight.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className={cardClasses}>
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white">Frequently asked questions</h2>
            <dl className="space-y-5 text-sm text-slate-300">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/70">{faq.question}</dt>
                  <dd className="mt-2 text-sm text-slate-200">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={cardClasses}>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">Dive into the catalog</h2>
              <p className="text-sm text-slate-300">
                Ready to find your next favorite? Explore featured builds, read verified reviews, and support developers directly with Lightning.
              </p>
              <Link
                href="/games"
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)] transition hover:border-emerald-300 hover:text-emerald-50"
              >
                Browse the catalog
              </Link>
            </div>
          </div>
          <div className={cardClasses}>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">Need live help?</h2>
              <p className="text-sm text-slate-300">
                The Bit Indie crew is available during demo hours. Hop into chat for invoice troubleshooting, download resets, or feedback suggestions.
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-300 hover:text-emerald-50"
              >
                Open chat support
              </Link>
              <p className="text-xs text-slate-400">
                Prefer async? Email <a href="mailto:support@bitindie.dev" className="text-emerald-200 hover:text-emerald-100">support@bitindie.dev</a> and we will follow up within a day.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

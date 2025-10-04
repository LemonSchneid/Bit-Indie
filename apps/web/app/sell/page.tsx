import Link from "next/link";

import { MatteShell } from "../../components/layout/matte-shell";

const cardClasses =
  "relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-white/5 p-6 text-[#e8f9f1] shadow-[0_0_35px_rgba(123,255,200,0.12)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-emerald-500/20 before:opacity-60";

const setupSteps = [
  {
    title: "Upload your Lightning-ready build",
    description:
      "Package your executable or HTML bundle, include release notes, and upload through the developer console. We verify file integrity before publish.",
  },
  {
    title: "Set pricing and instant payouts",
    description:
      "Choose a Lightning price in sats, connect your preferred wallet address, and preview the checkout flow exactly how players will see it.",
  },
  {
    title: "Showcase screenshots and description",
    description:
      "Use our markdown editor to craft your pitch, add gallery media, and highlight the features that make your world stand out.",
  },
  {
    title: "Publish and monitor",
    description:
      "Go live in minutes. Track purchases, download counts, and verified reviews in real time from the Bit Indie dashboard.",
  },
];

export default function SellPage(): JSX.Element {
  return (
    <MatteShell>
      <header className="max-w-4xl space-y-4">
        <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Sell Your Game</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Launch your Lightning-ready build in minutes.
        </h1>
        <p className="text-base text-[#b8ffe5]/70">
          Bit Indie helps small teams move fast. Prepare your listing with the steps below, then go live to the full marketplace when you are ready.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {setupSteps.map((step) => (
          <div className={cardClasses} key={step.title}>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-[#7bffc8]/70">{step.title}</p>
              <p className="text-sm text-[#dcfff2]/80">{step.description}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className={cardClasses}>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">What we provide</h2>
            <ul className="space-y-4 text-sm text-[#dcfff2]/80">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#7bffc8]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-white">Instant payouts</p>
                  <p>Lightning invoices settle directly to your wallet with transparent status updates. Developers receive 85% of each sale; Bit Indie takes 15%.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#7bffc8]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-white">Sandbox-friendly tooling</p>
                  <p>
                    Publish multiple branches of your build, gate experimental features, and invite trusted playtesters before a full release.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#7bffc8]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-white">Community signal</p>
                  <p>
                    Verified reviews show which players purchased the build. Surface highlights on your catalog tile automatically.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div className={cardClasses}>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Ready to list?</h2>
            <p className="text-sm text-[#dcfff2]/80">
              Use the developer console to upload builds, manage pricing, and monitor live metrics as purchases come through the Lightning network.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-full border border-[#7bffc8]/70 bg-[#7bffc8]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#f3fff9] shadow-[0_0_24px_rgba(123,255,200,0.25)] transition hover:border-[#7bffc8] hover:text-white"
            >
              Open developer console
            </Link>
            <p className="text-xs text-[#b8ffe5]/60">
              Need onboarding help? Visit our <Link href="/community" className="text-[#7bffc8] hover:text-white">community page</Link> or email <a href="mailto:hello@bitindie.dev" className="text-[#7bffc8] hover:text-white">hello@bitindie.dev</a>.
            </p>
          </div>
        </div>
      </section>
    </MatteShell>
  );
}

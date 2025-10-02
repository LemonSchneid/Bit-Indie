import Link from "next/link";

import { ChatSupportPanel } from "../../components/chat/chat-support-panel";

const gradientBackdrop =
  "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.2),_transparent_55%)]";
const gradientAccent =
  "absolute inset-y-0 right-0 -z-10 w-full max-w-2xl bg-[radial-gradient(circle_at_right,_rgba(56,189,248,0.16),_transparent_60%)]";
const cardClasses =
  "relative overflow-hidden rounded-3xl border border-emerald-500/15 bg-slate-950/60 p-6 shadow-[0_0_35px_rgba(16,185,129,0.2)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-emerald-500/15 before:opacity-60";

export default function ChatPage(): JSX.Element {
  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className={gradientBackdrop} />
      <div className={gradientAccent} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="max-w-4xl space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Chat</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Connect with the Bit Indie crew in real time.
          </h1>
          <p className="text-base text-slate-300">
            Need help with a Lightning invoice, download link, or developer workflow? Our live chat team monitors this channel during demo hours.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <ChatSupportPanel />
          <aside className={cardClasses}>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">Other ways to reach us</h2>
              <ul className="space-y-4 text-sm text-slate-300">
                <li>
                  <p className="font-semibold text-white">Email</p>
                  <p>
                    Drop a note to <a href="mailto:support@bitindie.dev" className="text-emerald-200 hover:text-emerald-100">support@bitindie.dev</a> for anything that isn’t urgent. We reply within 24 hours.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-white">Release updates</p>
                  <p>
                    We post maintenance windows and Lightning node updates in the home page banner. Ask in chat if you need confirmation on a specific timeframe.
                  </p>
                </li>
                <li>
                  <p className="font-semibold text-white">Documentation</p>
                  <p>
                    Visit the <Link href="/players" className="text-emerald-200 hover:text-emerald-100">player guide</Link> or <Link href="/sell" className="text-emerald-200 hover:text-emerald-100">developer playbook</Link> for self-serve walkthroughs.
                  </p>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";

import { ChatSupportPanel } from "../../components/chat/chat-support-panel";
import { MatteShell } from "../../components/layout/matte-shell";

const cardClasses =
  "relative overflow-hidden rounded-3xl border border-[#7bffc8]/20 bg-white/5 p-6 text-[#e8f9f1] shadow-[0_0_35px_rgba(123,255,200,0.1)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#7bffc8]/20 before:opacity-60";

export default function ChatPage(): JSX.Element {
  return (
    <MatteShell>
      <header className="max-w-4xl space-y-4">
        <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Chat</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Connect with the Bit Indie crew in real time.
        </h1>
        <p className="text-base text-[#b8ffe5]/70">
          Need help with a Lightning invoice, download link, or developer workflow? Our live chat team monitors this channel during demo hours.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ChatSupportPanel />
        <aside className={cardClasses}>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Other ways to reach us</h2>
            <ul className="space-y-4 text-sm text-[#dcfff2]/80">
              <li>
                <p className="font-semibold text-white">Email</p>
                <p>
                  Drop a note to <a href="mailto:support@bitindie.dev" className="text-[#7bffc8] hover:text-white">support@bitindie.dev</a> for anything that isn’t urgent. We reply within 24 hours.
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
                  Visit the <Link href="/players" className="text-[#7bffc8] hover:text-white">player guide</Link> or <Link href="/sell" className="text-[#7bffc8] hover:text-white">developer playbook</Link> for self-serve walkthroughs.
                </p>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </MatteShell>
  );
}

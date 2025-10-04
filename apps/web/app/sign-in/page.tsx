import Link from "next/link";

import { AccountAccessWidget } from "../../components/auth/account-access-widget";
import { MatteShell } from "../../components/layout/matte-shell";
import { SIGN_IN_BENEFITS } from "../../components/auth/sign-in-benefits";

export default function SignInPage(): JSX.Element {
  return (
    <MatteShell>
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <header className="space-y-4">
            <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Account access</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Sign in to sync purchases, reviews, and moderation roles.
            </h1>
            <p className="max-w-3xl text-base text-[#b8ffe5]/70">
              Use your Bit Indie account to unlock downloads on any device, maintain verified reviews, and manage developer tools across
              environments. Prefer to stay anonymous? Continue as a guest from the widget and upgrade later without losing access.
            </p>
          </header>

          <section className="space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Why create an account?</h2>
            <ul className="space-y-4 text-sm text-[#dcfff2]/80">
              {SIGN_IN_BENEFITS.map((option) => (
                <li key={option.title} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_0_30px_rgba(123,255,200,0.08)]">
                  <p className="font-semibold text-white">{option.title}</p>
                  <p className="mt-2 text-xs text-[#9ef5d3]/80">{option.description}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#7bffc8]/70">
              Need help with your account? Visit the <Link className="underline decoration-[#7bffc8]/60 underline-offset-4 transition hover:text-white" href="/community">community page</Link> for updates and contact options.
            </p>
          </section>
        </div>

        <div className="flex justify-end lg:justify-center">
          <AccountAccessWidget />
        </div>
      </div>
    </MatteShell>
  );
}

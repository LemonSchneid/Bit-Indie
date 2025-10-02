import { AdminModerationQueue } from "../../../components/admin-moderation-queue";
import { MatteShell } from "../../../components/layout/matte-shell";

export default function ModerationPage(): JSX.Element {
  return (
    <MatteShell variant="developer" containerClassName="mx-auto w-full max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ff6b8a]">Developer dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Moderation command center</h1>
        <p className="text-sm text-[#ffc3d0]/75">
          Review flagged content, handle takedown requests, and manage community trust signals without leaving the neon-red deck.
        </p>
      </header>

      <AdminModerationQueue />
    </MatteShell>
  );
}

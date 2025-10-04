import { DeveloperDashboard } from "../../components/developer-console";
import { MatteShell } from "../../components/layout/matte-shell";

export default function AdminDashboardPage(): JSX.Element {
  return (
    <MatteShell variant="developer" containerClassName="mx-auto w-full max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ff6b8a]">Developer dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Developer console</h1>
        <p className="text-sm text-[#ffc3d0]/75">
          Manage Lightning-ready drafts, upload builds, and monitor publish readiness — all in one place.
        </p>
      </header>

      <DeveloperDashboard />
    </MatteShell>
  );
}

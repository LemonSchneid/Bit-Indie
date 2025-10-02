import { AdminIntegrityDashboard } from "../../../components/admin-integrity-dashboard";
import { MatteShell } from "../../../components/layout/matte-shell";

export default function AdminStatsPage(): JSX.Element {
  return (
    <MatteShell variant="developer" containerClassName="mx-auto w-full max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ff6b8a]">Developer dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Integrity metrics console</h1>
        <p className="text-sm text-[#ffc3d0]/75">
          Monitor live antifraud checks, Lightning payment integrity, and community safety signals in one neon-red control room.
        </p>
      </header>

      <AdminIntegrityDashboard />
    </MatteShell>
  );
}

"use client";

export function LoginCard(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Sign in</h3>
        <p className="mt-3 text-sm text-slate-300">
          Account sign-in is paused while Bit Indie transitions away from the legacy social stack. Guest checkout remains
          available for purchases, and receipts include everything you need to restore downloads later.
        </p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">For developers</h3>
        <p className="mt-3 text-sm text-slate-300">
          Want to publish on Bit Indie? Reach out to the team to enable your developer profile while we finish the updated
          account flow. You can still prepare builds locally using the dashboard once your access is provisioned.
        </p>
      </div>
    </div>
  );
}

const BADGE_TONE_CLASSES = {
  emerald: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  amber: "border-amber-400/40 bg-amber-500/15 text-amber-100",
} as const;

type ReviewBadgeTone = keyof typeof BADGE_TONE_CLASSES;

type ReviewBadgeProps = {
  label: string;
  tooltip: string;
  tone: ReviewBadgeTone;
  icon?: string;
};

export function ReviewBadge({ label, tooltip, tone, icon }: ReviewBadgeProps): JSX.Element {
  const toneClasses = BADGE_TONE_CLASSES[tone];

  return (
    <span
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${toneClasses}`}
      role="note"
      tabIndex={0}
    >
      {icon ? (
        <span aria-hidden className="text-sm leading-none">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-64 -translate-x-1/2 translate-y-2 rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-xs font-normal normal-case leading-relaxed text-slate-200 shadow-lg shadow-emerald-500/10 group-focus-visible:flex group-hover:flex">
        {tooltip}
      </span>
    </span>
  );
}

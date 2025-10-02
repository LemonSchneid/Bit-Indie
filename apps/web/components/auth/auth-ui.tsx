import type { ReactNode } from "react";

export function MicroLabel({ children }: { children: ReactNode }): JSX.Element {
  return <p className="text-[0.6rem] font-semibold uppercase tracking-[0.55em] text-[#69ffb0]/80">{children}</p>;
}

export function NeonCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border border-[#1f1f1f] bg-[rgba(9,9,9,0.92)] p-6 shadow-[0_0_45px_rgba(57,255,20,0.14)] backdrop-blur",
        "before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#2dff85]/15",
        "before:bg-[radial-gradient(circle_at_top,_rgba(57,255,20,0.09),_transparent_70%)] before:opacity-70",
        className,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

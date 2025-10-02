import { ReactNode } from "react";

type MatteShellProps = {
  children: ReactNode;
  /**
   * Controls the accent palette used in the matte gradients.
   * The developer dashboard uses the "developer" accent to stand out in neon red hues.
   */
  variant?: "default" | "developer";
  /**
   * Optional additional classes applied to the outer <main> element.
   */
  className?: string;
  /**
   * Overrides the default container spacing wrapper when pages need custom layouts.
   */
  containerClassName?: string;
};

const BASE_MAIN_CLASSES =
  "relative min-h-screen overflow-hidden bg-[#050505] text-[#e8f9f1] transition-colors duration-300";

const DEFAULT_CONTAINER_CLASSES = "mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16";

const DEFAULT_OVERLAYS = [
  "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(89,255,163,0.12),_transparent_60%)]",
  "absolute inset-0 -z-20 bg-[conic-gradient(from_140deg_at_10%_20%,_rgba(10,10,10,0.9),_rgba(57,255,20,0.04),_rgba(10,10,10,0.9))]",
  "absolute inset-y-0 right-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_right,_rgba(57,255,20,0.08),_transparent_65%)]",
];

const DEVELOPER_OVERLAYS = [
  "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,82,116,0.18),_transparent_62%)]",
  "absolute inset-0 -z-20 bg-[conic-gradient(from_150deg_at_12%_18%,_rgba(10,10,10,0.92),_rgba(255,0,128,0.08),_rgba(10,10,10,0.9))]",
  "absolute inset-y-0 right-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_right,_rgba(255,64,64,0.14),_transparent_60%)]",
];

export function MatteShell({
  children,
  variant = "default",
  className = "",
  containerClassName = DEFAULT_CONTAINER_CLASSES,
}: MatteShellProps): JSX.Element {
  const overlays = variant === "developer" ? DEVELOPER_OVERLAYS : DEFAULT_OVERLAYS;
  const composedMainClassName = [BASE_MAIN_CLASSES, className].filter(Boolean).join(" ");

  return (
    <main className={composedMainClassName}>
      {overlays.map((overlayClass, index) => (
        <div className={overlayClass} aria-hidden key={overlayClass ?? index} />
      ))}
      <div className={`relative ${containerClassName}`}>{children}</div>
    </main>
  );
}

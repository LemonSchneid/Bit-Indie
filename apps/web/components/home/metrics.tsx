import type { ReactNode } from "react";

import { cn } from "./utils";

type MetricRowVariant = "default" | "compact";

type MetricRowProps = {
  label: string;
  value: ReactNode;
  variant?: MetricRowVariant;
  className?: string;
};

const variantClasses: Record<MetricRowVariant, { container: string; label: string; value: string }> = {
  default: {
    container: "flex items-center justify-between",
    label: "uppercase tracking-[0.35em] text-emerald-200/70",
    value: "font-semibold text-emerald-200",
  },
  compact: {
    container: "flex justify-between",
    label: "uppercase tracking-[0.4em] text-emerald-200/70",
    value: "font-semibold text-emerald-200",
  },
};

export function MetricRow({ label, value, variant = "default", className }: MetricRowProps) {
  const styles = variantClasses[variant];

  return (
    <div className={cn(styles.container, className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

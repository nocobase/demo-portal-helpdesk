import type { ReactNode } from "react";

import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#0ea5e9",
];

export function AnalyticsHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-3">
      <div className="text-muted-foreground"><Breadcrumb /></div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.035em]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  loading,
  tone = "default",
}: {
  label: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <section className={cn(
      "rounded-xl border bg-card p-4 shadow-sm",
      tone === "danger" && "border-red-300/60 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5",
      tone === "success" && "border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5",
    )}>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary [&_svg]:size-4">{icon}</span>
      </div>
      {loading ? <Skeleton className="mt-3 h-9 w-24" /> : <div className="mt-2 text-3xl font-semibold tracking-tight">{value ?? "—"}</div>}
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </section>
  );
}

export function ChartCard({ title, description, children, className }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const shortNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);


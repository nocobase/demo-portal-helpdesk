import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bug, CircleHelp, CreditCard, Lightbulb, UserRound } from "lucide-react";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type SlaState,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "./lib";

const statusStyles: Record<TicketStatus, string> = {
  open: "border-blue-300/60 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
  in_progress:
    "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  resolved:
    "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  closed:
    "border-border bg-muted text-muted-foreground",
};

const statusDotStyles: Record<TicketStatus, string> = {
  open: "bg-blue-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  closed: "bg-muted-foreground",
};

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 gap-1.5 shadow-none", statusStyles[status], className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", statusDotStyles[status])}
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const priorityStyles: Record<TicketPriority, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium:
    "border-cyan-300/60 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-300",
  high: "border-orange-300/60 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300",
  urgent:
    "border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 shadow-none", priorityStyles[priority], className)}
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

const slaConfig: Record<
  SlaState,
  { label: string; className: string }
> = {
  overdue: {
    label: "Overdue",
    className:
      "border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  },
  due_soon: {
    label: "Due soon",
    className:
      "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  },
  on_track: {
    label: "On track",
    className:
      "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  no_deadline: {
    label: "No deadline",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function SlaBadge({
  state,
  detail,
  className,
}: {
  state: SlaState;
  detail?: string;
  className?: string;
}) {
  const config = slaConfig[state];
  return (
    <Badge
      variant="outline"
      className={cn("h-6 shadow-none", config.className, className)}
    >
      {config.label}
      {detail ? <span className="font-normal opacity-80">· {detail}</span> : null}
    </Badge>
  );
}

export function CategoryBadge({
  category,
  className,
}: {
  category?: TicketCategory | null;
  className?: string;
}) {
  if (!category) return <span className="text-muted-foreground">-</span>;
  const Icon = {
    bug: Bug,
    question: CircleHelp,
    feature_request: Lightbulb,
    account: UserRound,
    billing: CreditCard,
    other: CircleHelp,
  }[category];
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 border-border bg-card text-foreground shadow-none",
        className
      )}
    >
      <Icon className="size-3" />
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

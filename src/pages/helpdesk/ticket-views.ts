import type { CrudFilter, CrudFilters, CrudSorting } from "@refinedev/core";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClockOff,
  CheckCircle2,
  History,
  Inbox,
  MessageSquareDashed,
  UserRoundX,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { ACTIVE_STATUSES } from "./lib";

export type TicketViewId =
  | "all"
  | "team_open"
  | "unassigned"
  | "my_open"
  | "awaiting_reply"
  | "breaching"
  | "urgent"
  | "solved_today"
  | "recently_updated";

export type TicketViewContext = {
  /** The signed-in agent, when identity has resolved. */
  userId?: number;
  now: Date;
};

export type TicketView = {
  id: TicketViewId;
  i18nKey: string;
  fallback: string;
  descriptionI18nKey: string;
  descriptionFallback: string;
  icon: LucideIcon;
  tone?: "danger" | "warning" | "success";
  /** Views that make no sense before identity resolves are hidden until it does. */
  requiresIdentity?: boolean;
  buildFilters: (context: TicketViewContext) => CrudFilters;
  sorters: CrudSorting;
};

const startOfDay = (now: Date) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (now: Date) => {
  const date = new Date(now);
  date.setHours(23, 59, 59, 999);
  return date;
};

const activeFilter: CrudFilter = {
  field: "status",
  operator: "in",
  value: ACTIVE_STATUSES,
};

/**
 * The saved views a support desk actually works out of. Zendesk ships almost
 * exactly this set out of the box ("Unassigned tickets", "Your unsolved
 * tickets", "Recently updated"), because an agent's day is a walk through
 * these queues rather than an ad-hoc filter each time.
 */
export const TICKET_VIEWS: TicketView[] = [
  {
    id: "all",
    i18nKey: "tickets.views.all",
    fallback: "All tickets",
    descriptionI18nKey: "tickets.views.allDescription",
    descriptionFallback: "Every ticket in the desk, newest activity first.",
    icon: Inbox,
    buildFilters: () => [],
    sorters: [{ field: "updatedAt", order: "desc" }],
  },
  {
    id: "team_open",
    i18nKey: "tickets.views.teamOpen",
    fallback: "Open tickets",
    descriptionI18nKey: "tickets.views.teamOpenDescription",
    descriptionFallback: "Every open and in-progress ticket across the desk.",
    icon: Inbox,
    buildFilters: () => [activeFilter],
    sorters: [{ field: "resolution_due_at", order: "asc" }],
  },
  {
    id: "unassigned",
    i18nKey: "tickets.views.unassigned",
    fallback: "Unassigned",
    descriptionI18nKey: "tickets.views.unassignedDescription",
    descriptionFallback:
      "Active tickets nobody has picked up yet — the first queue to clear each morning.",
    icon: UserRoundX,
    tone: "warning",
    // NocoBase's filter parser answers "has no value" through an explicit null
    // comparison; its `$null` operator returns an empty set here.
    buildFilters: () => [
      activeFilter,
      { field: "assigneeId", operator: "eq", value: null },
    ],
    sorters: [{ field: "createdAt", order: "asc" }],
  },
  {
    id: "my_open",
    i18nKey: "tickets.views.myOpen",
    fallback: "My open tickets",
    descriptionI18nKey: "tickets.views.myOpenDescription",
    descriptionFallback: "Everything currently assigned to you and still moving.",
    icon: Inbox,
    requiresIdentity: true,
    buildFilters: ({ userId }) => [
      activeFilter,
      { field: "assigneeId", operator: "eq", value: userId ?? -1 },
    ],
    sorters: [{ field: "resolution_due_at", order: "asc" }],
  },
  {
    id: "awaiting_reply",
    i18nKey: "tickets.views.awaitingReply",
    fallback: "Awaiting first reply",
    descriptionI18nKey: "tickets.views.awaitingReplyDescription",
    descriptionFallback:
      "The customer has written and nobody has answered yet — the first-response clock is running.",
    icon: MessageSquareDashed,
    tone: "warning",
    buildFilters: () => [
      activeFilter,
      { field: "first_responded_at", operator: "eq", value: null },
    ],
    sorters: [{ field: "response_due_at", order: "asc" }],
  },
  {
    id: "breaching",
    i18nKey: "tickets.views.breaching",
    fallback: "Breaching SLA",
    descriptionI18nKey: "tickets.views.breachingDescription",
    descriptionFallback:
      "Active tickets already past their resolution deadline. Escalate or re-plan these first.",
    icon: AlarmClockOff,
    tone: "danger",
    buildFilters: ({ now }) => [
      activeFilter,
      {
        field: "resolution_due_at",
        operator: "lt",
        value: now.toISOString(),
      },
    ],
    sorters: [{ field: "resolution_due_at", order: "asc" }],
  },
  {
    id: "urgent",
    i18nKey: "tickets.views.urgent",
    fallback: "Urgent & high",
    descriptionI18nKey: "tickets.views.urgentDescription",
    descriptionFallback: "The top two priority tiers, still unresolved.",
    icon: Zap,
    tone: "danger",
    buildFilters: () => [
      activeFilter,
      { field: "priority", operator: "in", value: ["urgent", "high"] },
    ],
    sorters: [{ field: "resolution_due_at", order: "asc" }],
  },
  {
    id: "solved_today",
    i18nKey: "tickets.views.solvedToday",
    fallback: "Solved today",
    descriptionI18nKey: "tickets.views.solvedTodayDescription",
    descriptionFallback: "Tickets the team resolved since midnight.",
    icon: CheckCircle2,
    tone: "success",
    buildFilters: ({ now }) => [
      {
        field: "resolved_at",
        operator: "between",
        value: [startOfDay(now).toISOString(), endOfDay(now).toISOString()],
      },
    ],
    sorters: [{ field: "resolved_at", order: "desc" }],
  },
  {
    id: "recently_updated",
    i18nKey: "tickets.views.recentlyUpdated",
    fallback: "Recently updated",
    descriptionI18nKey: "tickets.views.recentlyUpdatedDescription",
    descriptionFallback: "Anything touched in the last 24 hours.",
    icon: History,
    buildFilters: ({ now }) => [
      {
        field: "updatedAt",
        operator: "gte",
        value: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    sorters: [{ field: "updatedAt", order: "desc" }],
  },
];

export const findTicketView = (id: string | null | undefined) =>
  TICKET_VIEWS.find((view) => view.id === id) ?? TICKET_VIEWS[0];

const OPERATOR_MAP: Record<string, string> = {
  eq: "$eq",
  ne: "$ne",
  lt: "$lt",
  gt: "$gt",
  lte: "$lte",
  gte: "$gte",
  in: "$in",
  nin: "$notIn",
  contains: "$includes",
  startswith: "$startsWith",
  endswith: "$endsWith",
  null: "$null",
  nnull: "$notNull",
  between: "$between",
};

/**
 * Mirrors the Portal data provider's filter translation so the same view
 * definition can drive both the Refine table and the aggregate count queries
 * that feed the view tabs.
 */
export const toNocoBaseFilter = (
  filters: CrudFilters
): Record<string, unknown> | undefined => {
  const items = filters.flatMap((filter) => {
    if ("field" in filter) {
      const operator = OPERATOR_MAP[filter.operator] ?? "$eq";
      return [{ [filter.field]: { [operator]: filter.value } }];
    }
    const nested = toNocoBaseFilter(filter.value);
    if (!nested) return [];
    return [{ [`$${filter.operator}`]: nested.$and ?? [nested] }];
  });
  if (!items.length) return undefined;
  return items.length === 1 ? items[0] : { $and: items };
};

type CountRow = { n: number };

/**
 * Counts for every view badge in one hook. Each view is its own cheap
 * aggregate call, cached by react-query and bucketed to the hour so the
 * time-relative views (breaching, recently updated) do not refetch on every
 * render tick.
 */
export const useTicketViewCounts = (userId?: number) => {
  const now = new Date();
  const bucket = now.toISOString().slice(0, 13);

  return useQuery({
    queryKey: ["tickets", "view-counts", bucket, userId ?? null],
    queryFn: async () => {
      const entries = await Promise.all(
        TICKET_VIEWS.map(async (view) => {
          if (view.requiresIdentity && !userId) return [view.id, null] as const;
          const rows = await nocobaseClient.action<CountRow[]>(
            "desk_tickets",
            "query",
            {
              body: {
                measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
                filter: toNocoBaseFilter(view.buildFilters({ userId, now })),
              },
            }
          );
          return [view.id, rows[0]?.n ?? 0] as const;
        })
      );
      return Object.fromEntries(entries) as Record<
        TicketViewId,
        number | null
      >;
    },
  });
};

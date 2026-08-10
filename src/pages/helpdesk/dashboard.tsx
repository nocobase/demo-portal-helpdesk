import { useQuery } from "@tanstack/react-query";
import { useGetIdentity, useTranslate } from "@refinedev/core";
import { Outlet, useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  MessageSquareDashed,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import {
  BuildStoryBanner,
  type BuildStory,
} from "@/components/build-story/build-story-banner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { ChartCard } from "./analytics-ui";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "./badges";
import { useOpenContextualChild } from "./route-surfaces";
import {
  ACTIVE_STATUSES,
  agentDisplayName,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  localToday,
  translateTicketPriority,
  translateTicketStatus,
  TICKET_STATUSES,
  type AgentRef,
  type TicketRecord,
  type TicketStatus,
  type TicketPriority,
} from "./lib";
import { AGING_BUCKETS, agingBucketOf } from "./sla-metrics";
import { useNow } from "./use-now";
import { findTicketView, toNocoBaseFilter } from "./ticket-views";

// How this portal was built — effective (active) time, derived from the build's
// git commit bursts. Shown in the pinned banner on the dashboard.
const BUILD_STORY: BuildStory = {
  models: ["GPT-5.6 sol", "Opus 4.8"],
  moduleCount: 5,
  moduleLabelKey: "buildStory.modules",
  tracks: [
    { labelKey: "buildStory.phase.scaffold", models: ["GPT-5.6 sol"], start: 0, minutes: 20 },
    { labelKey: "buildStory.phase.style", models: ["Opus 4.8"], start: 20, minutes: 10 },
    { labelKey: "buildStory.phase.enrich", models: ["Opus 4.8"], start: 30, minutes: 15 },
    { labelKey: "buildStory.phase.finalize", models: ["Opus 4.8"], start: 45, minutes: 5 },
  ],
};

type CountRow = { n: number };
type StatusRow = { n: number; status: TicketStatus };
type AgentLoadRow = { n: number; assigneeId: number | null };

const PRIORITY_ORDER: TicketPriority[] = ["urgent", "high", "medium", "low"];

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#06b6d4",
  low: "#94a3b8",
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "var(--chart-1)",
  in_progress: "var(--chart-2)",
  resolved: "var(--chart-3)",
  closed: "var(--chart-4)",
};

const queryCount = (filter?: Record<string, unknown>) =>
  nocobaseClient.action<CountRow[]>("desk_tickets", "query", {
    body: {
      measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
      filter,
    },
  });

/**
 * The agent workspace. It answers three questions in order: what is on fire
 * across the desk, what is on my plate today, and where the backlog is quietly
 * ageing. Every headline number is a link into the ticket list filtered the
 * same way, so nothing here is a dead end.
 */
export function DashboardPage() {
  const translate = useTranslate();
  const navigate = useNavigate();
  const openChild = useOpenContextualChild();
  const { data: identity } = useGetIdentity<AgentRef & { id: number }>();
  const nowTick = useNow();
  const now = new Date(nowTick);
  const nowIso = now.toISOString();
  const hourBucket = nowIso.slice(0, 13);

  const openQuery = useQuery({
    queryKey: ["dashboard", "open", "team_open"],
    queryFn: () => {
      const view = findTicketView("team_open");
      return queryCount(
        toNocoBaseFilter(view.buildFilters({ now: new Date() }))
      ).then((rows) => rows[0]?.n ?? 0);
    },
  });
  const overdueQuery = useQuery({
    queryKey: ["dashboard", "overdue", hourBucket],
    queryFn: () =>
      queryCount({
        status: { $in: ACTIVE_STATUSES },
        resolution_due_at: { $lt: nowIso },
      }).then((rows) => rows[0]?.n ?? 0),
  });
  const awaitingQuery = useQuery({
    queryKey: ["dashboard", "awaiting"],
    queryFn: () =>
      queryCount({
        status: { $in: ACTIVE_STATUSES },
        first_responded_at: { $eq: null },
      }).then((rows) => rows[0]?.n ?? 0),
  });
  const resolvedTodayQuery = useQuery({
    queryKey: ["dashboard", "resolved-today", localToday()],
    queryFn: () =>
      queryCount({ resolved_at: { $dateOn: localToday() } }).then(
        (rows) => rows[0]?.n ?? 0
      ),
  });
  const byStatusQuery = useQuery({
    queryKey: ["dashboard", "by-status"],
    queryFn: () =>
      nocobaseClient.action<StatusRow[]>("desk_tickets", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [{ field: ["status"], alias: "status" }],
        },
      }),
  });
  const agentLoadQuery = useQuery({
    queryKey: ["dashboard", "agent-load"],
    queryFn: () =>
      nocobaseClient.action<AgentLoadRow[]>("desk_tickets", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [{ field: ["assigneeId"], alias: "assigneeId" }],
          filter: { status: { $in: ACTIVE_STATUSES } },
          orders: [{ field: ["n"], alias: "n", order: "desc" }],
        },
      }),
  });
  const agentsQuery = useQuery({
    queryKey: ["dashboard", "agents"],
    queryFn: () =>
      nocobaseClient.action<AgentRef[]>("users", "list", {
        query: { pageSize: 100 },
      }),
  });

  // The whole active backlog, fetched once and sliced locally for the ageing
  // and queue charts. Three hundred rows of five fields is cheaper than three
  // separate grouped aggregates and keeps the charts consistent with each other.
  const backlogQuery = useQuery({
    queryKey: ["dashboard", "backlog"],
    queryFn: () =>
      nocobaseClient.action<TicketRecord[]>("desk_tickets", "list", {
        query: {
          page: 1,
          pageSize: 300,
          filter: JSON.stringify({ status: { $in: ACTIVE_STATUSES } }),
          sort: "resolution_due_at",
          "appends[]": ["assignee", "queue"],
        },
      }),
  });

  const backlog = backlogQuery.data ?? [];
  const total = byStatusQuery.data?.reduce((sum, row) => sum + row.n, 0) ?? 0;

  const mine = identity?.id
    ? backlog.filter((ticket) => ticket.assigneeId === identity.id)
    : [];
  const myOverdue = mine.filter(
    (ticket) => getSlaState(ticket, now) === "overdue"
  ).length;
  const myDueSoon = mine.filter(
    (ticket) => getSlaState(ticket, now) === "due_soon"
  ).length;

  const aging = AGING_BUCKETS.map((bucket) => {
    const inBucket = backlog.filter(
      (ticket) => agingBucketOf(ticket, now) === bucket.id
    );
    const entry: Record<string, string | number> = {
      name: translate(bucket.i18nKey, { ns: "starter" }, bucket.fallback),
    };
    for (const priority of PRIORITY_ORDER) {
      entry[priority] = inBucket.filter(
        (ticket) => ticket.priority === priority
      ).length;
    }
    return entry;
  });

  const queueBacklog = (() => {
    const grouped = new Map<string, Record<string, number>>();
    for (const ticket of backlog) {
      const name =
        ticket.queue?.name ??
        translate("queues.unrouted", { ns: "starter" }, "Unrouted");
      const entry =
        grouped.get(name) ??
        Object.fromEntries(PRIORITY_ORDER.map((priority) => [priority, 0]));
      entry[ticket.priority] = (entry[ticket.priority] ?? 0) + 1;
      grouped.set(name, entry);
    }
    return [...grouped]
      .map(([name, counts]) => ({
        name,
        ...counts,
        total: PRIORITY_ORDER.reduce(
          (sum, priority) => sum + (counts[priority] ?? 0),
          0
        ),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  })();

  const watchlist = backlog
    .filter((ticket) => getSlaState(ticket, now) !== "on_track")
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <BuildStoryBanner story={BUILD_STORY} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center text-muted-foreground">
          <Breadcrumb />
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.035em]">
            {translate("navigation.dashboard", { ns: "starter" }, "Dashboard")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {translate(
              "dashboard.description",
              { ns: "starter" },
              "What needs attention in the queue right now."
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={translate("dashboard.kpi.openTickets", { ns: "starter" }, "Open tickets")}
          value={openQuery.data}
          loading={openQuery.isLoading}
          icon={<Inbox />}
          onClick={() => navigate("/tickets?view=team_open")}
          actionLabel={translate(
            "dashboard.kpi.drilldown",
            { ns: "starter" },
            "Open in the ticket list"
          )}
        />
        <KpiCard
          label={translate("dashboard.kpi.overdue", { ns: "starter" }, "Overdue")}
          value={overdueQuery.data}
          loading={overdueQuery.isLoading}
          icon={<AlertTriangle />}
          tone={(overdueQuery.data ?? 0) > 0 ? "danger" : undefined}
          onClick={() => navigate("/tickets?view=breaching")}
          actionLabel={translate(
            "dashboard.kpi.drilldown",
            { ns: "starter" },
            "Open in the ticket list"
          )}
        />
        <KpiCard
          label={translate(
            "dashboard.kpi.awaitingReply",
            { ns: "starter" },
            "Awaiting first reply"
          )}
          value={awaitingQuery.data}
          loading={awaitingQuery.isLoading}
          icon={<MessageSquareDashed />}
          tone={(awaitingQuery.data ?? 0) > 0 ? "danger" : undefined}
          onClick={() => navigate("/tickets?view=awaiting_reply")}
          actionLabel={translate(
            "dashboard.kpi.drilldown",
            { ns: "starter" },
            "Open in the ticket list"
          )}
        />
        <KpiCard
          label={translate(
            "dashboard.kpi.resolvedToday",
            { ns: "starter" },
            "Resolved today"
          )}
          value={resolvedTodayQuery.data}
          loading={resolvedTodayQuery.isLoading}
          icon={<CheckCircle2 />}
          tone="success"
          onClick={() => navigate("/tickets?view=solved_today")}
          actionLabel={translate(
            "dashboard.kpi.drilldown",
            { ns: "starter" },
            "Open in the ticket list"
          )}
        />
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">
              {translate("dashboard.mine.title", { ns: "starter" }, "My work today")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {translate(
                "dashboard.mine.description",
                { ns: "starter" },
                "Assigned to you and still open, nearest deadline first."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-7">
              {translate(
                "dashboard.mine.assigned",
                { ns: "starter", count: mine.length },
                "{{count}} assigned"
              )}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "h-7",
                myOverdue > 0 &&
                  "border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              )}
            >
              {translate(
                "dashboard.mine.overdue",
                { ns: "starter", count: myOverdue },
                "{{count}} overdue"
              )}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "h-7",
                myDueSoon > 0 &&
                  "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              )}
            >
              {translate(
                "dashboard.mine.dueSoon",
                { ns: "starter", count: myDueSoon },
                "{{count}} due soon"
              )}
            </Badge>
            <button
              type="button"
              onClick={() => navigate("/tickets?view=my_open")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {translate("dashboard.watchlist.viewAll", { ns: "starter" }, "View all")}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
        {backlogQuery.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : mine.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {translate(
              "dashboard.mine.empty",
              { ns: "starter" },
              "Nothing assigned to you is open — pick something up from the unassigned view."
            )}
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {mine.slice(0, 5).map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                now={now}
                onOpen={() => openChild(`tickets/${ticket.id}`)}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 className="text-sm font-medium">
            {translate("dashboard.status.title", { ns: "starter" }, "Tickets by status")}
          </h3>
          {byStatusQuery.isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate("common.loading", { ns: "starter" }, "Loading...")}
            </div>
          ) : total === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate("dashboard.status.empty", { ns: "starter" }, "No tickets yet.")}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-6">
              <div className="relative size-40 shrink-0">
                <PieChart className="size-full">
                  <Pie
                    data={TICKET_STATUSES.map((status) => ({
                      status,
                      value:
                        byStatusQuery.data?.find((row) => row.status === status)?.n ??
                        0,
                    }))}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {TICKET_STATUSES.map((status) => (
                      <Cell key={status} fill={STATUS_COLORS[status]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold">{total}</span>
                  <span className="text-xs text-muted-foreground">
                    {translate("dashboard.status.total", { ns: "starter" }, "total")}
                  </span>
                </div>
              </div>
              <ul className="flex-1 space-y-2">
                {TICKET_STATUSES.map((status) => (
                  <li key={status} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: STATUS_COLORS[status] }}
                      />
                      {translateTicketStatus(translate, status)}
                    </span>
                    <span className="font-medium tabular-nums">
                      {byStatusQuery.data?.find((row) => row.status === status)?.n ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {translate("dashboard.watchlist.title", { ns: "starter" }, "SLA watchlist")}
            </h3>
            <button
              type="button"
              onClick={() => navigate("/sla")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {translate("dashboard.watchlist.viewAll", { ns: "starter" }, "View all")}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
          {backlogQuery.isLoading ? (
            <Skeleton className="mt-4 h-64 w-full" />
          ) : watchlist.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate(
                "dashboard.watchlist.empty",
                { ns: "starter" },
                "Nothing active — inbox zero."
              )}
            </div>
          ) : (
            <ul className="mt-3 divide-y">
              {watchlist.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  now={now}
                  showAssignee
                  onOpen={() => openChild(`tickets/${ticket.id}`)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title={translate(
            "dashboard.aging.title",
            { ns: "starter" },
            "Backlog ageing"
          )}
          description={translate(
            "dashboard.aging.description",
            { ns: "starter" },
            "How long the open backlog has been waiting, split by priority. Anything stacking up on the right is where the desk is losing ground."
          )}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={aging}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {PRIORITY_ORDER.map((priority) => (
                <Bar
                  key={priority}
                  dataKey={priority}
                  stackId="aging"
                  name={translateTicketPriority(translate, priority)}
                  fill={PRIORITY_COLORS[priority]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={translate(
            "dashboard.queueBacklog.title",
            { ns: "starter" },
            "Backlog by queue"
          )}
          description={translate(
            "dashboard.queueBacklog.description",
            { ns: "starter" },
            "Where the open work sits and how urgent it is."
          )}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={queueBacklog} layout="vertical" margin={{ left: 18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip />
              <Legend />
              {PRIORITY_ORDER.map((priority) => (
                <Bar
                  key={priority}
                  dataKey={priority}
                  stackId="queue"
                  name={translateTicketPriority(translate, priority)}
                  fill={PRIORITY_COLORS[priority]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h3 className="text-sm font-medium">
          {translate("dashboard.workload.title", { ns: "starter" }, "Agent workload")}
        </h3>
        <ul className="mt-3 divide-y">
          {agentLoadQuery.data
            ?.filter((row) => row.assigneeId != null)
            .map((row) => {
              const agent = agentsQuery.data?.find(
                (item) => item.id === row.assigneeId
              );
              return (
                <li
                  key={row.assigneeId}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="font-medium">
                    {agentDisplayName(
                      agent,
                      translate(
                        "dashboard.workload.unknownAgent",
                        { ns: "starter" },
                        "Unknown agent"
                      )
                    )}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {translate(
                      "dashboard.workload.active",
                      { ns: "starter", count: row.n },
                      "{{count}} active"
                    )}
                  </span>
                </li>
              );
            })}
          {!agentLoadQuery.isLoading &&
          !agentLoadQuery.data?.some((row) => row.assigneeId != null) ? (
            <li className="py-8 text-center text-sm text-muted-foreground">
              {translate(
                "dashboard.workload.empty",
                { ns: "starter" },
                "No active assignments yet."
              )}
            </li>
          ) : null}
        </ul>
      </section>
      <Outlet />
    </div>
  );
}

function TicketRow({
  ticket,
  now,
  onOpen,
  showAssignee,
}: {
  ticket: TicketRecord;
  now: Date;
  onOpen: () => void;
  showAssignee?: boolean;
}) {
  const translate = useTranslate();
  const due = getTicketDueAt(ticket);
  const state = getSlaState(ticket, now);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 py-3 text-left hover:bg-accent/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{ticket.subject}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <PriorityBadge priority={ticket.priority} className="h-5" />
            <span className="truncate">{ticket.requester_name}</span>
            {showAssignee ? (
              <span className="truncate">
                ·{" "}
                {agentDisplayName(
                  ticket.assignee,
                  translate(
                    "tickets.assignee.unassigned",
                    { ns: "starter" },
                    "Unassigned"
                  )
                )}
              </span>
            ) : null}
          </p>
        </div>
        <SlaBadge
          state={state}
          detail={
            due && state !== "on_track"
              ? formatRelativeDeadline(due, translate, now)
              : undefined
          }
        />
        <TicketStatusBadge status={ticket.status} className="hidden sm:inline-flex" />
      </button>
    </li>
  );
}

function KpiCard({
  label,
  value,
  loading,
  icon,
  tone,
  onClick,
  actionLabel,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  icon: React.ReactNode;
  tone?: "danger" | "success";
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={actionLabel}
      className="rounded-xl border bg-card p-5 text-left transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg [&_svg]:size-4",
            tone === "danger"
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              : tone === "success"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
        {loading ? "—" : (value ?? 0)}
      </p>
      {actionLabel ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {actionLabel}
          <ArrowRight className="size-3" />
        </p>
      ) : null}
    </button>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@refinedev/core";
import { Outlet, useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Timer,
} from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { cn } from "@/lib/utils";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "./badges";
import { useOpenContextualChild } from "./route-surfaces";
import {
  ACTIVE_STATUSES,
  agentDisplayName,
  DUE_SOON_WINDOW_HOURS,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  localToday,
  translateTicketStatus,
  TICKET_STATUSES,
  type TicketRecord,
  type TicketStatus,
  type TicketPriority,
} from "./lib";

type CountRow = { n: number };
type StatusRow = { n: number; status: TicketStatus };
type PriorityRow = { n: number; priority: TicketPriority };
type AgentLoadRow = { n: number; assigneeId: number | null };

// Blue-forward palette shared across the CRM / IT / Helpdesk portals. The chart
// var(--chart-*) tokens fall back to grayscale in dark mode, so use concrete hex.
const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "#2563eb",
  in_progress: "#0ea5e9",
  resolved: "#14b8a6",
  closed: "#94a3b8",
};

const queryCount = (filter: Record<string, unknown>) =>
  nocobaseClient.action<CountRow[]>("desk_tickets", "query", {
    body: {
      measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
      filter,
    },
  });

export function DashboardPage() {
  const translate = useTranslate();
  const navigate = useNavigate();
  const openChild = useOpenContextualChild();
  const now = new Date();
  const nowIso = now.toISOString();

  const openQuery = useQuery({
    queryKey: ["dashboard", "open"],
    queryFn: () =>
      queryCount({ status: { $in: ACTIVE_STATUSES } }).then(
        (rows) => rows[0]?.n ?? 0
      ),
  });
  const overdueQuery = useQuery({
    queryKey: ["dashboard", "overdue", nowIso.slice(0, 13)],
    queryFn: () =>
      queryCount({
        status: { $notIn: ["resolved", "closed"] },
        resolution_due_at: { $lt: nowIso },
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
  const byPriorityQuery = useQuery({
    queryKey: ["dashboard", "open-by-priority"],
    queryFn: () =>
      nocobaseClient.action<PriorityRow[]>("desk_tickets", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [{ field: ["priority"], alias: "priority" }],
          filter: { status: { $in: ACTIVE_STATUSES } },
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
    queryFn: () => nocobaseClient.action<{ id: number; nickname?: string; username?: string }[]>("users", "list", { query: { pageSize: 100 } }),
  });
  const watchQuery = useQuery({
    queryKey: ["dashboard", "watch"],
    queryFn: () =>
      nocobaseClient.action<TicketRecord[]>("desk_tickets", "list", {
        query: {
          page: 1,
          pageSize: 6,
          filter: JSON.stringify({ status: { $in: ACTIVE_STATUSES } }),
          sort: "resolution_due_at",
          "appends[]": ["assignee"],
        },
      }),
  });

  const total =
    byStatusQuery.data?.reduce((sum, row) => sum + row.n, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center text-muted-foreground">
          <Breadcrumb />
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.035em]">
            {translate(
              "navigation.dashboard",
              { ns: "starter" },
              "Dashboard"
            )}
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
          label={translate(
            "dashboard.kpi.openTickets",
            { ns: "starter" },
            "Open tickets"
          )}
          value={openQuery.data}
          loading={openQuery.isLoading}
          icon={<Inbox />}
        />
        <KpiCard
          label={translate(
            "dashboard.kpi.overdue",
            { ns: "starter" },
            "Overdue"
          )}
          value={overdueQuery.data}
          loading={overdueQuery.isLoading}
          icon={<AlertTriangle />}
          tone={
            (overdueQuery.data ?? 0) > 0 ? "danger" : undefined
          }
        />
        <KpiCard
          label={translate(
            "dashboard.kpi.dueWithin",
            { ns: "starter", hours: DUE_SOON_WINDOW_HOURS },
            "Due within {{hours}}h"
          )}
          value={undefined}
          loading={watchQuery.isLoading}
          icon={<Timer />}
          override={
            watchQuery.data?.filter(
              (ticket) => getSlaState(ticket) === "due_soon"
            ).length
          }
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
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h3 className="text-sm font-medium">
            {translate(
              "dashboard.status.title",
              { ns: "starter" },
              "Tickets by status"
            )}
          </h3>
          {byStatusQuery.isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate("common.loading", { ns: "starter" }, "Loading...")}
            </div>
          ) : total === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate(
                "dashboard.status.empty",
                { ns: "starter" },
                "No tickets yet."
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-6">
              <div className="relative size-40 shrink-0">
                <PieChart className="size-full">
                  <Pie
                    data={TICKET_STATUSES.map((status) => ({
                      status,
                      value:
                        byStatusQuery.data?.find(
                          (row) => row.status === status
                        )?.n ?? 0,
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
                    {translate(
                      "dashboard.status.total",
                      { ns: "starter" },
                      "total"
                    )}
                  </span>
                </div>
              </div>
              <ul className="flex-1 space-y-2">
                {TICKET_STATUSES.map((status) => (
                  <li
                    key={status}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: STATUS_COLORS[status] }}
                      />
                      {translateTicketStatus(translate, status)}
                    </span>
                    <span className="font-medium tabular-nums">
                      {byStatusQuery.data?.find(
                        (row) => row.status === status
                      )?.n ?? 0}
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
              {translate(
                "dashboard.watchlist.title",
                { ns: "starter" },
                "SLA watchlist"
              )}
            </h3>
            <button
              type="button"
              onClick={() => navigate("/sla")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {translate(
                "dashboard.watchlist.viewAll",
                { ns: "starter" },
                "View all"
              )}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
          {watchQuery.isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate("common.loading", { ns: "starter" }, "Loading...")}
            </div>
          ) : (watchQuery.data?.length ?? 0) === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {translate(
                "dashboard.watchlist.empty",
                { ns: "starter" },
                "Nothing active — inbox zero."
              )}
            </div>
          ) : (
            <ul className="mt-3 divide-y">
              {watchQuery.data?.map((ticket) => {
                const due = getTicketDueAt(ticket);
                const state = getSlaState(ticket);
                return (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => openChild(`tickets/${ticket.id}`)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {ticket.subject}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <PriorityBadge priority={ticket.priority} className="h-5" />
                          <span>{ticket.requester_name}</span>
                          <span>
                            · {agentDisplayName(
                              ticket.assignee,
                              translate(
                                "tickets.assignee.unassigned",
                                { ns: "starter" },
                                "Unassigned"
                              )
                            )}
                          </span>
                        </p>
                      </div>
                      <SlaBadge
                        state={state}
                        detail={
                          due && state !== "on_track"
                            ? formatRelativeDeadline(due, translate)
                            : undefined
                        }
                      />
                      <TicketStatusBadge status={ticket.status} className="hidden sm:inline-flex" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-medium">
            {translate(
              "dashboard.priority.title",
              { ns: "starter" },
              "Open tickets by priority"
            )}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["urgent", "high", "medium", "low"] as TicketPriority[]).map((priority) => (
              <div key={priority} className="rounded-xl bg-muted/60 p-3">
                <PriorityBadge priority={priority} />
                <p className="mt-3 text-2xl font-semibold tabular-nums">{byPriorityQuery.data?.find((row) => row.priority === priority)?.n ?? 0}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-medium">
            {translate(
              "dashboard.workload.title",
              { ns: "starter" },
              "Agent workload"
            )}
          </h3>
          <ul className="mt-3 divide-y">
            {agentLoadQuery.data?.filter((row) => row.assigneeId != null).map((row) => {
              const agent = agentsQuery.data?.find((item) => item.id === row.assigneeId);
              return <li key={row.assigneeId} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium">{agent?.nickname || agent?.username || translate("dashboard.workload.unknownAgent", { ns: "starter" }, "Unknown agent")}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{translate("dashboard.workload.active", { ns: "starter", count: row.n }, "{{count}} active")}</span></li>;
            })}
            {!agentLoadQuery.isLoading && !(agentLoadQuery.data?.some((row) => row.assigneeId != null)) ? <li className="py-8 text-center text-sm text-muted-foreground">{translate("dashboard.workload.empty", { ns: "starter" }, "No active assignments yet.")}</li> : null}
          </ul>
        </section>
      </div>
      <Outlet />
    </div>
  );
}

function KpiCard({
  label,
  value,
  override,
  loading,
  icon,
  tone,
}: {
  label: string;
  value?: number;
  override?: number;
  loading?: boolean;
  icon: React.ReactNode;
  tone?: "danger" | "success";
}) {
  const display = override ?? value ?? 0;
  return (
    <div className="rounded-xl border bg-card p-5">
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
        {loading ? "—" : display}
      </p>
    </div>
  );
}

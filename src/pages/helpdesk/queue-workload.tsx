import { useList, useTranslate } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import {
  ArrowUpRight,
  Inbox,
  Pencil,
  Plus,
  Route,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { Outlet } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AnalyticsHeader, MetricCard } from "./analytics-ui";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "./badges";
import {
  ACTIVE_STATUSES,
  agentDisplayName,
  getSlaState,
  type NamedRecord,
  type TicketPriority,
  type TicketRecord,
} from "./lib";
import { formatMinutes } from "./sla-metrics";
import { useOpenContextualChild } from "./route-surfaces";

type RoutingRow = { n: number; queue_id: number | null; ticket_type_id: number | null };
type QueueStatRow = {
  n: number;
  queue_id: number | null;
  avg_resolution?: number | null;
};

export function QueueWorkloadPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();

  const { result: queues, query: queuesQuery } = useList<NamedRecord>({
    resource: "desk_queues",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
    sorters: [{ field: "name", order: "asc" }],
  });
  const { result: types } = useList<NamedRecord>({
    resource: "desk_ticket_types",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
    sorters: [{ field: "name", order: "asc" }],
  });
  const { result: tickets, query: ticketsQuery } = useList<TicketRecord>({
    resource: "desk_tickets",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    filters: [{ field: "status", operator: "in", value: ACTIVE_STATUSES }],
    sorters: [{ field: "resolution_due_at", order: "asc" }],
    meta: { appends: ["queue", "assignee", "ticket_type"] },
  });

  // How work has actually been routed, counted over the whole history rather
  // than the active page — the rule is only readable once there is volume
  // behind it.
  const routingQuery = useQuery({
    queryKey: ["queues", "routing"],
    queryFn: () =>
      nocobaseClient.action<RoutingRow[]>("desk_tickets", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [
            { field: ["queue_id"], alias: "queue_id" },
            { field: ["ticket_type_id"], alias: "ticket_type_id" },
          ],
        },
      }),
  });
  const handlingQuery = useQuery({
    queryKey: ["queues", "handling"],
    queryFn: () =>
      nocobaseClient.action<QueueStatRow[]>("desk_tickets", "query", {
        body: {
          measures: [
            { field: ["id"], aggregation: "count", alias: "n" },
            { field: ["resolution_mins"], aggregation: "avg", alias: "avg_resolution" },
          ],
          dimensions: [{ field: ["queue_id"], alias: "queue_id" }],
          filter: { resolved_at: { $ne: null } },
        },
      }),
  });

  const queueName = (id: number | null) =>
    queues.data.find((queue) => queue.id === Number(id))?.name ??
    translate("queues.unrouted", { ns: "starter" }, "Unrouted");

  const routingByType = types.data
    .map((type) => {
      const rows = (routingQuery.data ?? []).filter(
        (row) => Number(row.ticket_type_id) === type.id
      );
      const total = rows.reduce((sum, row) => sum + row.n, 0);
      const ranked = [...rows].sort((a, b) => b.n - a.n);
      const primary = ranked[0];
      return {
        type,
        total,
        primaryQueueId: primary?.queue_id ?? null,
        primaryShare: total ? ((primary?.n ?? 0) / total) * 100 : 0,
        secondary: ranked.slice(1, 3),
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const unrouted = tickets.data.filter((ticket) => !ticket.queue_id).length;
  const maxLoad = Math.max(
    1,
    ...queues.data.map(
      (queue) =>
        tickets.data.filter((ticket) => ticket.queue_id === queue.id).length
    )
  );
  const busiest = [...queues.data]
    .map((queue) => ({
      queue,
      load: tickets.data.filter((ticket) => ticket.queue_id === queue.id).length,
    }))
    .sort((a, b) => b.load - a.load)[0];

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("queues.title", { ns: "starter" }, "Queue workload")}
        description={translate(
          "queues.description",
          { ns: "starter" },
          "Balance active work across specialist teams, read how tickets are routed today, and spot queues with concentrated SLA risk."
        )}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-8 gap-2">
              <Inbox className="size-3.5" />
              {translate(
                "queues.activeTotal",
                { ns: "starter", count: tickets.data.length },
                "{{count}} active tickets"
              )}
            </Badge>
            <Button type="button" size="sm" onClick={() => openChild("create")}>
              <Plus />
              {translate("queues.actions.new", { ns: "starter" }, "New queue")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={translate("queues.kpi.queues", { ns: "starter" }, "Queues")}
          value={queues.data.length}
          icon={<UsersRound />}
          loading={queuesQuery.isLoading}
        />
        <MetricCard
          label={translate("queues.kpi.active", { ns: "starter" }, "Active tickets")}
          value={tickets.data.length}
          icon={<Inbox />}
          loading={ticketsQuery.isLoading}
        />
        <MetricCard
          label={translate("queues.kpi.busiest", { ns: "starter" }, "Busiest queue")}
          value={busiest?.queue.name ?? "—"}
          detail={
            busiest
              ? translate(
                  "queues.capacity",
                  { ns: "starter", count: busiest.load },
                  "{{count}} tickets in flight"
                )
              : undefined
          }
          icon={<Route />}
          loading={ticketsQuery.isLoading}
        />
        <MetricCard
          label={translate("queues.kpi.unrouted", { ns: "starter" }, "Unrouted")}
          value={unrouted}
          detail={translate(
            "queues.kpi.unroutedDetail",
            { ns: "starter" },
            "Active tickets with no queue"
          )}
          icon={<TriangleAlert />}
          tone={unrouted > 0 ? "danger" : "success"}
          loading={ticketsQuery.isLoading}
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="border-b bg-muted/25 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Route className="size-4 text-muted-foreground" />
            {translate(
              "queues.routing.historyTitle",
              { ns: "starter" },
              "Historical routing distribution"
            )}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              "queues.routing.historyDescription",
              { ns: "starter" },
              "Observed ticket volume by type and queue. This describes past assignments; it is not a routing rule or a prediction."
            )}
          </p>
        </header>
        {routingQuery.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {translate("tickets.fields.type", { ns: "starter" }, "Ticket type")}
                </TableHead>
                <TableHead>
                  {translate(
                    "queues.routing.mostFrequent",
                    { ns: "starter" },
                    "Most frequent queue"
                  )}
                </TableHead>
                <TableHead className="w-56">
                  {translate(
                    "queues.routing.share",
                    { ns: "starter" },
                    "Share of history"
                  )}
                </TableHead>
                <TableHead>
                  {translate(
                    "queues.routing.otherQueues",
                    { ns: "starter" },
                    "Other observed queues"
                  )}
                </TableHead>
                <TableHead className="text-right">
                  {translate("queues.routing.volume", { ns: "starter" }, "Tickets")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routingByType.map((entry) => (
                <TableRow key={entry.type.id}>
                  <TableCell className="font-medium">{entry.type.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                      {queueName(entry.primaryQueueId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={entry.primaryShare}
                        className={cn(
                          "flex-1 [&_[data-slot=progress-track]]:h-1.5",
                          entry.primaryShare >= 80
                            ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                            : entry.primaryShare >= 50
                              ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                              : "[&_[data-slot=progress-indicator]]:bg-red-500"
                        )}
                      />
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {Math.round(entry.primaryShare)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.secondary.length
                      ? entry.secondary
                          .map((row) => `${queueName(row.queue_id)} (${row.n})`)
                          .join(", ")
                      : translate(
                          "queues.routing.noOtherQueues",
                          { ns: "starter" },
                          "No other queue in history"
                        )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.total}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {queuesQuery.isLoading || ticketsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {queues.data.map((queue) => {
            const queueTickets = tickets.data.filter(
              (ticket) => ticket.queue_id === queue.id
            );
            const breached = queueTickets.filter(
              (ticket) => ticket.sla_breached || getSlaState(ticket) === "overdue"
            ).length;
            const urgent = queueTickets.filter(
              (ticket) => ticket.priority === "urgent"
            ).length;
            const handling = handlingQuery.data?.find(
              (row) => Number(row.queue_id) === queue.id
            );
            const owners = new Map<string, number>();
            for (const ticket of queueTickets) {
              const name = agentDisplayName(
                ticket.assignee,
                translate(
                  "tickets.assignee.unassigned",
                  { ns: "starter" },
                  "Unassigned"
                )
              );
              owners.set(name, (owners.get(name) ?? 0) + 1);
            }
            const topOwners = [...owners]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            const priorityMix = (
              ["urgent", "high", "medium", "low"] as TicketPriority[]
            ).map((priority) => ({
              priority,
              count: queueTickets.filter(
                (ticket) => ticket.priority === priority
              ).length,
            }));

            return (
              <section
                key={queue.id}
                className="overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                <header className="border-b bg-muted/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-left hover:underline"
                      onClick={() => openChild(`show/${queue.id}`)}
                    >
                      <h3 className="truncate font-semibold">{queue.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {translate(
                          "queues.capacity",
                          { ns: "starter", count: queueTickets.length },
                          "{{count}} tickets in flight"
                        )}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={translate(
                          "queues.actions.edit",
                          { ns: "starter" },
                          "Edit queue"
                        )}
                        title={translate(
                          "queues.actions.edit",
                          { ns: "starter" },
                          "Edit queue"
                        )}
                        onClick={() => openChild(`edit/${queue.id}`)}
                      >
                        <Pencil />
                      </Button>
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UsersRound className="size-4" />
                      </div>
                    </div>
                  </div>
                  <Progress
                    className="mt-3 h-1.5"
                    value={(queueTickets.length / maxLoad) * 100}
                  />
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">
                      {translate(
                        "queues.risk",
                        { ns: "starter", count: breached },
                        "{{count}} at risk"
                      )}
                    </span>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
                      {translate(
                        "queues.urgent",
                        { ns: "starter", count: urgent },
                        "{{count}} urgent"
                      )}
                    </span>
                    {handling?.avg_resolution ? (
                      <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        {translate(
                          "queues.avgHandling",
                          {
                            ns: "starter",
                            duration: formatMinutes(
                              Number(handling.avg_resolution),
                              translate
                            ),
                          },
                          "avg {{duration}}"
                        )}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
                    {priorityMix.map((slice) =>
                      slice.count ? (
                        <span
                          key={slice.priority}
                          className={cn(
                            slice.priority === "urgent" && "bg-red-500",
                            slice.priority === "high" && "bg-orange-500",
                            slice.priority === "medium" && "bg-cyan-500",
                            slice.priority === "low" && "bg-muted-foreground/40"
                          )}
                          style={{
                            width: `${(slice.count / Math.max(1, queueTickets.length)) * 100}%`,
                          }}
                          title={`${slice.priority}: ${slice.count}`}
                        />
                      ) : null
                    )}
                  </div>
                  {topOwners.length ? (
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">
                      {translate(
                        "queues.topOwners",
                        {
                          ns: "starter",
                          owners: topOwners
                            .map(([name, count]) => `${name} (${count})`)
                            .join(", "),
                        },
                        "Carrying it: {{owners}}"
                      )}
                    </p>
                  ) : null}
                </header>
                <div className="divide-y">
                  {queueTickets.slice(0, 5).map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => openChild(String(ticket.id))}
                      className="group block w-full p-4 text-left hover:bg-muted/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-medium leading-5">
                          {ticket.subject}
                        </p>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <TicketStatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        <SlaBadge state={getSlaState(ticket)} />
                      </div>
                    </button>
                  ))}
                  {queueTickets.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      {translate(
                        "queues.empty",
                        { ns: "starter" },
                        "No active tickets in this queue."
                      )}
                    </p>
                  ) : null}
                  {queueTickets.length > 5 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      {translate(
                        "queues.more",
                        { ns: "starter", count: queueTickets.length - 5 },
                        "+{{count}} more in this queue"
                      )}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Outlet />
    </div>
  );
}

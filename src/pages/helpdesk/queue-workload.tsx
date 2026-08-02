import { useList, useTranslate } from "@refinedev/core";
import { ArrowUpRight, Inbox, Pencil, Plus, UsersRound } from "lucide-react";
import { Outlet } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsHeader } from "./analytics-ui";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "./badges";
import { ACTIVE_STATUSES, getSlaState, type NamedRecord, type TicketRecord } from "./lib";
import { useOpenContextualChild } from "./route-surfaces";

export function QueueWorkloadPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const { result: queues, query: queuesQuery } = useList<NamedRecord>({
    resource: "desk_queues",
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
  const maxLoad = Math.max(1, ...queues.data.map((queue) => tickets.data.filter((ticket) => ticket.queue_id === queue.id).length));

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("queues.title", { ns: "starter" }, "Queue workload")}
        description={translate("queues.description", { ns: "starter" }, "Balance active work across specialist teams and spot queues with concentrated SLA risk.")}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-8 gap-2"><Inbox className="size-3.5" />{translate("queues.activeTotal", { ns: "starter", count: tickets.data.length }, "{{count}} active tickets")}</Badge>
            <Button type="button" size="sm" onClick={() => openChild("create")}><Plus />{translate("queues.actions.new", { ns: "starter" }, "New queue")}</Button>
          </div>
        }
      />

      {queuesQuery.isLoading || ticketsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-xl" />)}</div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {queues.data.map((queue) => {
            const queueTickets = tickets.data.filter((ticket) => ticket.queue_id === queue.id);
            const breached = queueTickets.filter((ticket) => ticket.sla_breached || getSlaState(ticket) === "overdue").length;
            const urgent = queueTickets.filter((ticket) => ticket.priority === "urgent").length;
            return (
              <section key={queue.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <header className="border-b bg-muted/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 text-left hover:underline" onClick={() => openChild(`show/${queue.id}`)}>
                      <h3 className="truncate font-semibold">{queue.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{translate("queues.capacity", { ns: "starter", count: queueTickets.length }, "{{count}} tickets in flight")}</p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button type="button" variant="ghost" size="icon" aria-label={translate("queues.actions.edit", { ns: "starter" }, "Edit queue")} title={translate("queues.actions.edit", { ns: "starter" }, "Edit queue")} onClick={() => openChild(`edit/${queue.id}`)}><Pencil /></Button>
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UsersRound className="size-4" /></div>
                    </div>
                  </div>
                  <Progress className="mt-3 h-1.5" value={(queueTickets.length / maxLoad) * 100} />
                  <div className="mt-3 flex gap-2 text-xs">
                    <span className="rounded-full bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300">{translate("queues.risk", { ns: "starter", count: breached }, "{{count}} at risk")}</span>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">{translate("queues.urgent", { ns: "starter", count: urgent }, "{{count}} urgent")}</span>
                  </div>
                </header>
                <div className="divide-y">
                  {queueTickets.slice(0, 5).map((ticket) => (
                    <button key={ticket.id} type="button" onClick={() => openChild(String(ticket.id))} className="group block w-full p-4 text-left hover:bg-muted/35">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-medium leading-5">{ticket.subject}</p>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <TicketStatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                        <SlaBadge state={getSlaState(ticket)} />
                      </div>
                    </button>
                  ))}
                  {queueTickets.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{translate("queues.empty", { ns: "starter" }, "No active tickets in this queue.")}</p> : null}
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


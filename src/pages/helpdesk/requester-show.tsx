import { useList, useShow, useTranslate } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { Building2, Mail, Pencil, Ticket as TicketIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { cn } from "@/lib/utils";
import { PriorityBadge, TicketStatusBadge } from "./badges";
import {
  TICKET_STATUSES,
  type RequesterRecord,
  type TicketRecord,
} from "./lib";
import {
  useContextualCloseTo,
  useOpenAbsolute,
  useOpenContextualChild,
} from "./route-surfaces";

type CountRow = { n: number };
type CsatRow = { avg_score: number | null; n: number };

const queryTicketCount = (
  requesterId: number,
  filter: Record<string, unknown> = {}
) =>
  nocobaseClient
    .action<CountRow[]>("desk_tickets", "query", {
      body: {
        measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
        filter: {
          requester_id: { $eq: requesterId },
          ...filter,
        },
      },
    })
    .then((rows) => Number(rows[0]?.n ?? 0));

function ProfileStat({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", className)}>
        {value}
      </p>
    </div>
  );
}

export function RequesterShow({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const id = params[idParam];
  const requesterId = id ? Number(id) : undefined;
  const closeTo = useContextualCloseTo();
  const openChild = useOpenContextualChild();
  const openAbsolute = useOpenAbsolute();
  const nested = useOutlet();
  const { result: requester, query } = useShow<RequesterRecord>({
    resource: "desk_requesters",
    id,
  });
  const { result: tickets, query: ticketsQuery } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [
      {
        field: "requester_id",
        operator: "eq",
        value: requesterId,
      },
    ],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "createdAt", order: "desc" }],
    queryOptions: { enabled: requesterId !== undefined, retry: false },
  });

  const totalTicketsQuery = useQuery({
    queryKey: ["requester-profile", id, "total-tickets"],
    queryFn: () => queryTicketCount(requesterId!),
    enabled: requesterId !== undefined,
  });
  const openTicketsQuery = useQuery({
    queryKey: ["requester-profile", id, "open-tickets"],
    queryFn: () =>
      queryTicketCount(requesterId!, {
        status: { $in: ["open", "in_progress"] },
      }),
    enabled: requesterId !== undefined,
  });
  const breachedTicketsQuery = useQuery({
    queryKey: ["requester-profile", id, "sla-breached"],
    queryFn: () =>
      queryTicketCount(requesterId!, {
        sla_breached: { $eq: true },
      }),
    enabled: requesterId !== undefined,
  });
  const csatQuery = useQuery({
    queryKey: ["requester-profile", id, "csat"],
    queryFn: () =>
      nocobaseClient
        .action<CsatRow[]>("desk_csat", "query", {
          body: {
            measures: [
              { field: ["score"], aggregation: "avg", alias: "avg_score" },
              { field: ["id"], aggregation: "count", alias: "n" },
            ],
            filter: {
              "ticket.requester_id": { $eq: requesterId! },
            },
          },
        })
        .then((rows) => {
          const row = rows[0];
          return row && Number(row.n) > 0 ? Number(row.avg_score) : null;
        }),
    enabled: requesterId !== undefined,
  });

  const slaBreached = totalTicketsQuery.data
    ? Math.round(
        ((breachedTicketsQuery.data ?? 0) / totalTicketsQuery.data) * 100
      )
    : 0;
  const statusCounts = useMemo(
    () =>
      TICKET_STATUSES.map((status) => ({
        status,
        count: tickets.data.filter((ticket) => ticket.status === status).length,
      })).filter((entry) => entry.count > 0),
    [tickets.data]
  );

  return (
    <RouteDrawer
      title={
        requester?.name ??
        translate(
          "requesters.profile.title",
          { ns: "starter" },
          "Requester profile"
        )
      }
      description={translate(
        "requesters.profile.description",
        { ns: "starter" },
        "Customer context and complete ticket history."
      )}
      closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
      closeTo={closeTo}
      nested={nested}
      actions={
        requester ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openChild("edit")}
          >
            <Pencil />
            {translate("buttons.edit", { ns: "starter" }, "Edit")}
          </Button>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : requester ? (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="size-3.5" />
                  {translate(
                    "requesters.fields.company",
                    { ns: "starter" },
                    "Company"
                  )}
                </p>
                <p className="mt-2 font-semibold">{requester.company}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="size-3.5" />
                  {translate(
                    "requesters.fields.email",
                    { ns: "starter" },
                    "Email"
                  )}
                </p>
                <p className="mt-2 font-semibold">{requester.email}</p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-4">
              <ProfileStat
                label={translate(
                  "requesters.profile.totalTickets",
                  { ns: "starter" },
                  "Total tickets"
                )}
                value={
                  totalTicketsQuery.isLoading ? "—" : totalTicketsQuery.data ?? 0
                }
              />
              <ProfileStat
                label={translate(
                  "requesters.profile.openNow",
                  { ns: "starter" },
                  "Open now"
                )}
                value={
                  openTicketsQuery.isLoading ? "—" : openTicketsQuery.data ?? 0
                }
              />
              <ProfileStat
                label={translate(
                  "requesters.profile.slaBreached",
                  { ns: "starter" },
                  "SLA breached"
                )}
                value={
                  totalTicketsQuery.isLoading || breachedTicketsQuery.isLoading
                    ? "—"
                    : `${slaBreached}%`
                }
                className={
                  slaBreached > 20 ? "text-red-600 dark:text-red-400" : undefined
                }
              />
              <ProfileStat
                label={translate(
                  "requesters.profile.avgCsat",
                  { ns: "starter" },
                  "Avg CSAT"
                )}
                value={
                  csatQuery.isLoading
                    ? "—"
                    : csatQuery.data === null || csatQuery.data === undefined
                      ? "—"
                      : `${csatQuery.data.toFixed(1)} / 5`
                }
              />
            </section>

            {statusCounts.length ? (
              <section className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {translate(
                    "requesters.profile.statusMix",
                    { ns: "starter" },
                    "Status mix"
                  )}
                </span>
                {statusCounts.map(({ status, count }) => (
                  <span key={status} className="flex items-center gap-1.5">
                    <TicketStatusBadge status={status} />
                    <span className="tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </span>
                ))}
              </section>
            ) : null}

            <Separator />

            <section>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {translate(
                      "requesters.profile.history",
                      { ns: "starter" },
                      "Ticket history"
                    )}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {translate(
                      "requesters.profile.historyCount",
                      { ns: "starter", count: tickets.total },
                      "{{count}} tickets across this relationship"
                    )}
                  </p>
                </div>
                <TicketIcon className="size-5 text-primary" />
              </div>
              <div className="mt-4 space-y-3">
                {tickets.data.map((ticket) => (
                  <Button
                    key={ticket.id}
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start p-4 text-left"
                    onClick={() => openAbsolute(`/tickets/show/${ticket.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ticket.subject}</p>
                      <div className="mt-2 flex gap-2">
                        <TicketStatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                    </div>
                  </Button>
                ))}
                {!ticketsQuery.isLoading && tickets.data.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {translate(
                      "requesters.profile.noTickets",
                      { ns: "starter" },
                      "No tickets are linked to this requester yet."
                    )}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </RouteDrawer>
  );
}

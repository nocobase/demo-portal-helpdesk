import { useList, useShow, useTranslate } from "@refinedev/core";
import { ArrowUpRight, Pencil, ShieldCheck } from "lucide-react";
import { useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "./badges";
import { getSlaState, type SlaPolicyRecord, type TicketRecord } from "./lib";
import { useContextualCloseTo, useOpenAbsolute, useOpenContextualChild } from "./route-surfaces";

export function SlaPolicyShow({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const policyId = params[idParam];
  const closeTo = useContextualCloseTo();
  const openChild = useOpenContextualChild();
  const openAbsolute = useOpenAbsolute();
  const nested = useOutlet();
  const { result: policy, query } = useShow<SlaPolicyRecord>({ resource: "desk_sla_policies", id: policyId });
  const { result: tickets, query: ticketsQuery } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [{ field: "sla_policy_id", operator: "eq", value: policyId ? Number(policyId) : undefined }],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "createdAt", order: "desc" }],
    queryOptions: { enabled: Boolean(policyId), retry: false },
  });

  return (
    <RouteDrawer
      title={query.isLoading && !policy ? translate("slaPolicies.show.title", { ns: "starter" }, "SLA policy") : (policy?.name ?? translate("slaPolicies.show.title", { ns: "starter" }, "SLA policy"))}
      description={translate("slaPolicies.show.description", { ns: "starter" }, "Response and resolution targets, plus tickets governed by this policy.")}
      closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
      closeTo={closeTo}
      nested={nested}
      actions={
        policy ? (
          <Button type="button" variant="outline" size="sm" onClick={() => openChild("edit")}>
            <Pencil />
            {translate("buttons.edit", { ns: "starter" }, "Edit")}
          </Button>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading || !policy ? (
          <LoadingState className="min-h-64" />
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{policy.name}</p>
                  <div className="mt-2"><PriorityBadge priority={policy.priority} /></div>
                </div>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">{translate("sla.policy.response", { ns: "starter" }, "First response")}</dt>
                  <dd className="mt-1 font-semibold">{translate("sla.policy.minutes", { ns: "starter", count: policy.response_mins }, "{{count}} min")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{translate("sla.policy.resolve", { ns: "starter" }, "Resolution")}</dt>
                  <dd className="mt-1 font-semibold">{translate("sla.policy.minutes", { ns: "starter", count: policy.resolve_mins }, "{{count}} min")}</dd>
                </div>
              </dl>
            </section>
            <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              {translate("slaPolicies.show.ticketCount", { ns: "starter", count: tickets.data.length }, "{{count}} tickets on this policy")}
            </div>
            <div className="divide-y overflow-hidden rounded-xl border">
              {tickets.data.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => openAbsolute(`/tickets/show/${ticket.id}`)}
                  className="group block w-full p-4 text-left hover:bg-muted/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium leading-5">{ticket.subject}</p>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <TicketStatusBadge status={ticket.status} />
                    <SlaBadge state={getSlaState(ticket)} />
                  </div>
                </button>
              ))}
              {!ticketsQuery.isLoading && tickets.data.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {translate("slaPolicies.show.empty", { ns: "starter" }, "No tickets are on this policy yet.")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </RouteDrawer>
  );
}

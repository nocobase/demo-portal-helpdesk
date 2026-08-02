import { useList, useShow, useTranslate } from "@refinedev/core";
import { ArrowUpRight, Pencil, Tag } from "lucide-react";
import { useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "../badges";
import { getSlaState, type NamedRecord, type TicketRecord } from "../lib";
import { useContextualCloseTo, useOpenAbsolute, useOpenContextualChild } from "../route-surfaces";

export function TicketTypeShow({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const typeId = params[idParam];
  const closeTo = useContextualCloseTo();
  const openChild = useOpenContextualChild();
  const openAbsolute = useOpenAbsolute();
  const nested = useOutlet();
  const { result: type, query } = useShow<NamedRecord>({ resource: "desk_ticket_types", id: typeId });
  const { result: tickets, query: ticketsQuery } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [{ field: "ticket_type_id", operator: "eq", value: typeId ? Number(typeId) : undefined }],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "createdAt", order: "desc" }],
    queryOptions: { enabled: Boolean(typeId), retry: false },
  });

  return (
    <RouteDrawer
      title={query.isLoading && !type ? translate("ticketTypes.show.title", { ns: "starter" }, "Ticket type") : (type?.name ?? translate("ticketTypes.show.title", { ns: "starter" }, "Ticket type"))}
      description={translate("ticketTypes.show.description", { ns: "starter" }, "Tickets currently classified under this type.")}
      closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
      closeTo={closeTo}
      nested={nested}
      actions={
        type ? (
          <Button type="button" variant="outline" size="sm" onClick={() => openChild("edit")}>
            <Pencil />
            {translate("buttons.edit", { ns: "starter" }, "Edit")}
          </Button>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="size-4" />
                {translate("ticketTypes.show.ticketCount", { ns: "starter", count: tickets.data.length }, "{{count}} tickets")}
              </div>
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
                    <PriorityBadge priority={ticket.priority} />
                    <SlaBadge state={getSlaState(ticket)} />
                  </div>
                </button>
              ))}
              {!ticketsQuery.isLoading && tickets.data.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {translate("ticketTypes.show.empty", { ns: "starter" }, "No tickets are classified under this type yet.")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </RouteDrawer>
  );
}

import { useList, useShow, useTranslate } from "@refinedev/core";
import { Building2, Mail, Pencil, Ticket as TicketIcon } from "lucide-react";
import { Outlet, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { PriorityBadge, TicketStatusBadge } from "./badges";
import type { RequesterRecord, TicketRecord } from "./lib";
import { useContextualCloseTo, useOpenAbsolute, useOpenContextualChild } from "./route-surfaces";

export function RequesterShow({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const id = params[idParam];
  const closeTo = useContextualCloseTo();
  const openChild = useOpenContextualChild();
  const openAbsolute = useOpenAbsolute();
  const nested = useOutlet();
  const { result: requester, query } = useShow<RequesterRecord>({ resource: "desk_requesters", id });
  const { result: tickets, query: ticketsQuery } = useList<TicketRecord>({ resource: "desk_tickets", filters: [{ field: "requester_id", operator: "eq", value: id ? Number(id) : undefined }], pagination: { mode: "server", currentPage: 1, pageSize: 100 }, sorters: [{ field: "createdAt", order: "desc" }], queryOptions: { enabled: Boolean(id), retry: false } });
  return <RouteDrawer
    title={requester?.name ?? translate("requesters.profile.title", { ns: "starter" }, "Requester profile")}
    description={translate("requesters.profile.description", { ns: "starter" }, "Customer context and complete ticket history.")}
    closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
    closeTo={closeTo}
    nested={nested}
    actions={requester ? <Button type="button" variant="outline" size="sm" onClick={() => openChild("edit")}><Pencil />{translate("buttons.edit", { ns: "starter" }, "Edit")}</Button> : null}
  >
    <div className="min-h-0 flex-1 overflow-y-auto p-5">{query.isLoading ? <LoadingState className="min-h-64" /> : requester ? <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-muted/20 p-4"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="size-3.5" />{translate("requesters.fields.company", { ns: "starter" }, "Company")}</p><p className="mt-2 font-semibold">{requester.company}</p></div><div className="rounded-xl border bg-muted/20 p-4"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3.5" />{translate("requesters.fields.email", { ns: "starter" }, "Email")}</p><p className="mt-2 font-semibold">{requester.email}</p></div></section><Separator /><section><div className="flex items-center justify-between"><div><h3 className="font-semibold">{translate("requesters.profile.history", { ns: "starter" }, "Ticket history")}</h3><p className="mt-1 text-xs text-muted-foreground">{translate("requesters.profile.historyCount", { ns: "starter", count: tickets.data.length }, "{{count}} tickets across this relationship")}</p></div><TicketIcon className="size-5 text-primary" /></div><div className="mt-4 space-y-3">{tickets.data.map((ticket) => <Button key={ticket.id} type="button" variant="outline" className="h-auto w-full justify-start p-4 text-left" onClick={() => openAbsolute(`/tickets/show/${ticket.id}`)}><div className="min-w-0 flex-1"><p className="truncate font-medium">{ticket.subject}</p><div className="mt-2 flex gap-2"><TicketStatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div></div></Button>)}{!ticketsQuery.isLoading && tickets.data.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{translate("requesters.profile.noTickets", { ns: "starter" }, "No tickets are linked to this requester yet.")}</p> : null}</div></section></div> : null}</div>
  </RouteDrawer>;
}


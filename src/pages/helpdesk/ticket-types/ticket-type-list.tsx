import { useList, useTranslate } from "@refinedev/core";
import { Eye, Pencil, Plus, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsHeader, MetricCard } from "../analytics-ui";
import type { NamedRecord, TicketRecord } from "../lib";
import { useOpenContextualChild } from "../route-surfaces";

export function TicketTypeList() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const [search, setSearch] = useState("");
  const { result, query } = useList<NamedRecord>({ resource: "desk_ticket_types", pagination: { mode: "server", currentPage: 1, pageSize: 100 }, sorters: [{ field: "name", order: "asc" }] });
  const { result: tickets } = useList<TicketRecord>({ resource: "desk_tickets", pagination: { mode: "server", currentPage: 1, pageSize: 200 }, meta: { appends: ["ticket_type"] } });
  const rows = useMemo(() => result.data.filter((type) => type.name.toLowerCase().includes(search.toLowerCase())), [result.data, search]);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("ticketTypes.title", { ns: "starter" }, "Ticket types")}
        description={translate("ticketTypes.description", { ns: "starter" }, "The categories of work customers and agents route tickets through.")}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate("ticketTypes.search", { ns: "starter" }, "Search ticket types")} />
            </div>
            <Button type="button" size="sm" onClick={() => openChild("create")}>
              <Plus />
              {translate("ticketTypes.actions.new", { ns: "starter" }, "New ticket type")}
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label={translate("ticketTypes.kpi.count", { ns: "starter" }, "Ticket types")} value={result.data.length} icon={<Tag />} loading={query.isLoading} />
        <MetricCard label={translate("ticketTypes.kpi.tickets", { ns: "starter" }, "Categorized tickets")} value={tickets.data.filter((ticket) => ticket.ticket_type_id).length} detail={translate("ticketTypes.kpi.tickets.detail", { ns: "starter" }, "Tickets with a type set")} />
      </div>
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {query.isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("ticketTypes.fields.name", { ns: "starter" }, "Ticket type")}</TableHead>
                <TableHead className="text-right">{translate("ticketTypes.fields.tickets", { ns: "starter" }, "Tickets")}</TableHead>
                <TableHead className="w-24 text-right">{translate("tickets.fields.actions", { ns: "starter" }, "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((type) => {
                const count = tickets.data.filter((ticket) => ticket.ticket_type_id === type.id).length;
                return (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">
                      <button type="button" className="hover:underline" onClick={() => openChild(`show/${type.id}`)}>{type.name}</button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label={translate("buttons.edit", { ns: "starter" }, "Edit")} title={translate("buttons.edit", { ns: "starter" }, "Edit")} onClick={() => openChild(`edit/${type.id}`)}><Pencil /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={translate("buttons.show", { ns: "starter" }, "View")} title={translate("buttons.show", { ns: "starter" }, "View")} onClick={() => openChild(`show/${type.id}`)}><Eye /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!query.isLoading && rows.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">{translate("ticketTypes.empty", { ns: "starter" }, "No ticket types match this search.")}</p>
        ) : null}
      </section>
      <Outlet />
    </div>
  );
}

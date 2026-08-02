import { useList, useTranslate } from "@refinedev/core";
import { Building2, ChevronRight, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsHeader, MetricCard } from "./analytics-ui";
import type { RequesterRecord, TicketRecord } from "./lib";
import { useOpenContextualChild } from "./route-surfaces";

export function RequestersPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const [search, setSearch] = useState("");
  const { result, query } = useList<RequesterRecord>({ resource: "desk_requesters", pagination: { mode: "server", currentPage: 1, pageSize: 100 }, sorters: [{ field: "name", order: "asc" }] });
  const { result: tickets } = useList<TicketRecord>({ resource: "desk_tickets", pagination: { mode: "server", currentPage: 1, pageSize: 200 }, meta: { appends: ["requester"] } });
  const rows = useMemo(() => result.data.filter((requester) => `${requester.name} ${requester.email} ${requester.company}`.toLowerCase().includes(search.toLowerCase())), [result.data, search]);
  const companies = new Set(result.data.map((item) => item.company)).size;
  const repeat = result.data.filter((item) => tickets.data.filter((ticket) => ticket.requester_id === item.id).length > 1).length;

  return <div className="flex flex-col gap-6">
    <AnalyticsHeader title={translate("requesters.title", { ns: "starter" }, "Requesters")} description={translate("requesters.description", { ns: "starter" }, "Understand who is asking for help, their company context, and the complete history behind each relationship.")} actions={<div className="flex items-center gap-2"><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate("requesters.search", { ns: "starter" }, "Search requesters")} /></div><Button type="button" size="sm" onClick={() => openChild("create")}><Plus />{translate("requesters.actions.new", { ns: "starter" }, "New requester")}</Button></div>} />
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard label={translate("requesters.kpi.profiles", { ns: "starter" }, "Requester profiles")} value={result.data.length} icon={<Users />} loading={query.isLoading} /><MetricCard label={translate("requesters.kpi.companies", { ns: "starter" }, "Companies")} value={companies} icon={<Building2 />} loading={query.isLoading} /><MetricCard label={translate("requesters.kpi.repeat", { ns: "starter" }, "Repeat requesters")} value={repeat} detail={translate("requesters.kpi.repeatDetail", { ns: "starter" }, "More than one ticket")} loading={query.isLoading} /></div>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {query.isLoading ? <Skeleton className="h-80 w-full" /> : <Table><TableHeader><TableRow><TableHead>{translate("requesters.fields.name", { ns: "starter" }, "Requester")}</TableHead><TableHead>{translate("requesters.fields.company", { ns: "starter" }, "Company")}</TableHead><TableHead>{translate("requesters.fields.email", { ns: "starter" }, "Email")}</TableHead><TableHead className="text-right">{translate("requesters.fields.tickets", { ns: "starter" }, "Tickets")}</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{rows.map((requester) => { const count = tickets.data.filter((ticket) => ticket.requester_id === requester.id).length; return <TableRow key={requester.id} className="cursor-pointer" onClick={() => openChild(String(requester.id))}><TableCell className="font-medium">{requester.name}</TableCell><TableCell>{requester.company}</TableCell><TableCell className="text-muted-foreground">{requester.email}</TableCell><TableCell className="text-right tabular-nums">{count}</TableCell><TableCell><ChevronRight className="size-4 text-muted-foreground" /></TableCell></TableRow>; })}</TableBody></Table>}
      {!query.isLoading && rows.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">{translate("requesters.empty", { ns: "starter" }, "No requesters match this search.")}</p> : null}
    </section>
    <Outlet />
  </div>;
}


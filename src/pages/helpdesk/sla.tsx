import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { AlarmClockOff, Pencil, Plus, ShieldCheck, Timer } from "lucide-react";
import { useMemo } from "react";
import { Outlet } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterCombobox } from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./badges";
import { CategoryBadge, SlaBadge } from "./badges";
import {
  ACTIVE_STATUSES,
  agentDisplayName,
  formatDateTime,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  TICKET_PRIORITIES,
  translateTicketPriority,
  type AgentRef,
  type SlaPolicyRecord,
  type TicketRecord,
} from "./lib";
import { AgentAvatar } from "./tickets/ticket-list";
import { useOpenContextualChild } from "./route-surfaces";

export function SlaPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const { result: policiesResult } = useList<SlaPolicyRecord>({
    resource: "desk_sla_policies",
    pagination: { mode: "server", currentPage: 1, pageSize: 20 },
    sorters: [{ field: "resolve_mins", order: "asc" }],
  });
  const agentOptions = useMemo(
    () =>
      agentsResult.data.map((agent) => ({
        value: String(agent.id),
        label: agentDisplayName(
          agent,
          translate(
            "tickets.assignee.unassigned",
            { ns: "starter" },
            "Unassigned"
          )
        ),
      })),
    [agentsResult.data, translate]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<TicketRecord>();
    return [
      columnHelper.accessor("subject", {
        id: "subject",
        header: translate(
          "tickets.resource.singular",
          { ns: "starter" },
          "Ticket"
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openChild(String(row.original.id))}
            className="max-w-80 truncate text-left font-medium hover:underline"
            title={row.original.subject}
          >
            {row.original.subject}
          </button>
        ),
      }),
      columnHelper.accessor("priority", {
        id: "priority",
        header: ({ column, table }) => (
          <div className="flex items-center gap-1">
            <span>{translate("tickets.fields.priority", { ns: "starter" }, "Priority")}</span>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_PRIORITIES.map((priority) => ({
                value: priority,
                label: translateTicketPriority(translate, priority),
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate("tickets.filters.priority", { ns: "starter" }, "Filter by priority")}
              multiple
            />
          </div>
        ),
        enableSorting: false,
        cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
      }),
      columnHelper.display({
        id: "category",
        header: translate("tickets.fields.category", { ns: "starter" }, "Category"),
        enableSorting: false,
        cell: ({ row }) => <CategoryBadge category={row.original.category} />,
      }),
      columnHelper.accessor((record) => record.assigneeId, {
        id: "assignee.id",
        header: ({ column, table }) => (
          <div className="flex items-center gap-1">
            <span>{translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")}</span>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={agentOptions}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate("tickets.filters.assignee", { ns: "starter" }, "Filter by assignee")}
              multiple
            />
          </div>
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <AgentAvatar agent={row.original.assignee} className="size-6" />
            <span className="text-muted-foreground">
              {agentDisplayName(
                row.original.assignee,
                translate(
                  "tickets.assignee.unassigned",
                  { ns: "starter" },
                  "Unassigned"
                )
              )}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("resolution_due_at", {
        id: "resolution_due_at",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <span>{translate("tickets.fields.resolutionDue", { ns: "starter" }, "Deadline")}</span>
            <DataTableSorter column={column} />
          </div>
        ),
        enableSorting: true,
        cell: ({ getValue }) => formatDateTime(getValue(), locale),
      }),
      columnHelper.display({
        id: "sla",
        header: translate("tickets.fields.slaStatus", { ns: "starter" }, "SLA status"),
        enableSorting: false,
        cell: ({ row }) => {
          const due = getTicketDueAt(row.original);
          const state = getSlaState(row.original);
          return (
            <SlaBadge
              state={state}
              detail={
                due && state !== "on_track"
                  ? formatRelativeDeadline(due, translate)
                  : undefined
              }
            />
          );
        },
      }),
    ];
  }, [agentOptions, locale, openChild, translate]);

  const table = useTable<TicketRecord>({
    columns,
    refineCoreProps: {
      resource: "desk_tickets",
      syncWithLocation: false,
      filters: {
        permanent: [
          { field: "status", operator: "in", value: ACTIVE_STATUSES },
        ],
      },
      meta: { appends: ["assignee", "sla_policy", "queue"] },
      sorters: {
        initial: [{ field: "resolution_due_at", order: "asc" }],
      },
    },
  });

  const rows = table.refineCore.tableQuery.data?.data ?? [];
  const overdueCount = rows.filter(
    (ticket) => getSlaState(ticket) === "overdue"
  ).length;
  const dueSoonCount = rows.filter(
    (ticket) => getSlaState(ticket) === "due_soon"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center text-muted-foreground">
          <Breadcrumb />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.035em]">{translate("sla.title", { ns: "starter" }, "SLA & escalations")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {translate(
                "sla.description",
                { ns: "starter" },
                "Active tickets ordered by deadline. Overdue and due-soon tickets sit at the top."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 rounded-full border border-red-300/60 bg-red-50 px-3 py-1 font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              <AlarmClockOff className="size-3.5" />
              {translate("sla.summary.overdue", { ns: "starter", count: overdueCount }, "{{count}} overdue")}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <Timer className="size-3.5" />
              {translate("sla.summary.dueWithin", { ns: "starter", count: dueSoonCount, hours: 2 }, "{{count}} due within {{hours}}h")}
            </span>
            <Button type="button" size="sm" onClick={() => openChild("policy/create")}>
              <Plus />
              {translate("slaPolicies.actions.new", { ns: "starter" }, "New SLA policy")}
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {policiesResult.data.map((policy) => (
          <section key={policy.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <button type="button" className="min-w-0 text-left" onClick={() => openChild(`policy/show/${policy.id}`)}>
                <p className="truncate text-sm font-semibold hover:underline">{policy.name}</p>
                <div className="mt-2"><PriorityBadge priority={policy.priority} /></div>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button type="button" variant="ghost" size="icon" aria-label={translate("slaPolicies.actions.edit", { ns: "starter" }, "Edit policy")} title={translate("slaPolicies.actions.edit", { ns: "starter" }, "Edit policy")} onClick={() => openChild(`policy/edit/${policy.id}`)}><Pencil /></Button>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">{translate("sla.policy.response", { ns: "starter" }, "First response")}</dt><dd className="mt-1 font-semibold">{translate("sla.policy.minutes", { ns: "starter", count: policy.response_mins }, "{{count}} min")}</dd></div><div><dt className="text-muted-foreground">{translate("sla.policy.resolve", { ns: "starter" }, "Resolution")}</dt><dd className="mt-1 font-semibold">{translate("sla.policy.minutes", { ns: "starter", count: policy.resolve_mins }, "{{count}} min")}</dd></div></dl>
          </section>
        ))}
      </div>
      <DataTable table={table} />
      <Outlet />
    </div>
  );
}

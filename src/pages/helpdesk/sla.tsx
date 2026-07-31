import { useGetLocale, useList } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { AlarmClockOff, Timer } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, Outlet } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterCombobox } from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { PriorityBadge } from "./badges";
import { CategoryBadge, SlaBadge } from "./badges";
import {
  ACTIVE_STATUSES,
  agentDisplayName,
  formatDateTime,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  PRIORITY_LABELS,
  TICKET_PRIORITIES,
  type AgentRef,
  type TicketRecord,
} from "./lib";
import { AgentAvatar } from "./tickets/ticket-list";

export function SlaPage() {
  const navigate = useNavigate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const agentOptions = useMemo(
    () =>
      agentsResult.data.map((agent) => ({
        value: String(agent.id),
        label: agentDisplayName(agent),
      })),
    [agentsResult.data]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<TicketRecord>();
    return [
      columnHelper.accessor("subject", {
        id: "subject",
        header: "Ticket",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => navigate(`/sla/${row.original.id}`)}
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
            <span>Priority</span>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_PRIORITIES.map((priority) => ({
                value: priority,
                label: PRIORITY_LABELS[priority],
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder="Filter by priority"
              multiple
            />
          </div>
        ),
        enableSorting: false,
        cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
      }),
      columnHelper.display({
        id: "category",
        header: "Category",
        enableSorting: false,
        cell: ({ row }) => <CategoryBadge category={row.original.category} />,
      }),
      columnHelper.accessor((record) => record.assigneeId, {
        id: "assignee.id",
        header: ({ column, table }) => (
          <div className="flex items-center gap-1">
            <span>Assignee</span>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={agentOptions}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder="Filter by assignee"
              multiple
            />
          </div>
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <AgentAvatar agent={row.original.assignee} className="size-6" />
            <span className="text-muted-foreground">
              {agentDisplayName(row.original.assignee)}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("resolution_due_at", {
        id: "resolution_due_at",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <span>Deadline</span>
            <DataTableSorter column={column} />
          </div>
        ),
        enableSorting: true,
        cell: ({ getValue }) => formatDateTime(getValue(), locale),
      }),
      columnHelper.display({
        id: "sla",
        header: "SLA status",
        enableSorting: false,
        cell: ({ row }) => {
          const due = getTicketDueAt(row.original);
          const state = getSlaState(row.original);
          return (
            <SlaBadge
              state={state}
              detail={
                due && state !== "on_track"
                  ? formatRelativeDeadline(due)
                  : undefined
              }
            />
          );
        },
      }),
    ];
  }, [agentOptions, locale, navigate]);

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
      meta: { appends: ["assignee"] },
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
            <h2 className="text-3xl font-semibold tracking-[-0.035em]">SLA</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Active tickets ordered by deadline. Overdue and due-soon tickets
              sit at the top.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 rounded-full border border-red-300/60 bg-red-50 px-3 py-1 font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              <AlarmClockOff className="size-3.5" />
              {overdueCount} overdue
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <Timer className="size-3.5" />
              {dueSoonCount} due within 2h
            </span>
          </div>
        </div>
      </div>
      <DataTable table={table} />
      <Outlet />
    </div>
  );
}

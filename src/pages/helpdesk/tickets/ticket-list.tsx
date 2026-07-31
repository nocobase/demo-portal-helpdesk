import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import {
  DataTableFilterCombobox,
  DataTableFilterDropdownText,
} from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { DeleteButton } from "@/components/resources/buttons/delete";
import { EditButton } from "@/components/resources/buttons/edit";
import { ShowButton } from "@/components/resources/buttons/show";
import { ListView } from "@/components/resources/views/list-view";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CategoryBadge, PriorityBadge, SlaBadge, TicketStatusBadge } from "../badges";
import {
  agentDisplayName,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  type AgentRef,
  type TicketRecord,
} from "../lib";

function TicketColumnHeader<TValue>({
  children,
  column,
  label,
  sortable = true,
}: {
  children?: ReactNode;
  column: Column<TicketRecord, TValue>;
  label: string;
  sortable?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      {sortable ? <DataTableSorter column={column} /> : null}
      {children}
    </div>
  );
}

export const ticketPaths = {
  list: "/tickets",
  create: "/tickets/create",
  edit: (id: number | string) => `/tickets/edit/${id}`,
  show: (id: number | string) => `/tickets/show/${id}`,
};

export function AgentAvatar({
  agent,
  className,
}: {
  agent?: AgentRef | null;
  className?: string;
}) {
  const initials = agentDisplayName(agent)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export function TicketList() {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const navigate = useNavigate();
  const openTicket = useCallback(
    (id: number) => navigate(ticketPaths.show(id)),
    [navigate]
  );
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
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label="Subject">
            <DataTableFilterDropdownText
              column={column}
              table={table}
              defaultOperator="contains"
              operators={["contains", "eq", "startswith"]}
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openTicket(row.original.id)}
            className="max-w-72 truncate text-left font-medium hover:underline"
            title={row.original.subject}
          >
            {row.original.subject}
          </button>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label="Status" sortable={false}>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABELS[status],
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder="Filter by status"
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        cell: ({ getValue }) => <TicketStatusBadge status={getValue()} />,
      }),
      columnHelper.accessor("priority", {
        id: "priority",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label="Priority" sortable={false}>
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
          </TicketColumnHeader>
        ),
        enableSorting: false,
        cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
      }),
      columnHelper.accessor("category", {
        id: "category",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label="Category" sortable={false}>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_CATEGORIES.map((category) => ({
                value: category,
                label: CATEGORY_LABELS[category],
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder="Filter by category"
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
      }),
      columnHelper.accessor("requester_name", {
        id: "requester_name",
        header: ({ column }) => (
          <TicketColumnHeader column={column} label="Requester" sortable={false} />
        ),
        enableSorting: false,
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor((record) => record.assigneeId, {
        id: "assignee.id",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label="Assignee" sortable={false}>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={agentOptions}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder="Filter by assignee"
              multiple
            />
          </TicketColumnHeader>
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
      columnHelper.display({
        id: "sla",
        header: "SLA",
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
        enableSorting: false,
      }),
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: ({ column }) => (
          <TicketColumnHeader column={column} label="Created" />
        ),
        enableSorting: true,
        cell: ({ getValue }) =>
          getValue()
            ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(getValue())
              )
            : "-",
      }),
      columnHelper.display({
        id: "actions",
        header: translate("tickets.fields.actions", {}, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <EditButton
              resource="desk_tickets"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label="Edit ticket"
              title="Edit ticket"
            >
              <Pencil />
            </EditButton>
            <ShowButton
              resource="desk_tickets"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label="View ticket"
              title="View ticket"
            >
              <Eye />
            </ShowButton>
            <DeleteButton
              resource="desk_tickets"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label="Delete ticket"
              title="Delete ticket"
            >
              <Trash2 />
            </DeleteButton>
          </div>
        ),
        enableSorting: false,
        size: 144,
      }),
    ];
  }, [agentOptions, locale, openTicket, translate]);

  const table = useTable<TicketRecord>({
    columns,
    refineCoreProps: {
      resource: "desk_tickets",
      syncWithLocation: false,
      meta: {
        appends: ["assignee"],
      },
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView resource="desk_tickets">
      <DataTable table={table} />
    </ListView>
  );
}

import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper, type Column } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";

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
import { PriorityBadge, TicketStatusBadge } from "../badges";
import {
  agentDisplayName,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AgentRef,
  type TicketRecord,
  translateTicketPriority,
  translateTicketStatus,
} from "../lib";
import { useOpenContextualChild } from "../route-surfaces";

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
  const translate = useTranslate();
  const initials = agentDisplayName(
    agent,
    translate(
      "tickets.assignee.unassigned",
      { ns: "starter" },
      "Unassigned"
    )
  )
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
  const openChild = useOpenContextualChild();
  const openTicket = useCallback(
    (id: number) => openChild(`show/${id}`),
    [openChild]
  );
  const editTicket = useCallback(
    (id: number) => openChild(`edit/${id}`),
    [openChild]
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
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label={translate("tickets.fields.subject", { ns: "starter" }, "Subject")}>
            <DataTableFilterDropdownText
              column={column}
              table={table}
              defaultOperator="contains"
              operators={["contains", "eq", "startswith"]}
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 460,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openTicket(row.original.id)}
            className="block w-full truncate text-left font-medium hover:underline"
            title={row.original.subject}
          >
            {row.original.subject}
          </button>
        ),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label={translate("tickets.fields.status", { ns: "starter" }, "Status")} sortable={false}>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_STATUSES.map((status) => ({
                value: status,
                label: translateTicketStatus(translate, status),
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate("tickets.filters.status", { ns: "starter" }, "Filter by status")}
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 124,
        cell: ({ getValue }) => <TicketStatusBadge status={getValue()} />,
      }),
      columnHelper.accessor("priority", {
        id: "priority",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label={translate("tickets.fields.priority", { ns: "starter" }, "Priority")} sortable={false}>
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
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 116,
        cell: ({ getValue }) => <PriorityBadge priority={getValue()} />,
      }),
      columnHelper.accessor((record) => record.assigneeId, {
        id: "assignee.id",
        header: ({ column, table }) => (
          <TicketColumnHeader column={column} label={translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")} sortable={false}>
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={agentOptions}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate("tickets.filters.assignee", { ns: "starter" }, "Filter by assignee")}
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 168,
        cell: ({ row }) => {
          const name = agentDisplayName(
            row.original.assignee,
            translate(
              "tickets.assignee.unassigned",
              { ns: "starter" },
              "Unassigned"
            )
          );
          return (
            <div className="flex items-center gap-2" title={name}>
              <AgentAvatar agent={row.original.assignee} className="size-6 shrink-0" />
              <span className="truncate text-muted-foreground">{name}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("updatedAt", {
        id: "updatedAt",
        header: ({ column }) => (
          <TicketColumnHeader column={column} label={translate("tickets.fields.updated", { ns: "starter" }, "Updated")} />
        ),
        enableSorting: true,
        size: 124,
        cell: ({ getValue }) =>
          getValue()
            ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(getValue())
              )
            : "-",
      }),
      columnHelper.display({
        id: "actions",
        header: translate("tickets.fields.actions", { ns: "starter" }, "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <EditButton
              resource="desk_tickets"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("tickets.actions.edit", { ns: "starter" }, "Edit ticket")}
              title={translate("tickets.actions.edit", { ns: "starter" }, "Edit ticket")}
              onClick={() => editTicket(row.original.id)}
            >
              <Pencil />
            </EditButton>
            <ShowButton
              resource="desk_tickets"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              aria-label={translate("tickets.actions.view", { ns: "starter" }, "View ticket")}
              title={translate("tickets.actions.view", { ns: "starter" }, "View ticket")}
              onClick={() => openTicket(row.original.id)}
            >
              <Eye />
            </ShowButton>
            <DeleteButton
              resource="desk_tickets"
              recordItemId={row.original.id}
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label={translate("tickets.actions.delete", { ns: "starter" }, "Delete ticket")}
              title={translate("tickets.actions.delete", { ns: "starter" }, "Delete ticket")}
            >
              <Trash2 />
            </DeleteButton>
          </div>
        ),
        enableSorting: false,
        size: 120,
      }),
    ];
  }, [agentOptions, editTicket, locale, openTicket, translate]);

  const table = useTable<TicketRecord>({
    columns,
    refineCoreProps: {
      resource: "desk_tickets",
      syncWithLocation: false,
      meta: {
        appends: ["assignee", "queue", "ticket_type", "requester", "sla_policy"],
      },
      pagination: {
        mode: "server",
        currentPage: 1,
        pageSize: 20,
      },
      sorters: {
        initial: [{ field: "updatedAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView resource="desk_tickets">
      <DataTable table={table} />
    </ListView>
  );
}

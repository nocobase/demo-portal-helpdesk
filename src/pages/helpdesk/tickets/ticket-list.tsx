import {
  useGetIdentity,
  useGetLocale,
  useList,
  useNotification,
  useTranslate,
  useUpdate,
  type CrudFilters,
} from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import {
  createColumnHelper,
  type Column,
  type RowSelectionState,
} from "@tanstack/react-table";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import {
  AlertTriangle,
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Columns3,
  Download,
  Eye,
  Pencil,
  Printer,
  RefreshCw,
  Rows3,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CategoryBadge, PriorityBadge, TicketStatusBadge } from "../badges";
import {
  downloadCsv,
  escapeHtml,
  openPrintDocument,
  type CsvColumn,
} from "../export";
import {
  agentDisplayName,
  formatDateTime,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  translateTicketPriority,
  translateTicketStatus,
  type AgentRef,
  type NamedRecord,
  type SlaPolicyRecord,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
} from "../lib";
import {
  allowedTicketStatusTransitions,
  buildTicketPriorityChange,
  buildTicketStatusTransition,
  policyForPriority,
} from "../ticket-mutations";
import { buildSlaClock, formatCountdown, isClockBreached } from "../sla-metrics";
import { densityClassName, useTicketTablePrefs } from "../table-prefs";
import { TicketBulkActions } from "../ticket-bulk-actions";
import {
  findTicketView,
  toNocoBaseFilter,
  TICKET_VIEWS,
  useTicketViewCounts,
  type TicketView,
} from "../ticket-views";
import { useNow } from "../use-now";
import { useOpenContextualChild } from "../route-surfaces";

const SAVED_VIEWS_KEY = "helpdesk.tickets.saved-views";
const EXPORT_LIMIT = 1000;

type SavedView = {
  id: string;
  name: string;
  baseViewId: string;
  filters: CrudFilters;
};

const readSavedViews = (): SavedView[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
};

const writeSavedViews = (views: SavedView[]) => {
  try {
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Storage being unavailable must not stop the agent from working.
  }
};

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

/**
 * The ticket queue, organised the way a support desk works: a strip of saved
 * views on top (Zendesk's "Unassigned", "Your unsolved", "Breaching SLA"), the
 * table underneath, and bulk actions once rows are ticked. The active view and
 * the search term live in the URL, so any queue an agent is looking at can be
 * pasted into chat and opened by a colleague in the same state.
 */
export function TicketList() {
  const translate = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: identity } = useGetIdentity<AgentRef & { id: number }>();
  const [savedViews, setSavedViews] = useState<SavedView[]>(readSavedViews);
  const [searchDraft, setSearchDraft] = useState(
    () => searchParams.get("q") ?? ""
  );

  const viewParam = searchParams.get("view");
  const savedView = viewParam?.startsWith("saved:")
    ? savedViews.find((item) => `saved:${item.id}` === viewParam)
    : undefined;
  const view = findTicketView(
    savedView ? savedView.baseViewId : viewParam ?? undefined
  );
  const search = searchParams.get("q")?.trim() ?? "";
  const counts = useTicketViewCounts(identity?.id);

  useEffect(() => {
    setSearchDraft(searchParams.get("q") ?? "");
  }, [searchParams]);

  const selectView = useCallback(
    (key: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (key === "all") next.delete("view");
          else next.set("view", key);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const applySearch = useCallback(
    (value: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value.trim()) next.set("q", value.trim());
          else next.delete("q");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const removeSavedView = useCallback(
    (id: string) => {
      setSavedViews((current) => {
        const next = current.filter((item) => item.id !== id);
        writeSavedViews(next);
        return next;
      });
      if (viewParam === `saved:${id}`) selectView("all");
    },
    [selectView, viewParam]
  );

  const addSavedView = useCallback(
    (name: string, filters: CrudFilters) => {
      const entry: SavedView = {
        id: String(Date.now()),
        name,
        baseViewId: view.id,
        filters,
      };
      setSavedViews((current) => {
        const next = [...current, entry];
        writeSavedViews(next);
        return next;
      });
      selectView(`saved:${entry.id}`);
    },
    [selectView, view.id]
  );

  return (
    <ListView resource="desk_tickets">
      <ViewStrip
        activeKey={viewParam ?? "all"}
        counts={counts.data}
        hasIdentity={Boolean(identity?.id)}
        savedViews={savedViews}
        onSelect={selectView}
        onRemoveSaved={removeSavedView}
      />

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative w-full sm:w-80"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch(searchDraft);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onBlur={() => applySearch(searchDraft)}
            className="pl-9"
            placeholder={translate(
              "tickets.search.placeholder",
              { ns: "starter" },
              "Search subject or requester"
            )}
          />
          {search ? (
            <button
              type="button"
              aria-label={translate(
                "tickets.search.clear",
                { ns: "starter" },
                "Clear search"
              )}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => {
                setSearchDraft("");
                applySearch("");
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </form>
        <p className="text-xs text-muted-foreground">
          {translate(
            view.descriptionI18nKey,
            { ns: "starter" },
            view.descriptionFallback
          )}
        </p>
      </div>

      <TicketTable
        key={`${viewParam ?? "all"}:${search}`}
        view={view}
        search={search}
        initialFilters={savedView?.filters}
        identityId={identity?.id}
        onSaveView={addSavedView}
        onCountsStale={() => void counts.refetch()}
      />
    </ListView>
  );
}

function ViewStrip({
  activeKey,
  counts,
  hasIdentity,
  savedViews,
  onSelect,
  onRemoveSaved,
}: {
  activeKey: string;
  counts?: Record<string, number | null>;
  hasIdentity: boolean;
  savedViews: SavedView[];
  onSelect: (key: string) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const translate = useTranslate();
  const visible = TICKET_VIEWS.filter(
    (view) => !view.requiresIdentity || hasIdentity
  );

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((view) => {
        const count = counts?.[view.id];
        const active = activeKey === view.id;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelect(view.id)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                : "bg-card text-muted-foreground hover:bg-accent/50"
            )}
          >
            <view.icon
              className={cn(
                "size-4",
                view.tone === "danger" && "text-red-600 dark:text-red-400",
                view.tone === "warning" && "text-amber-600 dark:text-amber-400",
                view.tone === "success" && "text-emerald-600 dark:text-emerald-400"
              )}
            />
            <span>{translate(view.i18nKey, { ns: "starter" }, view.fallback)}</span>
            <Badge
              variant="outline"
              className={cn(
                "h-5 min-w-6 justify-center px-1.5 tabular-nums",
                view.tone === "danger" &&
                  (count ?? 0) > 0 &&
                  "border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
              )}
            >
              {count ?? "—"}
            </Badge>
          </button>
        );
      })}
      {savedViews.map((saved) => {
        const key = `saved:${saved.id}`;
        const active = activeKey === key;
        return (
          <span
            key={saved.id}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-2 text-sm transition-colors",
              active
                ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                : "bg-card text-muted-foreground"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(key)}
              className="flex items-center gap-2 px-1"
            >
              <Bookmark className="size-4" />
              {saved.name}
            </button>
            <button
              type="button"
              aria-label={translate(
                "tickets.views.removeSaved",
                { ns: "starter" },
                "Remove saved view"
              )}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => onRemoveSaved(saved.id)}
            >
              <X className="size-3.5" />
            </button>
          </span>
        );
      })}
    </div>
  );
}

function TicketTable({
  view,
  search,
  initialFilters,
  identityId,
  onSaveView,
  onCountsStale,
}: {
  view: TicketView;
  search: string;
  initialFilters?: CrudFilters;
  identityId?: number;
  onSaveView: (name: string, filters: CrudFilters) => void;
  onCountsStale: () => void;
}) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const now = useNow();
  const openChild = useOpenContextualChild();
  const { prefs, setColumnVisibility, setDensity, setPageSize } =
    useTicketTablePrefs();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [exporting, setExporting] = useState(false);
  const { open: notify } = useNotification();
  const update = useUpdate();

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
  const { result: queuesResult } = useList<NamedRecord>({
    resource: "desk_queues",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
    queryOptions: { retry: false },
  });
  const { result: policiesResult } = useList<SlaPolicyRecord>({
    resource: "desk_sla_policies",
    pagination: { mode: "server", currentPage: 1, pageSize: 20 },
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
  const queueOptions = useMemo(
    () =>
      queuesResult.data.map((queue) => ({
        value: String(queue.id),
        label: queue.name,
      })),
    [queuesResult.data]
  );

  const permanentFilters = useMemo<CrudFilters>(() => {
    const filters = [...view.buildFilters({ userId: identityId, now: new Date(now) })];
    if (search) {
      filters.push({
        operator: "or",
        value: [
          { field: "subject", operator: "contains", value: search },
          { field: "requester_name", operator: "contains", value: search },
          { field: "requester_email", operator: "contains", value: search },
        ],
      });
    }
    return filters;
    // The view definition and the search term decide the permanent filter set;
    // the ticking clock must not rebuild it every 30 seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityId, search, view]);

  const viewFilterFields = useMemo(
    () =>
      new Set(
        view
          .buildFilters({ userId: identityId, now: new Date() })
          .flatMap((filter) => ("field" in filter ? [filter.field] : []))
      ),
    [identityId, view]
  );

  const setStatus = useCallback(
    (ticket: TicketRecord, status: TicketStatus) => {
      let values: ReturnType<typeof buildTicketStatusTransition>;
      try {
        values = buildTicketStatusTransition(ticket, status);
      } catch (error) {
        notify?.({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "This ticket status transition could not be applied.",
        });
        return;
      }
      update.mutate({ resource: "desk_tickets", id: ticket.id, values });
    },
    [notify, update]
  );

  const setPriority = useCallback(
    (ticket: TicketRecord, priority: TicketPriority) =>
      update.mutate({
        resource: "desk_tickets",
        id: ticket.id,
        values: buildTicketPriorityChange(
          priority,
          policyForPriority(policiesResult.data, priority)
        ),
      }),
    [policiesResult.data, update]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<TicketRecord>();

    return [
      columnHelper.display({
        id: "select",
        size: 44,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(checked) =>
              table.toggleAllPageRowsSelected(Boolean(checked))
            }
            aria-label={translate(
              "tickets.bulk.selectAll",
              { ns: "starter" },
              "Select all tickets on this page"
            )}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            aria-label={translate(
              "tickets.bulk.selectRow",
              { ns: "starter" },
              "Select ticket"
            )}
          />
        ),
      }),
      columnHelper.accessor("subject", {
        id: "subject",
        header: ({ column, table }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.subject", { ns: "starter" }, "Subject")}
          >
            <DataTableFilterDropdownText
              column={column}
              table={table}
              defaultOperator="contains"
              operators={["contains", "eq", "startswith"]}
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 380,
        cell: ({ row }) => (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => openTicket(row.original.id)}
              className="block w-full truncate text-left font-medium hover:underline"
              title={row.original.subject}
            >
              {row.original.subject}
            </button>
            <p className="truncate text-xs text-muted-foreground">
              #{row.original.id} · {row.original.requester_name}
            </p>
          </div>
        ),
      }),
      columnHelper.display({
        id: "category",
        size: 148,
        enableSorting: false,
        header: translate("tickets.fields.category", { ns: "starter" }, "Category"),
        cell: ({ row }) => <CategoryBadge category={row.original.category} />,
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: ({ column, table }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.status", { ns: "starter" }, "Status")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_STATUSES.map((status) => ({
                value: status,
                label: translateTicketStatus(translate, status),
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate(
                "tickets.filters.status",
                { ns: "starter" },
                "Filter by status"
              )}
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 140,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={translate(
                    "tickets.inline.changeStatus",
                    { ns: "starter" },
                    "Change status"
                  )}
                >
                  <TicketStatusBadge status={row.original.status} />
                </button>
              }
            />
            <DropdownMenuContent align="start">
              {allowedTicketStatusTransitions(row.original.status).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStatus(row.original, status)}
                >
                  {translateTicketStatus(translate, status)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
      columnHelper.accessor("priority", {
        id: "priority",
        header: ({ column, table }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.priority", { ns: "starter" }, "Priority")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={TICKET_PRIORITIES.map((priority) => ({
                value: priority,
                label: translateTicketPriority(translate, priority),
              }))}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate(
                "tickets.filters.priority",
                { ns: "starter" },
                "Filter by priority"
              )}
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 124,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={translate(
                    "tickets.inline.changePriority",
                    { ns: "starter" },
                    "Change priority"
                  )}
                >
                  <PriorityBadge priority={row.original.priority} />
                </button>
              }
            />
            <DropdownMenuContent align="start">
              {TICKET_PRIORITIES.map((priority) => (
                <DropdownMenuItem
                  key={priority}
                  onClick={() => setPriority(row.original, priority)}
                >
                  {translateTicketPriority(translate, priority)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }),
      columnHelper.accessor((record) => record.assigneeId, {
        id: "assignee.id",
        header: ({ column, table }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={agentOptions}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate(
                "tickets.filters.assignee",
                { ns: "starter" },
                "Filter by assignee"
              )}
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
      columnHelper.accessor((record) => record.queue_id, {
        id: "queue.id",
        header: ({ column, table }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.queue", { ns: "starter" }, "Queue")}
            sortable={false}
          >
            <DataTableFilterCombobox
              column={column}
              table={table}
              options={queueOptions}
              defaultOperator="in"
              operators={["in", "nin"]}
              placeholder={translate(
                "tickets.filters.queue",
                { ns: "starter" },
                "Filter by queue"
              )}
              multiple
            />
          </TicketColumnHeader>
        ),
        enableSorting: false,
        size: 168,
        cell: ({ row }) => (
          <span className="truncate text-muted-foreground">
            {row.original.queue?.name ?? "-"}
          </span>
        ),
      }),
      columnHelper.accessor("resolution_due_at", {
        id: "resolution_due_at",
        header: ({ column }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.slaStatus", { ns: "starter" }, "SLA")}
          />
        ),
        enableSorting: true,
        size: 150,
        cell: ({ row }) => <SlaCountdownCell ticket={row.original} now={now} />,
      }),
      columnHelper.accessor("updatedAt", {
        id: "updatedAt",
        header: ({ column }) => (
          <TicketColumnHeader
            column={column}
            label={translate("tickets.fields.updated", { ns: "starter" }, "Updated")}
          />
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
        enableHiding: false,
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
  }, [
    agentOptions,
    editTicket,
    locale,
    now,
    openTicket,
    queueOptions,
    setPriority,
    setStatus,
    translate,
  ]);

  const table = useTable<TicketRecord>({
    columns,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    state: { rowSelection, columnVisibility: prefs.columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    refineCoreProps: {
      resource: "desk_tickets",
      syncWithLocation: false,
      meta: {
        appends: ["assignee", "queue", "ticket_type", "requester", "sla_policy"],
      },
      filters: { permanent: permanentFilters, initial: initialFilters },
      pagination: {
        mode: "server",
        currentPage: 1,
        pageSize: prefs.pageSize,
      },
      sorters: { initial: view.sorters },
    },
  });

  const {
    refineCore: { tableQuery, filters, sorters, pageSize },
  } = table;
  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total ?? 0;
  const exportBlocked = total > EXPORT_LIMIT;
  const selected = rows.filter((ticket) => rowSelection[String(ticket.id)]);

  // Page size is a table preference, so a change made in the pagination bar is
  // mirrored back into storage rather than being forgotten on the next visit.
  useEffect(() => {
    if (pageSize !== prefs.pageSize) setPageSize(pageSize);
  }, [pageSize, prefs.pageSize, setPageSize]);

  const csvColumns = useMemo<CsvColumn<TicketRecord>[]>(
    () => [
      { key: "id", label: "ID", value: (ticket) => ticket.id },
      {
        key: "subject",
        label: translate("tickets.fields.subject", { ns: "starter" }, "Subject"),
        value: (ticket) => ticket.subject,
      },
      {
        key: "status",
        label: translate("tickets.fields.status", { ns: "starter" }, "Status"),
        value: (ticket) => translateTicketStatus(translate, ticket.status),
      },
      {
        key: "priority",
        label: translate("tickets.fields.priority", { ns: "starter" }, "Priority"),
        value: (ticket) => translateTicketPriority(translate, ticket.priority),
      },
      {
        key: "requester",
        label: translate("tickets.show.requester", { ns: "starter" }, "Requester"),
        value: (ticket) => ticket.requester_name,
      },
      {
        key: "requester_email",
        label: translate("tickets.show.email", { ns: "starter" }, "Email"),
        value: (ticket) => ticket.requester_email,
      },
      {
        key: "assignee",
        label: translate("tickets.fields.assignee", { ns: "starter" }, "Assignee"),
        value: (ticket) => agentDisplayName(ticket.assignee, ""),
      },
      {
        key: "queue",
        label: translate("tickets.fields.queue", { ns: "starter" }, "Queue"),
        value: (ticket) => ticket.queue?.name,
      },
      {
        key: "created",
        label: translate("tickets.fields.created", { ns: "starter" }, "Created"),
        value: (ticket) => ticket.createdAt,
      },
      {
        key: "resolution_due_at",
        label: translate(
          "tickets.fields.resolutionDue",
          { ns: "starter" },
          "Resolution due"
        ),
        value: (ticket) => ticket.resolution_due_at,
      },
      {
        key: "resolved_at",
        label: translate("tickets.fields.resolved", { ns: "starter" }, "Resolved"),
        value: (ticket) => ticket.resolved_at,
      },
      {
        key: "sla_breached",
        label: translate("tickets.fields.slaStatus", { ns: "starter" }, "SLA"),
        value: (ticket) => (ticket.sla_breached ? "breached" : "met"),
      },
    ],
    [translate]
  );

  // This synchronous endpoint has a hard cap. Never create a file that looks
  // complete when the filtered result is larger than that cap.
  const fetchFiltered = () => {
    const filter = toNocoBaseFilter(filters);
    return nocobaseClient.action<TicketRecord[]>("desk_tickets", "list", {
      query: {
        page: 1,
        pageSize: EXPORT_LIMIT,
        ...(filter ? { filter: JSON.stringify(filter) } : {}),
        sort: sorters.map(
          (sorter) => `${sorter.order === "desc" ? "-" : ""}${sorter.field}`
        ),
        "appends[]": ["assignee", "queue"],
      },
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const records = await fetchFiltered();
      if (records.length !== total) {
        notify?.({
          type: "error",
          message: translate(
            "tickets.export.incomplete",
            { ns: "starter", exported: records.length, total },
            "Export stopped: the server returned {{exported}} of {{total}} matching tickets. No truncated file was downloaded."
          ),
        });
        return;
      }
      downloadCsv(
        `tickets-${view.id}-${new Date().toISOString().slice(0, 10)}.csv`,
        records,
        csvColumns
      );
      notify?.({
        type: "success",
        message: translate(
          "tickets.export.complete",
          { ns: "starter", count: records.length },
          "Exported all {{count}} matching tickets; the file was not truncated."
        ),
      });
    } finally {
      setExporting(false);
    }
  };

  const printList = async () => {
    setExporting(true);
    try {
      const records = await fetchFiltered();
      if (records.length !== total) {
        notify?.({
          type: "error",
          message: translate(
            "tickets.print.incomplete",
            { ns: "starter", loaded: records.length, total },
            "Print stopped: the server returned {{loaded}} of {{total}} matching tickets. No incomplete printout was opened."
          ),
        });
        return;
      }
      const viewLabel = translate(view.i18nKey, { ns: "starter" }, view.fallback);
      const head = csvColumns
        .map((column) => `<th>${escapeHtml(column.label)}</th>`)
        .join("");
      const body = records
        .map(
          (record) =>
            `<tr>${csvColumns
              .map((column) => `<td>${escapeHtml(column.value(record))}</td>`)
              .join("")}</tr>`
        )
        .join("");
      openPrintDocument(
        viewLabel,
        `<h1>${escapeHtml(viewLabel)}</h1>
<p class="meta">${escapeHtml(
          translate(
            "tickets.print.listHeader",
            { ns: "starter", count: records.length },
            "{{count}} tickets"
          )
        )}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
      );
      notify?.({
        type: "success",
        message: translate(
          "tickets.print.complete",
          { ns: "starter", count: records.length },
          "Loaded all {{count}} matching tickets for printing."
        ),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {translate(
            "tickets.toolbar.total",
            { ns: "starter", count: total },
            "{{count}} tickets match"
          )}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onSaveView(
                translate(
                  "tickets.views.savedName",
                  { ns: "starter", name: translate(view.i18nKey, { ns: "starter" }, view.fallback) },
                  "{{name}} (custom)"
                ),
                // Only the agent's own column filters are worth saving. The
                // view's own conditions are rebuilt on load, and some of them
                // (a breach cut-off, for instance) are relative to now.
                filters.filter(
                  (filter) =>
                    "field" in filter && !viewFilterFields.has(filter.field)
                )
              )
            }
          >
            <BookmarkPlus />
            {translate("tickets.views.save", { ns: "starter" }, "Save view")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <Columns3 />
                  {translate("tickets.toolbar.columns", { ns: "starter" }, "Columns")}
                  <ChevronDown />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {translate(
                  "tickets.toolbar.visibleColumns",
                  { ns: "starter" },
                  "Visible columns"
                )}
              </DropdownMenuLabel>
              {table.reactTable
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) =>
                      column.toggleVisibility(Boolean(checked))
                    }
                  >
                    {COLUMN_LABELS[column.id]
                      ? translate(
                          COLUMN_LABELS[column.id].i18nKey,
                          { ns: "starter" },
                          COLUMN_LABELS[column.id].fallback
                        )
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {translate("tickets.toolbar.density", { ns: "starter" }, "Density")}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={prefs.density === "comfortable"}
                onCheckedChange={() => setDensity("comfortable")}
              >
                {translate(
                  "tickets.toolbar.densityComfortable",
                  { ns: "starter" },
                  "Comfortable"
                )}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={prefs.density === "compact"}
                onCheckedChange={() => setDensity("compact")}
              >
                {translate(
                  "tickets.toolbar.densityCompact",
                  { ns: "starter" },
                  "Compact"
                )}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDensity(prefs.density === "compact" ? "comfortable" : "compact")
            }
            aria-label={translate(
              "tickets.toolbar.toggleDensity",
              { ns: "starter" },
              "Toggle row density"
            )}
            title={translate(
              "tickets.toolbar.toggleDensity",
              { ns: "starter" },
              "Toggle row density"
            )}
          >
            <Rows3 />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting || total === 0 || exportBlocked}
            onClick={() => void exportCsv()}
          >
            <Download />
            {translate("tickets.toolbar.export", { ns: "starter" }, "Export CSV")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting || total === 0 || exportBlocked}
            aria-label={translate(
              "tickets.toolbar.print",
              { ns: "starter" },
              "Print this view"
            )}
            title={translate(
              "tickets.toolbar.print",
              { ns: "starter" },
              "Print this view"
            )}
            onClick={() => void printList()}
          >
            <Printer />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={translate("buttons.refresh", { ns: "starter" }, "Refresh")}
            title={translate("buttons.refresh", { ns: "starter" }, "Refresh")}
            onClick={() => {
              void tableQuery.refetch();
              onCountsStale();
            }}
          >
            <RefreshCw className={cn(tableQuery.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {exportBlocked ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            {translate(
              "tickets.export.limitExceeded",
              { ns: "starter", count: total, limit: EXPORT_LIMIT },
              "Export is unavailable for {{count}} matching tickets because the synchronous export limit is {{limit}}. Narrow the filters; no truncated file has been downloaded."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {tableQuery.isError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              {translate(
                "tickets.list.loadError",
                { ns: "starter" },
                "The ticket list could not be loaded. Check your connection or permissions and try again."
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void tableQuery.refetch()}
            >
              <RefreshCw />
              {translate("buttons.retry", { ns: "starter" }, "Retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className={densityClassName(prefs.density)}>
          <DataTable table={table} />
        </div>
      )}

      {selected.length ? (
        <TicketBulkActions
          selected={selected}
          agents={agentsResult.data}
          policies={policiesResult.data}
          onClear={() => setRowSelection({})}
          onDone={() => {
            setRowSelection({});
            void tableQuery.refetch();
            onCountsStale();
          }}
        />
      ) : null}
    </div>
  );
}

const COLUMN_LABELS: Record<string, { i18nKey: string; fallback: string }> = {
  subject: { i18nKey: "tickets.fields.subject", fallback: "Subject" },
  category: { i18nKey: "tickets.fields.category", fallback: "Category" },
  status: { i18nKey: "tickets.fields.status", fallback: "Status" },
  priority: { i18nKey: "tickets.fields.priority", fallback: "Priority" },
  "assignee.id": { i18nKey: "tickets.fields.assignee", fallback: "Assignee" },
  "queue.id": { i18nKey: "tickets.fields.queue", fallback: "Queue" },
  resolution_due_at: { i18nKey: "tickets.fields.slaStatus", fallback: "SLA" },
  updatedAt: { i18nKey: "tickets.fields.updated", fallback: "Updated" },
};

/**
 * The SLA cell doubles as the escalation signal in the list: a live countdown
 * while the clock runs, and a red, unmissable overdue state once it passes.
 */
function SlaCountdownCell({
  ticket,
  now,
}: {
  ticket: TicketRecord;
  now: number;
}) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const clock = buildSlaClock(ticket, "resolution", new Date(now));

  if (!clock.dueAt) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (clock.metAt) {
    return (
      <span
        className={cn(
          "text-xs font-medium",
          clock.breached
            ? "text-red-600 dark:text-red-400"
            : "text-emerald-600 dark:text-emerald-400"
        )}
        title={formatDateTime(ticket.resolved_at, getLocale())}
      >
        {clock.breached
          ? translate("tickets.sla.cell.missed", { ns: "starter" }, "Missed")
          : translate("tickets.sla.cell.met", { ns: "starter" }, "Met")}
      </span>
    );
  }
  const breached = isClockBreached(clock);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        breached
          ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
          : clock.consumed > 0.75
            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            : "text-muted-foreground"
      )}
      title={formatDateTime(ticket.resolution_due_at, getLocale())}
    >
      {breached ? <AlertTriangle className="size-3" /> : null}
      {formatCountdown(clock.remainingMs ?? 0, translate)}
    </span>
  );
}

import {
  useNotification,
  useTranslate,
  type CrudFilters,
} from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Download,
  MessageSquareHeart,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnalyticsHeader, MetricCard } from "./analytics-ui";
import { downloadCsv, type CsvColumn } from "./export";
import type { RequesterRecord } from "./lib";
import { useOpenContextualChild } from "./route-surfaces";
import { toNocoBaseFilter } from "./ticket-views";

const EXPORT_LIMIT = 1000;

type RequesterCountRow = {
  n: number;
  requester_id: number;
};

type RequesterCsatRow = RequesterCountRow & {
  avg_score: number | null;
};

type CompanyRow = {
  company: string | null;
};

export function RequestersPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchDraft]);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("requesters.title", { ns: "starter" }, "Requesters")}
        description={translate(
          "requesters.description",
          { ns: "starter" },
          "Understand who is asking for help, their company context, and the complete history behind each relationship."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={translate(
                  "requesters.search",
                  { ns: "starter" },
                  "Search requesters"
                )}
              />
            </div>
            <Button type="button" size="sm" onClick={() => openChild("create")}>
              <Plus />
              {translate(
                "requesters.actions.new",
                { ns: "starter" },
                "New requester"
              )}
            </Button>
          </div>
        }
      />
      <RequesterTable key={search} search={search} />
      <Outlet />
    </div>
  );
}

function RequesterTable({ search }: { search: string }) {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const { open: notify } = useNotification();
  const [exporting, setExporting] = useState(false);

  const totalTicketsQuery = useQuery({
    queryKey: ["requesters", "ticket-counts"],
    queryFn: () =>
      nocobaseClient.action<RequesterCountRow[]>("desk_tickets", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [
            { field: ["requester_id"], alias: "requester_id" },
          ],
        },
      }),
  });
  const openTicketsQuery = useQuery({
    queryKey: ["requesters", "open-ticket-counts"],
    queryFn: () =>
      nocobaseClient.action<RequesterCountRow[]>("desk_tickets", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [
            { field: ["requester_id"], alias: "requester_id" },
          ],
          filter: { status: { $in: ["open", "in_progress"] } },
        },
      }),
  });
  const csatQuery = useQuery({
    queryKey: ["requesters", "csat"],
    queryFn: () =>
      nocobaseClient.action<RequesterCsatRow[]>("desk_csat", "query", {
        body: {
          measures: [
            { field: ["score"], aggregation: "avg", alias: "avg_score" },
            { field: ["id"], aggregation: "count", alias: "n" },
          ],
          dimensions: [
            {
              field: ["ticket", "requester_id"],
              alias: "requester_id",
            },
          ],
        },
      }),
  });
  const companiesQuery = useQuery({
    queryKey: ["requesters", "companies"],
    queryFn: () =>
      nocobaseClient.action<CompanyRow[]>("desk_requesters", "query", {
        body: {
          measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
          dimensions: [{ field: ["company"], alias: "company" }],
        },
      }),
  });

  const ticketCounts = useMemo(
    () =>
      new Map(
        (totalTicketsQuery.data ?? []).map((row) => [
          Number(row.requester_id),
          Number(row.n),
        ])
      ),
    [totalTicketsQuery.data]
  );
  const openCounts = useMemo(
    () =>
      new Map(
        (openTicketsQuery.data ?? []).map((row) => [
          Number(row.requester_id),
          Number(row.n),
        ])
      ),
    [openTicketsQuery.data]
  );
  const csatScores = useMemo(
    () =>
      new Map(
        (csatQuery.data ?? []).map((row) => [
          Number(row.requester_id),
          Number(row.avg_score),
        ])
      ),
    [csatQuery.data]
  );

  const permanentFilters = useMemo<CrudFilters>(
    () =>
      search
        ? [
            {
              operator: "or",
              value: [
                { field: "name", operator: "contains", value: search },
                { field: "email", operator: "contains", value: search },
                { field: "company", operator: "contains", value: search },
              ],
            },
          ]
        : [],
    [search]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<RequesterRecord>();
    const openRequester = (id: number) => openChild(String(id));

    return [
      columnHelper.accessor("name", {
        id: "name",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <span>
              {translate(
                "requesters.fields.name",
                { ns: "starter" },
                "Requester"
              )}
            </span>
            <DataTableSorter column={column} />
          </div>
        ),
        enableSorting: true,
        size: 280,
        cell: ({ row }) => (
          <button
            type="button"
            className="block w-full min-w-0 cursor-pointer text-left"
            onClick={() => openRequester(row.original.id)}
          >
            <span className="block truncate font-medium">{row.original.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {row.original.email}
            </span>
          </button>
        ),
      }),
      columnHelper.accessor("company", {
        id: "company",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <span>
              {translate(
                "requesters.fields.company",
                { ns: "starter" },
                "Company"
              )}
            </span>
            <DataTableSorter column={column} />
          </div>
        ),
        enableSorting: true,
        size: 220,
        cell: ({ row }) => (
          <button
            type="button"
            className="block w-full truncate text-left"
            onClick={() => openRequester(row.original.id)}
          >
            {row.original.company}
          </button>
        ),
      }),
      columnHelper.display({
        id: "tickets",
        header: () => (
          <span className="block w-full text-right">
            {translate(
              "requesters.fields.tickets",
              { ns: "starter" },
              "Tickets"
            )}
          </span>
        ),
        enableSorting: false,
        size: 100,
        cell: ({ row }) => (
          <button
            type="button"
            className="block w-full text-right tabular-nums"
            onClick={() => openRequester(row.original.id)}
          >
            {ticketCounts.get(Number(row.original.id)) ?? 0}
          </button>
        ),
      }),
      columnHelper.display({
        id: "open",
        header: () => (
          <span className="block w-full text-right">
            {translate(
              "requesters.fields.open",
              { ns: "starter" },
              "Open"
            )}
          </span>
        ),
        enableSorting: false,
        size: 100,
        cell: ({ row }) => {
          const count = openCounts.get(Number(row.original.id)) ?? 0;
          return (
            <button
              type="button"
              className={cn(
                "block w-full text-right tabular-nums",
                count > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
              onClick={() => openRequester(row.original.id)}
            >
              {count}
            </button>
          );
        },
      }),
      columnHelper.display({
        id: "csat",
        header: () => (
          <span className="block w-full text-right">
            {translate("requesters.fields.csat", { ns: "starter" }, "CSAT")}
          </span>
        ),
        enableSorting: false,
        size: 100,
        cell: ({ row }) => {
          const score = csatScores.get(Number(row.original.id));
          return (
            <button
              type="button"
              className={cn(
                "block w-full text-right tabular-nums",
                score === undefined && "text-muted-foreground",
                score !== undefined &&
                  score >= 4 &&
                  "text-emerald-600 dark:text-emerald-400",
                score !== undefined &&
                  score >= 3 &&
                  score < 4 &&
                  "text-amber-600 dark:text-amber-400",
                score !== undefined &&
                  score < 3 &&
                  "text-red-600 dark:text-red-400"
              )}
              onClick={() => openRequester(row.original.id)}
            >
              {score === undefined ? "—" : score.toFixed(1)}
            </button>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: translate(
          "requesters.fields.actions",
          { ns: "starter" },
          "Actions"
        ),
        enableSorting: false,
        enableHiding: false,
        size: 84,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={translate(
              "requesters.actions.view",
              { ns: "starter" },
              "View requester"
            )}
            title={translate(
              "requesters.actions.view",
              { ns: "starter" },
              "View requester"
            )}
            onClick={() => openRequester(row.original.id)}
          >
            <ChevronRight />
          </Button>
        ),
      }),
    ];
  }, [csatScores, openChild, openCounts, ticketCounts, translate]);

  const table = useTable<RequesterRecord>({
    columns,
    getRowId: (row) => String(row.id),
    refineCoreProps: {
      resource: "desk_requesters",
      syncWithLocation: false,
      filters: { permanent: permanentFilters },
      pagination: { mode: "server", currentPage: 1, pageSize: 20 },
      sorters: { initial: [{ field: "name", order: "asc" }] },
    },
  });

  const {
    refineCore: { tableQuery, filters, sorters },
  } = table;
  const total = tableQuery.data?.total ?? 0;
  const exportBlocked = total > EXPORT_LIMIT;
  const repeatRequesters = (totalTicketsQuery.data ?? []).filter(
    (row) => Number(row.n) > 1
  ).length;
  const csatTotals = (csatQuery.data ?? []).reduce(
    (totals, row) => ({
      score: totals.score + Number(row.avg_score) * Number(row.n),
      responses: totals.responses + Number(row.n),
    }),
    { score: 0, responses: 0 }
  );
  const averageCsat = csatTotals.responses
    ? csatTotals.score / csatTotals.responses
    : undefined;

  const csvColumns = useMemo<CsvColumn<RequesterRecord>[]>(
    () => [
      {
        key: "name",
        label: translate("requesters.export.name", { ns: "starter" }, "Name"),
        value: (requester) => requester.name,
      },
      {
        key: "email",
        label: translate(
          "requesters.fields.email",
          { ns: "starter" },
          "Email"
        ),
        value: (requester) => requester.email,
      },
      {
        key: "company",
        label: translate(
          "requesters.fields.company",
          { ns: "starter" },
          "Company"
        ),
        value: (requester) => requester.company,
      },
      {
        key: "tickets",
        label: translate(
          "requesters.fields.tickets",
          { ns: "starter" },
          "Tickets"
        ),
        value: (requester) => ticketCounts.get(Number(requester.id)) ?? 0,
      },
      {
        key: "open",
        label: translate(
          "requesters.fields.open",
          { ns: "starter" },
          "Open"
        ),
        value: (requester) => openCounts.get(Number(requester.id)) ?? 0,
      },
      {
        key: "csat",
        label: translate(
          "requesters.fields.csat",
          { ns: "starter" },
          "CSAT"
        ),
        value: (requester) => {
          const score = csatScores.get(Number(requester.id));
          return score === undefined ? null : score.toFixed(1);
        },
      },
    ],
    [csatScores, openCounts, ticketCounts, translate]
  );

  const fetchFiltered = () => {
    const filter = toNocoBaseFilter(filters);
    return nocobaseClient.action<RequesterRecord[]>(
      "desk_requesters",
      "list",
      {
        query: {
          page: 1,
          pageSize: EXPORT_LIMIT,
          ...(filter ? { filter: JSON.stringify(filter) } : {}),
          sort: sorters.map(
            (sorter) => `${sorter.order === "desc" ? "-" : ""}${sorter.field}`
          ),
        },
      }
    );
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const records = await fetchFiltered();
      if (records.length !== total) {
        notify?.({
          type: "error",
          message: translate(
            "requesters.export.incomplete",
            { ns: "starter", exported: records.length, total },
            "Export stopped: the server returned {{exported}} of {{total}} matching requesters. No truncated file was downloaded."
          ),
        });
        return;
      }
      downloadCsv(
        `requesters-${new Date().toISOString().slice(0, 10)}.csv`,
        records,
        csvColumns
      );
      notify?.({
        type: "success",
        message: translate(
          "requesters.export.complete",
          { ns: "starter", count: records.length },
          "Exported all {{count}} matching requesters; the file was not truncated."
        ),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={translate(
            "requesters.kpi.profiles",
            { ns: "starter" },
            "Requester profiles"
          )}
          value={total}
          icon={<Users />}
          loading={tableQuery.isLoading}
        />
        <MetricCard
          label={translate(
            "requesters.kpi.companies",
            { ns: "starter" },
            "Companies"
          )}
          value={companiesQuery.data?.length ?? 0}
          icon={<Building2 />}
          loading={companiesQuery.isLoading}
        />
        <MetricCard
          label={translate(
            "requesters.kpi.repeat",
            { ns: "starter" },
            "Repeat requesters"
          )}
          value={repeatRequesters}
          detail={translate(
            "requesters.kpi.repeatDetail",
            { ns: "starter" },
            "More than one ticket"
          )}
          loading={totalTicketsQuery.isLoading}
        />
        <MetricCard
          label={translate(
            "requesters.kpi.csat",
            { ns: "starter" },
            "Average CSAT"
          )}
          value={averageCsat === undefined ? "—" : `${averageCsat.toFixed(1)} / 5`}
          icon={<MessageSquareHeart />}
          loading={csatQuery.isLoading}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting || total === 0 || exportBlocked}
          onClick={() => void exportCsv()}
        >
          <Download />
          {translate(
            "requesters.actions.export",
            { ns: "starter" },
            "Export CSV"
          )}
        </Button>
      </div>

      {exportBlocked ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            {translate(
              "requesters.export.limitExceeded",
              { ns: "starter", count: total, limit: EXPORT_LIMIT },
              "Export is unavailable for {{count}} matching requesters because the synchronous export limit is {{limit}}. Narrow the search; no truncated file has been downloaded."
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
                "requesters.list.loadError",
                { ns: "starter" },
                "The requester list could not be loaded. Check your connection or permissions and try again."
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
        <DataTable table={table} />
      )}
    </div>
  );
}

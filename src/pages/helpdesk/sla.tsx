import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import {
  AlarmClockOff,
  MailCheck,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Outlet } from "react-router";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterCombobox } from "@/components/data-table/data-table-filter";
import { DataTableSorter } from "@/components/data-table/data-table-sorter";
import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChartCard, CHART_COLORS, MetricCard } from "./analytics-ui";
import { CategoryBadge, PriorityBadge, SlaBadge } from "./badges";
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
  type TicketPriority,
  type TicketRecord,
} from "./lib";
import {
  attainmentRate,
  buildSlaClock,
  formatCountdown,
  formatMinutes,
  isClockBreached,
  policyByPriority,
} from "./sla-metrics";
import { AgentAvatar } from "./tickets/ticket-list";
import { useNow } from "./use-now";
import { useOpenContextualChild } from "./route-surfaces";

type PriorityCountRow = { n: number; priority: TicketPriority };
type CountRow = { n: number };

const countByPriority = (filter?: Record<string, unknown>) =>
  nocobaseClient.action<PriorityCountRow[]>("desk_tickets", "query", {
    body: {
      measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
      dimensions: [{ field: ["priority"], alias: "priority" }],
      ...(filter ? { filter } : {}),
    },
  });

const sumRows = (rows?: PriorityCountRow[]) =>
  rows?.reduce((total, row) => total + row.n, 0) ?? 0;

const rowFor = (rows: PriorityCountRow[] | undefined, priority: TicketPriority) =>
  rows?.find((row) => row.priority === priority)?.n ?? 0;

const countTickets = (filter: Record<string, unknown>) =>
  nocobaseClient.action<CountRow[]>("desk_tickets", "query", {
    body: {
      measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
      filter,
    },
  });

/**
 * The SLA page a support lead is judged on: what the desk promised (the policy
 * matrix), whether it kept the promise (attainment per priority), and what is
 * currently at risk (the live breach list). Zendesk splits these across a
 * settings screen and a report; on one desk this size they belong together.
 */
export function SlaPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const now = useNow();
  const nowDate = new Date(now);
  const nowIso = nowDate.toISOString();
  const riskWindowEnd = new Date(
    nowDate.getTime() + 2 * 60 * 60 * 1000
  ).toISOString();
  const minuteBucket = nowIso.slice(0, 16);

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

  // Attainment is measured only over tickets where the clock has actually
  // stopped: a ticket that has not been answered yet has neither met nor
  // missed its first-response target.
  const totalQuery = useQuery({
    queryKey: ["sla", "total"],
    queryFn: () => countByPriority(),
  });
  const responseMeasuredQuery = useQuery({
    queryKey: ["sla", "response-measured"],
    queryFn: () => countByPriority({ first_responded_at: { $ne: null } }),
  });
  const responseMetQuery = useQuery({
    queryKey: ["sla", "response-met"],
    queryFn: () =>
      countByPriority({
        $and: [
          { first_responded_at: { $ne: null } },
          { response_breached: { $eq: false } },
        ],
      }),
  });
  const resolutionMeasuredQuery = useQuery({
    queryKey: ["sla", "resolution-measured"],
    queryFn: () => countByPriority({ resolved_at: { $ne: null } }),
  });
  const resolutionMetQuery = useQuery({
    queryKey: ["sla", "resolution-met"],
    queryFn: () =>
      countByPriority({
        $and: [
          { resolved_at: { $ne: null } },
          { resolution_breached: { $eq: false } },
        ],
      }),
  });
  const overdueQuery = useQuery({
    queryKey: ["sla", "risk", "overdue", minuteBucket],
    queryFn: () =>
      countTickets({
        status: { $in: ACTIVE_STATUSES },
        resolution_due_at: { $lte: nowIso },
      }).then((rows) => rows[0]?.n ?? 0),
  });
  const dueSoonQuery = useQuery({
    queryKey: ["sla", "risk", "due-soon", minuteBucket],
    queryFn: () =>
      countTickets({
        status: { $in: ACTIVE_STATUSES },
        resolution_due_at: { $gt: nowIso, $lte: riskWindowEnd },
      }).then((rows) => rows[0]?.n ?? 0),
  });

  const policies = policyByPriority(policiesResult.data);

  const matrix = TICKET_PRIORITIES.map((priority) => {
    const policy = policies.get(priority);
    const responseMeasured = rowFor(responseMeasuredQuery.data, priority);
    const responseMet = rowFor(responseMetQuery.data, priority);
    const resolutionMeasured = rowFor(resolutionMeasuredQuery.data, priority);
    const resolutionMet = rowFor(resolutionMetQuery.data, priority);
    return {
      priority,
      policy,
      governed: rowFor(totalQuery.data, priority),
      responseRate: attainmentRate(responseMet, responseMeasured),
      resolutionRate: attainmentRate(resolutionMet, resolutionMeasured),
      responseMeasured,
      resolutionMeasured,
    };
  });

  const overallResponse = attainmentRate(
    sumRows(responseMetQuery.data),
    sumRows(responseMeasuredQuery.data)
  );
  const overallResolution = attainmentRate(
    sumRows(resolutionMetQuery.data),
    sumRows(resolutionMeasuredQuery.data)
  );

  const attainmentChart = matrix.map((entry) => ({
    name: translateTicketPriority(translate, entry.priority),
    response: Math.round(entry.responseRate ?? 0),
    resolution: Math.round(entry.resolutionRate ?? 0),
  }));

  const agentOptions = useMemo(
    () =>
      agentsResult.data.map((agent) => ({
        value: String(agent.id),
        label: agentDisplayName(
          agent,
          translate("tickets.assignee.unassigned", { ns: "starter" }, "Unassigned")
        ),
      })),
    [agentsResult.data, translate]
  );

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<TicketRecord>();
    return [
      columnHelper.accessor("subject", {
        id: "subject",
        header: translate("tickets.resource.singular", { ns: "starter" }, "Ticket"),
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
            <span>
              {translate("tickets.fields.priority", { ns: "starter" }, "Priority")}
            </span>
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
            <span>
              {translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")}
            </span>
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
      columnHelper.display({
        id: "response_clock",
        header: translate(
          "tickets.sla.firstResponse",
          { ns: "starter" },
          "First response"
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <ClockCell ticket={row.original} target="response" now={now} />
        ),
      }),
      columnHelper.accessor("resolution_due_at", {
        id: "resolution_due_at",
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <span>
              {translate(
                "tickets.fields.resolutionDue",
                { ns: "starter" },
                "Deadline"
              )}
            </span>
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
  }, [agentOptions, locale, now, openChild, translate]);

  const table = useTable<TicketRecord>({
    columns,
    refineCoreProps: {
      resource: "desk_tickets",
      syncWithLocation: false,
      filters: {
        permanent: [
          { field: "status", operator: "in", value: ACTIVE_STATUSES },
          {
            field: "resolution_due_at",
            operator: "lte",
            value: riskWindowEnd,
          },
        ],
      },
      meta: { appends: ["assignee", "sla_policy", "queue"] },
      sorters: { initial: [{ field: "resolution_due_at", order: "asc" }] },
    },
  });

  const overdueCount = overdueQuery.data ?? 0;
  const dueSoonCount = dueSoonQuery.data ?? 0;
  const atRiskCount = overdueCount + dueSoonCount;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center text-muted-foreground">
          <Breadcrumb />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.035em]">
              {translate("sla.title", { ns: "starter" }, "SLA & escalations")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {translate(
                "sla.description",
                { ns: "starter" },
                "The response and resolution targets the desk commits to, how well they are being met, and everything currently at risk."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 rounded-full border border-red-300/60 bg-red-50 px-3 py-1 font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              <AlarmClockOff className="size-3.5" />
              {translate(
                "sla.summary.overdue",
                { ns: "starter", count: overdueCount },
                "{{count}} overdue"
              )}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
              <Timer className="size-3.5" />
              {translate(
                "sla.summary.dueWithin",
                { ns: "starter", count: dueSoonCount, hours: 2 },
                "{{count}} due within {{hours}}h"
              )}
            </span>
            <Button type="button" size="sm" onClick={() => openChild("policy/create")}>
              <Plus />
              {translate("slaPolicies.actions.new", { ns: "starter" }, "New SLA policy")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={translate(
            "sla.kpi.responseAttainment",
            { ns: "starter" },
            "First-response attainment"
          )}
          value={
            overallResponse === null ? "—" : `${Math.round(overallResponse)}%`
          }
          detail={translate(
            "sla.kpi.responseDetail",
            { ns: "starter", count: sumRows(responseMeasuredQuery.data) },
            "Across {{count}} answered tickets"
          )}
          icon={<MailCheck />}
          tone={(overallResponse ?? 100) >= 90 ? "success" : "danger"}
          loading={responseMeasuredQuery.isLoading}
        />
        <MetricCard
          label={translate(
            "sla.kpi.resolutionAttainment",
            { ns: "starter" },
            "Resolution attainment"
          )}
          value={
            overallResolution === null ? "—" : `${Math.round(overallResolution)}%`
          }
          detail={translate(
            "sla.kpi.resolutionDetail",
            { ns: "starter", count: sumRows(resolutionMeasuredQuery.data) },
            "Across {{count}} resolved tickets"
          )}
          icon={<ShieldCheck />}
          tone={(overallResolution ?? 100) >= 90 ? "success" : "danger"}
          loading={resolutionMeasuredQuery.isLoading}
        />
        <MetricCard
          label={translate("sla.kpi.atRiskWindow", { ns: "starter" }, "At risk right now")}
          value={atRiskCount}
          detail={translate(
            "sla.kpi.atRiskWindowDetail",
            { ns: "starter" },
            "All active tickets overdue or due within 2 hours"
          )}
          icon={<ShieldAlert />}
          tone={atRiskCount > 0 ? "danger" : "success"}
          loading={overdueQuery.isLoading || dueSoonQuery.isLoading}
        />
        <MetricCard
          label={translate("sla.kpi.policies", { ns: "starter" }, "Policies")}
          value={policiesResult.data.length}
          detail={translate(
            "sla.kpi.policiesDetail",
            { ns: "starter", count: TICKET_PRIORITIES.length - policies.size },
            "{{count}} priorities without a policy"
          )}
          icon={<ShieldCheck />}
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="border-b bg-muted/25 p-4">
          <h3 className="text-sm font-semibold">
            {translate("sla.matrix.title", { ns: "starter" }, "Policy matrix")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              "sla.matrix.description",
              { ns: "starter" },
              "The target the desk commits to per priority, and how often it is actually met."
            )}
          </p>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {translate("tickets.fields.priority", { ns: "starter" }, "Priority")}
              </TableHead>
              <TableHead>
                {translate("sla.matrix.policy", { ns: "starter" }, "Policy")}
              </TableHead>
              <TableHead className="text-right">
                {translate(
                  "sla.policy.response",
                  { ns: "starter" },
                  "First response"
                )}
              </TableHead>
              <TableHead className="text-right">
                {translate("sla.policy.resolve", { ns: "starter" }, "Resolution")}
              </TableHead>
              <TableHead className="text-right">
                {translate("sla.matrix.governed", { ns: "starter" }, "Tickets")}
              </TableHead>
              <TableHead className="text-right">
                {translate(
                  "sla.matrix.responseAttainment",
                  { ns: "starter" },
                  "Response met"
                )}
              </TableHead>
              <TableHead className="text-right">
                {translate(
                  "sla.matrix.resolutionAttainment",
                  { ns: "starter" },
                  "Resolution met"
                )}
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map((entry) => (
              <TableRow key={entry.priority}>
                <TableCell>
                  <PriorityBadge priority={entry.priority} />
                </TableCell>
                <TableCell>
                  {entry.policy ? (
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() => openChild(`policy/show/${entry.policy?.id}`)}
                    >
                      {entry.policy.name}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {translate(
                        "sla.matrix.missingPolicy",
                        { ns: "starter" },
                        "No policy defined"
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.policy
                    ? formatMinutes(entry.policy.response_mins, translate)
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.policy
                    ? formatMinutes(entry.policy.resolve_mins, translate)
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.governed}
                </TableCell>
                <TableCell className="text-right">
                  <AttainmentValue
                    rate={entry.responseRate}
                    measured={entry.responseMeasured}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <AttainmentValue
                    rate={entry.resolutionRate}
                    measured={entry.resolutionMeasured}
                  />
                </TableCell>
                <TableCell>
                  {entry.policy ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={translate(
                        "slaPolicies.actions.edit",
                        { ns: "starter" },
                        "Edit policy"
                      )}
                      title={translate(
                        "slaPolicies.actions.edit",
                        { ns: "starter" },
                        "Edit policy"
                      )}
                      onClick={() => openChild(`policy/edit/${entry.policy?.id}`)}
                    >
                      <Pencil />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <ChartCard
        title={translate(
          "sla.attainment.title",
          { ns: "starter" },
          "Attainment by priority"
        )}
        description={translate(
          "sla.attainment.description",
          { ns: "starter" },
          "Share of tickets that met each target, measured once the clock stopped."
        )}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={attainmentChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="response"
              name={translate(
                "sla.policy.response",
                { ns: "starter" },
                "First response"
              )}
              fill={CHART_COLORS[0]}
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="resolution"
              name={translate("sla.policy.resolve", { ns: "starter" }, "Resolution")}
              fill={CHART_COLORS[1]}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          {translate("sla.risk.title", { ns: "starter" }, "At risk right now")}
        </h3>
        <DataTable table={table} />
      </section>
      <Outlet />
    </div>
  );
}

function AttainmentValue({
  rate,
  measured,
}: {
  rate: number | null;
  measured: number;
}) {
  const translate = useTranslate();
  if (rate === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {translate("sla.matrix.noData", { ns: "starter" }, "No data yet")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "text-sm font-semibold tabular-nums",
        rate >= 90
          ? "text-emerald-600 dark:text-emerald-400"
          : rate >= 70
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-600 dark:text-red-400"
      )}
      title={translate(
        "sla.matrix.measuredOver",
        { ns: "starter", count: measured },
        "Measured over {{count}} tickets"
      )}
    >
      {Math.round(rate)}%
    </span>
  );
}

function ClockCell({
  ticket,
  target,
  now,
}: {
  ticket: TicketRecord;
  target: "response" | "resolution";
  now: number;
}) {
  const translate = useTranslate();
  const clock = buildSlaClock(ticket, target, new Date(now));
  if (!clock.dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  if (clock.metAt) {
    return (
      <span
        className={cn(
          "text-xs font-medium",
          clock.breached
            ? "text-red-600 dark:text-red-400"
            : "text-emerald-600 dark:text-emerald-400"
        )}
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
        "text-xs font-medium tabular-nums",
        breached
          ? "text-red-600 dark:text-red-400"
          : clock.consumed > 0.75
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
      )}
    >
      {formatCountdown(clock.remainingMs ?? 0, translate)}
    </span>
  );
}

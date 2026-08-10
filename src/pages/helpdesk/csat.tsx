import { useQuery } from "@tanstack/react-query";
import { useList, useTranslate } from "@refinedev/core";
import {
  MessageSquareText,
  Smile,
  Star,
  ThumbsDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
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
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import {
  AnalyticsHeader,
  ChartCard,
  CHART_COLORS,
  MetricCard,
  shortNumber,
} from "./analytics-ui";
import { agentDisplayName, formatDateTime, type AgentRef, type CsatRecord } from "./lib";

type TrendRow = { avg_score: number; n: number; date: string };
type ScoreRow = { n: number; score: number };
type AgentRow = { avg_csat: number; n: number; assigneeId: number | null };

const RANGES = [
  { id: "30d", i18nKey: "csat.range.30d", fallback: "Last 30 days", days: 30 },
  { id: "90d", i18nKey: "csat.range.90d", fallback: "Last 90 days", days: 90 },
  { id: "12m", i18nKey: "csat.range.12m", fallback: "Last 12 months", days: 365 },
  { id: "all", i18nKey: "csat.range.all", fallback: "All time", days: null },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const rangeStart = (days: number | null) =>
  days === null
    ? undefined
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const aggregate = <T,>(body: Record<string, unknown>) =>
  nocobaseClient.action<T[]>("desk_csat", "query", { body });

/**
 * Satisfaction, read the way a support lead reads it: the headline score, the
 * shape of the distribution, who is delivering it, and — the part that actually
 * changes anything — the individual low scores that still need a follow-up.
 */
export function CsatPage() {
  const translate = useTranslate();
  const [range, setRange] = useState<RangeId>("12m");
  const activeRange = RANGES.find((item) => item.id === range) ?? RANGES[2];
  const rangeStartAt = useMemo(
    () => rangeStart(activeRange.days),
    [activeRange.days]
  );
  const filter = rangeStartAt
    ? { createdAt: { $gte: rangeStartAt } }
    : undefined;
  const listRangeFilters = rangeStartAt
    ? [{ field: "createdAt", operator: "gte" as const, value: rangeStartAt }]
    : [];

  const { result: agents } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });

  const trendQuery = useQuery({
    queryKey: ["csat", "trend", range],
    queryFn: () =>
      aggregate<TrendRow>({
        measures: [
          { field: ["score"], aggregation: "avg", alias: "avg_score" },
          { field: ["id"], aggregation: "count", alias: "n" },
        ],
        dimensions: [{ field: ["createdAt"], alias: "date" }],
        ...(filter ? { filter } : {}),
      }),
  });
  const scoreQuery = useQuery({
    queryKey: ["csat", "distribution", range],
    queryFn: () =>
      aggregate<ScoreRow>({
        measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
        dimensions: [{ field: ["score"], alias: "score" }],
        orders: [{ field: ["score"], alias: "score", order: "asc" }],
        ...(filter ? { filter } : {}),
      }),
  });
  const agentQuery = useQuery({
    queryKey: ["csat", "by-agent", range],
    queryFn: () =>
      aggregate<AgentRow>({
        measures: [
          { field: ["score"], aggregation: "avg", alias: "avg_csat" },
          { field: ["id"], aggregation: "count", alias: "n" },
        ],
        dimensions: [{ field: ["ticket", "assigneeId"], alias: "assigneeId" }],
        ...(filter ? { filter } : {}),
      }),
  });

  const { result: recent, query: recentQuery } = useList<CsatRecord>({
    resource: "desk_csat",
    filters: listRangeFilters,
    pagination: { mode: "server", currentPage: 1, pageSize: 8 },
    sorters: [{ field: "createdAt", order: "desc" }],
    meta: { appends: ["ticket"] },
  });
  const { result: detractors, query: detractorsQuery } = useList<CsatRecord>({
    resource: "desk_csat",
    filters: [
      { field: "score", operator: "lte", value: 3 },
      ...listRangeFilters,
    ],
    pagination: { mode: "server", currentPage: 1, pageSize: 10 },
    sorters: [{ field: "createdAt", order: "desc" }],
    meta: { appends: ["ticket"] },
  });

  const totals = scoreQuery.data ?? [];
  const responseCount = totals.reduce((sum, row) => sum + row.n, 0);
  const average = responseCount
    ? totals.reduce((sum, row) => sum + row.score * row.n, 0) / responseCount
    : 0;
  const positive = responseCount
    ? (totals
        .filter((row) => row.score >= 4)
        .reduce((sum, row) => sum + row.n, 0) /
        responseCount) *
      100
    : 0;
  const negative = responseCount
    ? (totals
        .filter((row) => row.score <= 2)
        .reduce((sum, row) => sum + row.n, 0) /
        responseCount) *
      100
    : 0;

  const months = new Map<string, { sum: number; n: number }>();
  for (const row of trendQuery.data ?? []) {
    const key = row.date.slice(0, 7);
    const current = months.get(key) ?? { sum: 0, n: 0 };
    current.sum += row.avg_score * row.n;
    current.n += row.n;
    months.set(key, current);
  }
  const trend = [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, item]) => ({
      month,
      score: Number((item.sum / item.n).toFixed(2)),
      responses: item.n,
    }));

  const distribution = [1, 2, 3, 4, 5].map((score) => ({
    score: `${score}★`,
    responses: totals.find((row) => Number(row.score) === score)?.n ?? 0,
  }));

  const byAgent = (agentQuery.data ?? [])
    .filter((row) => row.assigneeId != null)
    .map((row) => ({
      id: Number(row.assigneeId),
      name: agentDisplayName(
        agents.data.find((agent) => Number(agent.id) === Number(row.assigneeId)),
        translate("tickets.assignee.unknown", { ns: "starter" }, "Unknown agent")
      ),
      score: Number(Number(row.avg_csat).toFixed(2)),
      responses: row.n,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("csat.title", { ns: "starter" }, "Customer satisfaction")}
        description={translate(
          "csat.description",
          { ns: "starter" },
          "Track post-resolution feedback, identify weak moments, and keep customer sentiment visible to the support team."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
            {RANGES.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={item.id === range ? "secondary" : "ghost"}
                onClick={() => setRange(item.id)}
              >
                {translate(item.i18nKey, { ns: "starter" }, item.fallback)}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={translate("csat.kpi.average", { ns: "starter" }, "Average score")}
          value={`${shortNumber(average)} / 5`}
          detail={translate(
            "csat.kpi.averageDetail",
            { ns: "starter" },
            "Across all submitted surveys"
          )}
          icon={<Star />}
          loading={scoreQuery.isLoading}
        />
        <MetricCard
          label={translate("csat.kpi.positive", { ns: "starter" }, "Positive ratings")}
          value={`${Math.round(positive)}%`}
          detail={translate(
            "csat.kpi.positiveDetail",
            { ns: "starter" },
            "Scores of four or five"
          )}
          icon={<Smile />}
          tone="success"
          loading={scoreQuery.isLoading}
        />
        <MetricCard
          label={translate("csat.kpi.negative", { ns: "starter" }, "Negative ratings")}
          value={`${Math.round(negative)}%`}
          detail={translate(
            "csat.kpi.negativeDetail",
            { ns: "starter" },
            "Scores of one or two — each one deserves a call back"
          )}
          icon={<ThumbsDown />}
          tone={negative > 10 ? "danger" : undefined}
          loading={scoreQuery.isLoading}
        />
        <MetricCard
          label={translate("csat.kpi.responses", { ns: "starter" }, "Responses")}
          value={responseCount}
          detail={translate(
            "csat.kpi.latestDetail",
            { ns: "starter" },
            "Most recent customer response"
          )}
          icon={<MessageSquareText />}
          loading={scoreQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title={translate("csat.trend.title", { ns: "starter" }, "CSAT trend")}
          description={translate(
            "csat.trend.description",
            { ns: "starter" },
            "Monthly average score with completed response volume."
          )}
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis
                yAxisId="score"
                domain={[1, 5]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="volume"
                dataKey="responses"
                name={translate("csat.kpi.responses", { ns: "starter" }, "Responses")}
                fill={CHART_COLORS[3]}
                radius={[6, 6, 0, 0]}
                barSize={18}
              />
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="score"
                name={translate("csat.kpi.average", { ns: "starter" }, "Average score")}
                stroke={CHART_COLORS[0]}
                strokeWidth={3}
                dot={{ r: 4, fill: CHART_COLORS[0] }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          className="lg:col-span-2"
          title={translate(
            "csat.distribution.title",
            { ns: "starter" },
            "Score distribution"
          )}
          description={translate(
            "csat.distribution.description",
            { ns: "starter" },
            "Submitted responses by rating."
          )}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="score" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="responses" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="border-b bg-muted/25 p-4">
          <h3 className="text-sm font-semibold">
            {translate("csat.byAgent.title", { ns: "starter" }, "Satisfaction by agent")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              "csat.byAgent.description",
              { ns: "starter" },
              "Average rating attributed to the agent who owned the ticket, with the number of responses behind it."
            )}
          </p>
        </header>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {translate("performance.fields.agent", { ns: "starter" }, "Agent")}
              </TableHead>
              <TableHead className="text-right">
                {translate("performance.fields.csat", { ns: "starter" }, "CSAT")}
              </TableHead>
              <TableHead className="text-right">
                {translate("csat.kpi.responses", { ns: "starter" }, "Responses")}
              </TableHead>
              <TableHead className="w-64">
                {translate("csat.byAgent.spread", { ns: "starter" }, "Relative")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byAgent.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    row.score >= 4
                      ? "text-emerald-600 dark:text-emerald-400"
                      : row.score >= 3
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                  )}
                >
                  {shortNumber(row.score)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.responses}
                </TableCell>
                <TableCell>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        row.score >= 4
                          ? "bg-emerald-500"
                          : row.score >= 3
                            ? "bg-amber-500"
                            : "bg-red-500"
                      )}
                      style={{ width: `${(row.score / 5) * 100}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title={translate(
            "csat.followUp.title",
            { ns: "starter" },
            "Needs a follow-up"
          )}
          description={translate(
            "csat.followUp.description",
            { ns: "starter" },
            "Responses of three or below in the selected period, newest first."
          )}
        >
          {detractorsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              {translate("common.loading", { ns: "starter" }, "Loading...")}
            </p>
          ) : detractors.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {translate(
                "csat.followUp.empty",
                { ns: "starter" },
                "No low scores in this period."
              )}
            </p>
          ) : (
            <ul className="divide-y">
              {detractors.data.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-medium">
                      {item.ticket?.subject ??
                        translate(
                          "csat.unknownTicket",
                          { ns: "starter" },
                          "Resolved ticket"
                        )}
                    </p>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                    >
                      {item.score} ★
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.comment ||
                      translate(
                        "csat.noComment",
                        { ns: "starter" },
                        "No comment provided."
                      )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title={translate("csat.recent.title", { ns: "starter" }, "Recent feedback")}
          description={translate(
            "csat.recent.description",
            { ns: "starter" },
            "The latest comments in the selected period, connected to resolved tickets."
          )}
        >
          {recentQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              {translate("common.loading", { ns: "starter" }, "Loading...")}
            </p>
          ) : recent.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {translate(
                "csat.recent.empty",
                { ns: "starter" },
                "No feedback in this period."
              )}
            </p>
          ) : (
            <div className="grid gap-3">
              {recent.data.map((item) => (
                <article key={item.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-semibold">
                      {item.ticket?.subject ??
                        translate(
                          "csat.unknownTicket",
                          { ns: "starter" },
                          "Resolved ticket"
                        )}
                    </p>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-primary/20 bg-primary/5 text-primary"
                    >
                      {item.score} ★
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.comment ||
                      translate(
                        "csat.noComment",
                        { ns: "starter" },
                        "No comment provided."
                      )}
                  </p>
                </article>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <p className="text-xs text-muted-foreground">
        <TrendingUp className="mr-1 inline size-3.5" />
        {translate(
          "csat.footnote",
          { ns: "starter" },
          "Surveys are recorded from the ticket drawer once a ticket is resolved or closed."
        )}
      </p>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useList, useTranslate } from "@refinedev/core";
import { MessageSquareText, Smile, Star, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { AnalyticsHeader, ChartCard, CHART_COLORS, MetricCard, shortNumber } from "./analytics-ui";
import type { CsatRecord } from "./lib";

type TrendRow = { avg_score: number; n: number; date: string };
type ScoreRow = { n: number; score: number };

export function CsatPage() {
  const translate = useTranslate();
  const trendQuery = useQuery({
    queryKey: ["csat", "trend"],
    queryFn: () => nocobaseClient.action<TrendRow[]>("desk_csat", "query", { body: {
      measures: [{ field: ["score"], aggregation: "avg", alias: "avg_score" }, { field: ["id"], aggregation: "count", alias: "n" }],
      dimensions: [{ field: ["createdAt"], alias: "date" }],
    } }),
  });
  const scoreQuery = useQuery({
    queryKey: ["csat", "distribution"],
    queryFn: () => nocobaseClient.action<ScoreRow[]>("desk_csat", "query", { body: {
      measures: [{ field: ["id"], aggregation: "count", alias: "n" }],
      dimensions: [{ field: ["score"], alias: "score" }],
      orders: [{ field: ["score"], alias: "score", order: "asc" }],
    } }),
  });
  const { result: recent, query: recentQuery } = useList<CsatRecord>({
    resource: "desk_csat",
    pagination: { mode: "server", currentPage: 1, pageSize: 8 },
    sorters: [{ field: "createdAt", order: "desc" }],
    meta: { appends: ["ticket"] },
  });
  const totals = scoreQuery.data ?? [];
  const responseCount = totals.reduce((sum, row) => sum + row.n, 0);
  const average = responseCount ? totals.reduce((sum, row) => sum + row.score * row.n, 0) / responseCount : 0;
  const positive = responseCount ? totals.filter((row) => row.score >= 4).reduce((sum, row) => sum + row.n, 0) / responseCount * 100 : 0;
  const months = new Map<string, { sum: number; n: number }>();
  for (const row of trendQuery.data ?? []) {
    const key = row.date.slice(0, 7);
    const current = months.get(key) ?? { sum: 0, n: 0 };
    current.sum += row.avg_score * row.n;
    current.n += row.n;
    months.set(key, current);
  }
  const trend = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, item]) => ({ month, score: Number((item.sum / item.n).toFixed(2)), responses: item.n }));
  const distribution = [1, 2, 3, 4, 5].map((score) => ({ score: `${score}★`, responses: totals.find((row) => Number(row.score) === score)?.n ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader title={translate("csat.title", { ns: "starter" }, "Customer satisfaction")} description={translate("csat.description", { ns: "starter" }, "Track post-resolution feedback, identify weak moments, and keep customer sentiment visible to the support team.")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={translate("csat.kpi.average", { ns: "starter" }, "Average score")} value={`${shortNumber(average)} / 5`} detail={translate("csat.kpi.averageDetail", { ns: "starter" }, "Across all submitted surveys")} icon={<Star />} loading={scoreQuery.isLoading} />
        <MetricCard label={translate("csat.kpi.positive", { ns: "starter" }, "Positive ratings")} value={`${Math.round(positive)}%`} detail={translate("csat.kpi.positiveDetail", { ns: "starter" }, "Scores of four or five")} icon={<Smile />} tone="success" loading={scoreQuery.isLoading} />
        <MetricCard label={translate("csat.kpi.responses", { ns: "starter" }, "Responses")} value={responseCount} detail={translate("csat.kpi.responsesDetail", { ns: "starter" }, "Completed after ticket resolution")} icon={<MessageSquareText />} loading={scoreQuery.isLoading} />
        <MetricCard label={translate("csat.kpi.latest", { ns: "starter" }, "Latest score")} value={recent.data[0] ? `${recent.data[0].score} / 5` : "—"} detail={translate("csat.kpi.latestDetail", { ns: "starter" }, "Most recent customer response")} icon={<TrendingUp />} loading={recentQuery.isLoading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" title={translate("csat.trend.title", { ns: "starter" }, "CSAT trend")} description={translate("csat.trend.description", { ns: "starter" }, "Monthly average score with completed response volume.")}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis domain={[1, 5]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="score" stroke={CHART_COLORS[0]} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS[0] }} /></LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard className="lg:col-span-2" title={translate("csat.distribution.title", { ns: "starter" }, "Score distribution")} description={translate("csat.distribution.description", { ns: "starter" }, "Submitted responses by rating.")}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="score" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip /><Bar dataKey="responses" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title={translate("csat.recent.title", { ns: "starter" }, "Recent feedback")} description={translate("csat.recent.description", { ns: "starter" }, "The latest comments connected to resolved tickets.")}>
        <div className="grid gap-3 md:grid-cols-2">
          {recent.data.map((item) => <article key={item.id} className="rounded-lg border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><p className="line-clamp-1 text-sm font-semibold">{item.ticket?.subject ?? translate("csat.unknownTicket", { ns: "starter" }, "Resolved ticket")}</p><Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 text-primary">{item.score} ★</Badge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.comment || translate("csat.noComment", { ns: "starter" }, "No comment provided.")}</p></article>)}
        </div>
      </ChartCard>
    </div>
  );
}


import { useQuery } from "@tanstack/react-query";
import { useList, useTranslate } from "@refinedev/core";
import { Award, Clock3, Gauge, Tickets } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { AnalyticsHeader, ChartCard, CHART_COLORS, MetricCard, shortNumber } from "./analytics-ui";
import { ACTIVE_STATUSES, agentDisplayName, type AgentRef } from "./lib";

type AgentMetric = { assigneeId: number | null; n: number; avg_resolution?: number | null; avg_csat?: number | null };

const agentQuery = (filter?: Record<string, unknown>, measures: Record<string, unknown>[] = [{ field: ["id"], aggregation: "count", alias: "n" }]) =>
  nocobaseClient.action<AgentMetric[]>("desk_tickets", "query", { body: { measures, dimensions: [{ field: ["assigneeId"], alias: "assigneeId" }], filter } });

export function AgentPerformancePage() {
  const translate = useTranslate();
  const { result: agents } = useList<AgentRef>({ resource: "users", pagination: { mode: "server", currentPage: 1, pageSize: 100 } });
  const resolvedQuery = useQuery({ queryKey: ["performance", "resolved"], queryFn: () => agentQuery({ status: { $in: ["resolved", "closed"] } }, [{ field: ["id"], aggregation: "count", alias: "n" }, { field: ["resolution_mins"], aggregation: "avg", alias: "avg_resolution" }]) });
  const workloadQuery = useQuery({ queryKey: ["performance", "workload"], queryFn: () => agentQuery({ status: { $in: ACTIVE_STATUSES } }) });
  const totalQuery = useQuery({ queryKey: ["performance", "sla-total"], queryFn: () => agentQuery() });
  const breachQuery = useQuery({ queryKey: ["performance", "sla-breach"], queryFn: () => agentQuery({ sla_breached: true }) });
  const csatQuery = useQuery({ queryKey: ["performance", "csat"], queryFn: () => nocobaseClient.action<AgentMetric[]>("desk_csat", "query", { body: { measures: [{ field: ["score"], aggregation: "avg", alias: "avg_csat" }, { field: ["id"], aggregation: "count", alias: "n" }], dimensions: [{ field: ["ticket", "assigneeId"], alias: "assigneeId" }] } }) });

  const ids = new Set<number>();
  for (const rows of [resolvedQuery.data, workloadQuery.data, totalQuery.data, csatQuery.data]) for (const row of rows ?? []) if (row.assigneeId) ids.add(Number(row.assigneeId));
  const rows = [...ids].map((id) => {
    const agent = agents.data.find((item) => Number(item.id) === id);
    const resolved = resolvedQuery.data?.find((item) => Number(item.assigneeId) === id);
    const workload = workloadQuery.data?.find((item) => Number(item.assigneeId) === id)?.n ?? 0;
    const total = totalQuery.data?.find((item) => Number(item.assigneeId) === id)?.n ?? 0;
    const breached = breachQuery.data?.find((item) => Number(item.assigneeId) === id)?.n ?? 0;
    const csatMetric = csatQuery.data?.find((item) => Number(item.assigneeId) === id);
    const csat = Number(csatMetric?.avg_csat ?? 0);
    return { id, name: agentDisplayName(agent, translate("tickets.assignee.unknown", { ns: "starter" }, "Unknown agent")), resolved: resolved?.n ?? 0, workload, total, breached, avgResolution: Number(resolved?.avg_resolution ?? 0), csat, csatResponses: Number(csatMetric?.n ?? 0), compliance: total ? ((total - breached) / total) * 100 : 100 };
  }).sort((a, b) => b.resolved - a.resolved);
  const totalResolved = rows.reduce((sum, row) => sum + row.resolved, 0);
  const active = rows.reduce((sum, row) => sum + row.workload, 0);
  const csatResponseCount = rows.reduce((sum, row) => sum + row.csatResponses, 0);
  const avgCsat = csatResponseCount
    ? rows.reduce((sum, row) => sum + row.csat * row.csatResponses, 0) /
      csatResponseCount
    : undefined;
  const slaTicketCount = rows.reduce((sum, row) => sum + row.total, 0);
  const slaBreachCount = rows.reduce((sum, row) => sum + row.breached, 0);
  const avgCompliance = slaTicketCount
    ? ((slaTicketCount - slaBreachCount) / slaTicketCount) * 100
    : undefined;
  const loading = resolvedQuery.isLoading || workloadQuery.isLoading || csatQuery.isLoading;

  return <div className="flex flex-col gap-6">
    <AnalyticsHeader title={translate("performance.title", { ns: "starter" }, "Agent performance")} description={translate("performance.description", { ns: "starter" }, "Compare throughput, handling time, customer satisfaction, workload, and SLA quality across the support team.")} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={translate("performance.kpi.resolved", { ns: "starter" }, "Tickets resolved")} value={totalResolved} icon={<Tickets />} loading={loading} /><MetricCard label={translate("performance.kpi.workload", { ns: "starter" }, "Active workload")} value={active} icon={<Gauge />} loading={loading} /><MetricCard label={translate("performance.kpi.csat", { ns: "starter" }, "Team CSAT")} value={avgCsat === undefined ? "—" : `${shortNumber(avgCsat)} / 5`} detail={translate("performance.kpi.csatResponses", { ns: "starter", count: csatResponseCount }, csatResponseCount ? "Weighted across {{count}} responses" : "No responses")} icon={<Award />} tone={avgCsat === undefined ? undefined : "success"} loading={loading} /><MetricCard label={translate("performance.kpi.sla", { ns: "starter" }, "SLA compliance")} value={avgCompliance === undefined ? "—" : `${Math.round(avgCompliance)}%`} icon={<Clock3 />} loading={loading} /></div>
    <div className="grid gap-4 lg:grid-cols-5"><ChartCard className="lg:col-span-3" title={translate("performance.chart.resolved", { ns: "starter" }, "Resolved by agent")} description={translate("performance.chart.resolvedDescription", { ns: "starter" }, "Completed tickets attributed to each assignee.")}><ResponsiveContainer width="100%" height={280}><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip /><Bar dataKey="resolved" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard className="lg:col-span-2" title={translate("performance.chart.workload", { ns: "starter" }, "Current workload")} description={translate("performance.chart.workloadDescription", { ns: "starter" }, "Open and in-progress tickets by assignee.")}><div className="space-y-4">{rows.map((row) => <div key={row.id}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium">{row.name}</span><span className="text-muted-foreground">{translate("performance.activeCount", { ns: "starter", count: row.workload }, "{{count}} active")}</span></div><Progress value={active ? row.workload / Math.max(...rows.map((item) => item.workload), 1) * 100 : 0} /></div>)}</div></ChartCard></div>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><Table><TableHeader><TableRow><TableHead>{translate("performance.fields.agent", { ns: "starter" }, "Agent")}</TableHead><TableHead className="text-right">{translate("performance.fields.resolved", { ns: "starter" }, "Resolved")}</TableHead><TableHead className="text-right">{translate("performance.fields.avgResolution", { ns: "starter" }, "Avg. resolution")}</TableHead><TableHead className="text-right">{translate("performance.fields.csat", { ns: "starter" }, "CSAT")}</TableHead><TableHead className="text-right">{translate("performance.fields.workload", { ns: "starter" }, "Workload")}</TableHead><TableHead className="text-right">{translate("performance.fields.sla", { ns: "starter" }, "SLA compliance")}</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.name}</TableCell><TableCell className="text-right tabular-nums">{row.resolved}</TableCell><TableCell className="text-right tabular-nums">{translate("performance.minutes", { ns: "starter", count: Math.round(row.avgResolution) }, "{{count}} min")}</TableCell><TableCell className="text-right tabular-nums">{row.csat ? shortNumber(row.csat) : "—"}</TableCell><TableCell className="text-right tabular-nums">{row.workload}</TableCell><TableCell className="text-right tabular-nums">{Math.round(row.compliance)}%</TableCell></TableRow>)}</TableBody></Table></section>
  </div>;
}

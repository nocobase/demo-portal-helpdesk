import { useQuery } from "@tanstack/react-query";
import { useList, useTranslate } from "@refinedev/core";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { AnalyticsHeader, ChartCard, CHART_COLORS } from "./analytics-ui";
import { translateTicketPriority, type NamedRecord, type TicketPriority } from "./lib";

type GroupRow = { n: number; queue_id?: number; ticket_type_id?: number; priority?: TicketPriority };
type TimeRow = { n: number; avg_resolution?: number; avg_score?: number; date: string };

const aggregate = <T,>(resource: string, body: Record<string, unknown>) => nocobaseClient.action<T[]>(resource, "query", { body });
const monthly = (rows: TimeRow[], value: "avg_resolution" | "avg_score") => {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const row of rows) { const key = row.date.slice(0, 7); const current = buckets.get(key) ?? { sum: 0, n: 0 }; current.sum += Number(row[value] ?? 0) * row.n; current.n += row.n; buckets.set(key, current); }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([month, item]) => ({ month, value: Number((item.sum / item.n).toFixed(1)), volume: item.n }));
};

export function ReportsPage() {
  const translate = useTranslate();
  const { result: queues } = useList<NamedRecord>({ resource: "desk_queues", pagination: { mode: "server", currentPage: 1, pageSize: 50 } });
  const { result: types } = useList<NamedRecord>({ resource: "desk_ticket_types", pagination: { mode: "server", currentPage: 1, pageSize: 50 } });
  const byQueue = useQuery({ queryKey: ["reports", "queue"], queryFn: () => aggregate<GroupRow>("desk_tickets", { measures: [{ field: ["id"], aggregation: "count", alias: "n" }], dimensions: [{ field: ["queue_id"], alias: "queue_id" }] }) });
  const byType = useQuery({ queryKey: ["reports", "type"], queryFn: () => aggregate<GroupRow>("desk_tickets", { measures: [{ field: ["id"], aggregation: "count", alias: "n" }], dimensions: [{ field: ["ticket_type_id"], alias: "ticket_type_id" }] }) });
  const byPriority = useQuery({ queryKey: ["reports", "priority"], queryFn: () => aggregate<GroupRow>("desk_tickets", { measures: [{ field: ["id"], aggregation: "count", alias: "n" }], dimensions: [{ field: ["priority"], alias: "priority" }] }) });
  const resolution = useQuery({ queryKey: ["reports", "resolution"], queryFn: () => aggregate<TimeRow>("desk_tickets", { measures: [{ field: ["resolution_mins"], aggregation: "avg", alias: "avg_resolution" }, { field: ["id"], aggregation: "count", alias: "n" }], dimensions: [{ field: ["resolved_at"], alias: "date" }], filter: { resolved_at: { $ne: null }, resolution_mins: { $ne: null } } }) });
  const csat = useQuery({ queryKey: ["reports", "csat"], queryFn: () => aggregate<TimeRow>("desk_csat", { measures: [{ field: ["score"], aggregation: "avg", alias: "avg_score" }, { field: ["id"], aggregation: "count", alias: "n" }], dimensions: [{ field: ["createdAt"], alias: "date" }] }) });
  const queueData = (byQueue.data ?? []).map((row) => ({ name: queues.data.find((item) => item.id === Number(row.queue_id))?.name ?? translate("reports.unassigned", { ns: "starter" }, "Unassigned"), tickets: row.n }));
  const typeData = (byType.data ?? []).map((row) => ({ name: types.data.find((item) => item.id === Number(row.ticket_type_id))?.name ?? translate("reports.unclassified", { ns: "starter" }, "Unclassified"), tickets: row.n }));
  const priorityData = (byPriority.data ?? []).map((row) => ({ name: row.priority ? translateTicketPriority(translate, row.priority) : translate("reports.unclassified", { ns: "starter" }, "Unclassified"), value: row.n }));
  const resolutionData = monthly(resolution.data ?? [], "avg_resolution");
  const csatData = monthly(csat.data ?? [], "avg_score");

  return <div className="flex flex-col gap-6">
    <AnalyticsHeader title={translate("reports.title", { ns: "starter" }, "Support reports")} description={translate("reports.description", { ns: "starter" }, "A durable operating view of ticket demand, work mix, resolution speed, and customer sentiment.")} />
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={translate("reports.queue.title", { ns: "starter" }, "Ticket volume by queue")} description={translate("reports.queue.description", { ns: "starter" }, "Demand routed to each specialist team.")}><ResponsiveContainer width="100%" height={280}><BarChart data={queueData} layout="vertical" margin={{ left: 18 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><Tooltip /><Bar dataKey="tickets" fill={CHART_COLORS[0]} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title={translate("reports.type.title", { ns: "starter" }, "Ticket volume by type")} description={translate("reports.type.description", { ns: "starter" }, "The mix of incidents, questions, requests, and product work.")}><ResponsiveContainer width="100%" height={280}><BarChart data={typeData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip /><Bar dataKey="tickets" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title={translate("reports.priority.title", { ns: "starter" }, "Volume by priority")} description={translate("reports.priority.description", { ns: "starter" }, "How demand is distributed across urgency tiers.")}><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} strokeWidth={0}>{priorityData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></ChartCard>
      <ChartCard title={translate("reports.resolution.title", { ns: "starter" }, "Resolution time trend")} description={translate("reports.resolution.description", { ns: "starter" }, "Monthly average handling time for completed tickets.")}><ResponsiveContainer width="100%" height={280}><LineChart data={resolutionData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="value" stroke={CHART_COLORS[2]} strokeWidth={3} dot={{ fill: CHART_COLORS[2], r: 4 }} /></LineChart></ResponsiveContainer></ChartCard>
    </div>
    <ChartCard title={translate("reports.csat.title", { ns: "starter" }, "CSAT trend")} description={translate("reports.csat.description", { ns: "starter" }, "Monthly customer satisfaction after resolution.")}><ResponsiveContainer width="100%" height={300}><LineChart data={csatData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><YAxis domain={[1, 5]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={3} dot={{ fill: CHART_COLORS[0], r: 4 }} /></LineChart></ResponsiveContainer></ChartCard>
  </div>;
}

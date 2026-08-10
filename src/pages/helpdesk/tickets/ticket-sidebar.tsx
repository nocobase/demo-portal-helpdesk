import { useGetLocale, useList, useTranslate, useUpdate } from "@refinedev/core";
import {
  Building2,
  History,
  Mail,
  ShieldCheck,
  Star,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PriorityBadge, TicketStatusBadge } from "../badges";
import {
  agentDisplayName,
  formatDateTime,
  TICKET_PRIORITIES,
  translateTicketPriority,
  type AgentRef,
  type CsatRecord,
  type NamedRecord,
  type SlaPolicyRecord,
  type TicketPriority,
  type TicketRecord,
} from "../lib";
import {
  buildTicketPriorityChange,
  policyForPriority,
} from "../ticket-mutations";
import {
  buildSlaClock,
  formatCountdown,
  isClockBreached,
  type SlaClock,
  type SlaTarget,
} from "../sla-metrics";
import { useNow } from "../use-now";

/**
 * Both SLA clocks, side by side. The first-response clock stops the moment an
 * agent replies; the resolution clock keeps running until the ticket is
 * resolved. Showing them together is what turns "SLA" from a badge into
 * something an agent can act on.
 */
export function SlaTimers({ record }: { record: TicketRecord }) {
  const translate = useTranslate();
  const now = useNow();

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Timer className="size-4 text-muted-foreground" />
        {translate("tickets.sla.timers", { ns: "starter" }, "SLA timers")}
      </h3>
      <SlaTimer
        clock={buildSlaClock(record, "response", new Date(now))}
        label={translate(
          "tickets.sla.firstResponse",
          { ns: "starter" },
          "First response"
        )}
      />
      <SlaTimer
        clock={buildSlaClock(record, "resolution", new Date(now))}
        label={translate("tickets.sla.resolution", { ns: "starter" }, "Resolution")}
      />
      {record.sla_policy ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          {translate(
            "tickets.show.slaPolicyLink",
            { ns: "starter", policy: record.sla_policy.name },
            "Policy: {{policy}}"
          )}
        </p>
      ) : null}
    </section>
  );
}

function SlaTimer({ clock, label }: { clock: SlaClock; label: string }) {
  const translate = useTranslate();
  const locale = useGetLocale()();
  const breached = isClockBreached(clock);
  const met = Boolean(clock.metAt);

  if (!clock.dueAt) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">
            {translate("tickets.sla.noTarget", { ns: "starter" }, "No target set")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            breached
              ? "font-semibold text-red-600 dark:text-red-400"
              : met
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : clock.consumed > 0.75
                  ? "font-semibold text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
          )}
        >
          {met
            ? breached
              ? translate("tickets.sla.cell.missed", { ns: "starter" }, "Missed")
              : translate("tickets.sla.cell.met", { ns: "starter" }, "Met")
            : formatCountdown(clock.remainingMs ?? 0, translate)}
        </span>
      </div>
      <Progress
        value={Math.min(100, clock.consumed * 100)}
        className={cn(
          "[&_[data-slot=progress-track]]:h-1.5",
          breached
            ? "[&_[data-slot=progress-indicator]]:bg-red-500"
            : met
              ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
              : clock.consumed > 0.75
                ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                : ""
        )}
      />
      <p className="text-[11px] text-muted-foreground">
        {targetCaption(clock, translate, locale)}
      </p>
    </div>
  );
}

const targetCaption = (
  clock: SlaClock,
  translate: ReturnType<typeof useTranslate>,
  locale?: string
) => {
  const target = formatDateTime(clock.dueAt?.toISOString(), locale);
  if (clock.metAt) {
    return translate(
      "tickets.sla.metAt",
      {
        ns: "starter",
        at: formatDateTime(clock.metAt.toISOString(), locale),
        target,
      },
      "{{at}} · target {{target}}"
    );
  }
  return translate(
    "tickets.sla.targetAt",
    { ns: "starter", target },
    "Target {{target}}"
  );
};

/**
 * The property panel: everything an agent changes without leaving the ticket.
 * Status stays out of here on purpose — it belongs to the transition buttons,
 * so the workflow cannot be bypassed with a dropdown.
 */
export function TicketProperties({
  record,
  agents,
  onUpdated,
  openChild,
}: {
  record: TicketRecord;
  agents: AgentRef[];
  onUpdated: () => void;
  openChild: (to: string) => void;
}) {
  const translate = useTranslate();
  const update = useUpdate();
  const { result: queues } = useList<NamedRecord>({
    resource: "desk_queues",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { retry: false },
  });
  const { result: types } = useList<NamedRecord>({
    resource: "desk_ticket_types",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { retry: false },
  });
  const { result: policies } = useList<SlaPolicyRecord>({
    resource: "desk_sla_policies",
    pagination: { mode: "server", currentPage: 1, pageSize: 20 },
    queryOptions: { retry: false },
  });

  const patch = (values: Record<string, unknown>) =>
    update.mutate(
      { resource: "desk_tickets", id: record.id, values },
      { onSuccess: onUpdated }
    );

  const unassigned = translate(
    "tickets.assignee.unassigned",
    { ns: "starter" },
    "Unassigned"
  );
  const selectedAssignee =
    agents.find((agent) => agent.id === record.assigneeId) ?? record.assignee;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium">
        {translate("tickets.show.properties", { ns: "starter" }, "Properties")}
      </h3>

      <PropertyRow
        label={translate("tickets.fields.status", { ns: "starter" }, "Status")}
      >
        <TicketStatusBadge status={record.status} />
      </PropertyRow>

      <PropertyRow
        label={translate("tickets.fields.priority", { ns: "starter" }, "Priority")}
      >
        <Select
          value={record.priority}
          onValueChange={(value) => {
            const priority = value as TicketPriority;
            patch(
              buildTicketPriorityChange(
                priority,
                policyForPriority(policies.data, priority)
              )
            );
          }}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue>
              <PriorityBadge priority={record.priority} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TICKET_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {translateTicketPriority(translate, priority)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyRow>

      <PropertyRow
        label={translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")}
      >
        <Select
          value={record.assigneeId != null ? String(record.assigneeId) : ""}
          onValueChange={(value) =>
            patch({ assigneeId: value ? Number(value) : null })
          }
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder={unassigned}>
              {selectedAssignee
                ? agentDisplayName(selectedAssignee, unassigned)
                : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={String(agent.id)}>
                {agentDisplayName(agent, unassigned)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyRow>

      <PropertyRow
        label={translate("tickets.fields.queue", { ns: "starter" }, "Queue")}
      >
        <Select
          value={record.queue_id != null ? String(record.queue_id) : ""}
          onValueChange={(value) =>
            patch({ queue_id: value ? Number(value) : null })
          }
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue
              placeholder={translate(
                "tickets.fields.queueEmpty",
                { ns: "starter" },
                "No queue"
              )}
            >
              {record.queue?.name ??
                queues.data.find((queue) => queue.id === record.queue_id)?.name ??
                null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {queues.data.map((queue) => (
              <SelectItem key={queue.id} value={String(queue.id)}>
                {queue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyRow>

      <PropertyRow
        label={translate("tickets.fields.type", { ns: "starter" }, "Ticket type")}
      >
        <Select
          value={record.ticket_type_id != null ? String(record.ticket_type_id) : ""}
          onValueChange={(value) =>
            patch({ ticket_type_id: value ? Number(value) : null })
          }
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue
              placeholder={translate(
                "tickets.fields.typeEmpty",
                { ns: "starter" },
                "Unclassified"
              )}
            >
              {record.ticket_type?.name ??
                types.data.find((type) => type.id === record.ticket_type_id)
                  ?.name ??
                null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.data.map((type) => (
              <SelectItem key={type.id} value={String(type.id)}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PropertyRow>

      {record.sla_policy ? (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => openChild(`sla-policy/show/${record.sla_policy_id}`)}
        >
          {translate(
            "tickets.show.openPolicy",
            { ns: "starter" },
            "Open the SLA policy"
          )}
        </button>
      ) : null}
    </section>
  );
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/**
 * Requester context: who is asking, what else they have open, and how they
 * have rated the team before. Answering a ticket without this is answering it
 * blind — it is the panel Zendesk keeps pinned to the right of every ticket.
 */
export function RequesterPanel({
  record,
  onOpenTicket,
  openChild,
}: {
  record: TicketRecord;
  onOpenTicket: (id: number) => void;
  openChild: (to: string) => void;
}) {
  const translate = useTranslate();
  const locale = useGetLocale()();
  const requesterId = record.requester_id;

  const { result: history, query: historyQuery } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: requesterId
      ? [{ field: "requester_id", operator: "eq", value: requesterId }]
      : [{ field: "requester_email", operator: "eq", value: record.requester_email ?? "" }],
    sorters: [{ field: "createdAt", order: "desc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 10 },
    queryOptions: { retry: false, enabled: Boolean(requesterId || record.requester_email) },
  });
  const { result: csat } = useList<CsatRecord>({
    resource: "desk_csat",
    filters: requesterId
      ? [{ field: "ticket.requester_id", operator: "eq", value: requesterId }]
      : [],
    pagination: { mode: "server", currentPage: 1, pageSize: 20 },
    queryOptions: { retry: false, enabled: Boolean(requesterId) },
  });

  const others = history.data.filter((ticket) => ticket.id !== record.id);
  const openCount = others.filter(
    (ticket) => ticket.status === "open" || ticket.status === "in_progress"
  ).length;
  const averageCsat = csat.data.length
    ? csat.data.reduce((sum, item) => sum + Number(item.score), 0) /
      csat.data.length
    : null;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            {record.requester_id ? (
              <button
                type="button"
                className="hover:underline"
                onClick={() => openChild(`requester/show/${record.requester_id}`)}
              >
                {record.requester_name}
              </button>
            ) : (
              record.requester_name
            )}
          </h3>
          {record.requester?.company ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3.5" />
              {record.requester.company}
            </p>
          ) : null}
          {record.requester_email ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              <span className="truncate">{record.requester_email}</span>
            </p>
          ) : null}
        </div>
        {averageCsat !== null ? (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <Star className="size-3 fill-current" />
            {averageCsat.toFixed(1)}
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-muted/60 p-2">
          <p className="text-lg font-semibold tabular-nums">{others.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {translate(
              "tickets.requesterPanel.previous",
              { ns: "starter" },
              "Other tickets"
            )}
          </p>
        </div>
        <div className="rounded-lg bg-muted/60 p-2">
          <p className="text-lg font-semibold tabular-nums">{openCount}</p>
          <p className="text-[11px] text-muted-foreground">
            {translate(
              "tickets.requesterPanel.stillOpen",
              { ns: "starter" },
              "Still open"
            )}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <History className="size-3.5" />
          {translate(
            "tickets.requesterPanel.history",
            { ns: "starter" },
            "Ticket history"
          )}
        </p>
        {historyQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : others.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {translate(
              "tickets.requesterPanel.firstTicket",
              { ns: "starter" },
              "This is their first ticket."
            )}
          </p>
        ) : (
          <ul className="divide-y">
            {others.slice(0, 5).map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => onOpenTicket(ticket.id)}
                  className="w-full py-2 text-left hover:bg-accent/40"
                >
                  <p className="truncate text-xs font-medium">{ticket.subject}</p>
                  <p className="mt-1 flex items-center gap-1.5">
                    <TicketStatusBadge status={ticket.status} className="h-5" />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(ticket.createdAt, locale)}
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export type { SlaTarget };

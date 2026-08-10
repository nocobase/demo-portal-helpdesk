import {
  useGetLocale,
  useList,
  useNotification,
  useShow,
  useTranslate,
  useUpdate,
} from "@refinedev/core";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Link2,
  Pencil,
  PlayCircle,
  Printer,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { CategoryBadge, TicketStatusBadge } from "../badges";
import {
  agentDisplayName,
  formatDateTime,
  translateTicketSource,
  type AgentRef,
  type CsatRecord,
  type TicketMessageRecord,
  type TicketNoteRecord,
  type TicketRecord,
  type TicketStatus,
} from "../lib";
import {
  allowedTicketStatusTransitions,
  buildTicketStatusTransition,
} from "../ticket-mutations";
import { recordRecentTicket } from "../recent-tickets";
import {
  useContextualCloseTo,
  useOpenAbsolute,
  useOpenContextualChild,
} from "../route-surfaces";
import { TicketActivity } from "./ticket-activity";
import {
  TicketConversation,
  TicketCsat,
  TicketNotes,
} from "./ticket-conversation";
import { printTicket } from "./ticket-print";
import {
  RequesterPanel,
  SlaTimers,
  TicketProperties,
} from "./ticket-sidebar";

/**
 * The status machine. A ticket may only take the transitions listed for the
 * state it is in, which is why the drawer offers buttons instead of a status
 * dropdown — a closed ticket cannot jump straight back to "in progress"
 * without being reopened first.
 */
const TRANSITION_DETAILS: Partial<Record<
  `${TicketStatus}:${TicketStatus}`,
  {
    i18nKey: string;
    fallback: string;
    icon: typeof PlayCircle;
    variant?: "secondary" | "outline" | "default";
  }
>> = {
  "open:in_progress": {
    i18nKey: "tickets.actions.startProgress",
    fallback: "Start progress",
    icon: PlayCircle,
  },
  "in_progress:resolved": {
    i18nKey: "tickets.actions.resolve",
    fallback: "Resolve",
    icon: CheckCircle2,
  },
  "resolved:closed": {
    i18nKey: "tickets.actions.close",
    fallback: "Close",
    icon: XCircle,
  },
  "resolved:in_progress": {
    i18nKey: "tickets.actions.reopen",
    fallback: "Reopen",
    icon: RotateCcw,
    variant: "outline",
  },
  "closed:open": {
    i18nKey: "tickets.actions.reopen",
    fallback: "Reopen",
    icon: RotateCcw,
    variant: "outline",
  },
};

export function TicketShow() {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const openChild = useOpenContextualChild();
  const openAbsolute = useOpenAbsolute();
  const closeTo = useContextualCloseTo();
  const nested = useOutlet();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const { open: notify } = useNotification();
  const [tab, setTab] = useState("conversation");

  const { result: record, query } = useShow<TicketRecord>({
    resource: "desk_tickets",
    id,
    meta: {
      appends: [
        "assignee",
        "queue",
        "ticket_type",
        "requester",
        "sla_policy",
        "csat_responses",
      ],
    },
  });
  const update = useUpdate();

  // Feeds the ⌘K palette's "Recently viewed" list.
  useEffect(() => {
    if (record?.id) recordRecentTicket({ id: record.id, subject: record.subject });
  }, [record?.id, record?.subject]);

  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const { result: messagesResult } = useList<TicketMessageRecord>({
      resource: "desk_ticket_messages",
      filters: [{ field: "ticketId", operator: "eq", value: record?.id ?? 0 }],
      sorters: [{ field: "createdAt", order: "asc" }],
      pagination: { mode: "server", currentPage: 1, pageSize: 100 },
      meta: { appends: ["author"] },
      queryOptions: { retry: false, enabled: Boolean(record?.id) },
  });
  const { result: notesResult, query: notesQuery } = useList<TicketNoteRecord>({
    resource: "desk_ticket_notes",
    filters: [{ field: "ticketId", operator: "eq", value: record?.id ?? 0 }],
    sorters: [{ field: "createdAt", order: "asc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    meta: { appends: ["author"] },
    queryOptions: { retry: false, enabled: Boolean(record?.id) },
  });
  const { result: csatResult } = useList<CsatRecord>({
    resource: "desk_csat",
    filters: [{ field: "ticket_id", operator: "eq", value: record?.id ?? 0 }],
    pagination: { mode: "server", currentPage: 1, pageSize: 10 },
    queryOptions: { retry: false, enabled: Boolean(record?.id) },
  });

  const neighbours = useTicketNeighbours(record);

  const applyStatus = (to: TicketStatus) => {
    if (!record) return;
    let values: ReturnType<typeof buildTicketStatusTransition>;
    try {
      values = buildTicketStatusTransition(record, to);
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
    update.mutate(
      { resource: "desk_tickets", id: record.id, values },
      { onSuccess: () => query.refetch() }
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify?.({
        type: "success",
        message: translate(
          "tickets.actions.linkCopied",
          { ns: "starter" },
          "Ticket link copied"
        ),
      });
    } catch {
      notify?.({
        type: "error",
        message: translate(
          "tickets.actions.linkCopyFailed",
          { ns: "starter" },
          "Couldn't copy the link"
        ),
      });
    }
  };

  // Zendesk's J/K walk through tickets without leaving the drawer; E opens the
  // edit form. Typing in the reply box must never trigger them.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      if (event.key === "j" && neighbours.nextId) {
        openAbsolute(`/tickets/show/${neighbours.nextId}`);
      } else if (event.key === "k" && neighbours.previousId) {
        openAbsolute(`/tickets/show/${neighbours.previousId}`);
      } else if (event.key === "e" && record) {
        openChild("edit");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [neighbours.nextId, neighbours.previousId, openAbsolute, openChild, record]);

  return (
    <RouteDrawer
      className="lg:w-[62vw] lg:min-w-[56rem]"
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-56" />
        ) : (
          <span className="flex items-center gap-2">
            {record ? (
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                #{record.id}
              </span>
            ) : null}
            <span className="truncate">
              {record?.subject ??
                translate("tickets.resource.singular", { ns: "starter" }, "Ticket")}
            </span>
            {record ? <TicketStatusBadge status={record.status} /> : null}
          </span>
        )
      }
      description={
        record
          ? translate(
              "tickets.show.openedBy",
              {
                ns: "starter",
                requester: record.requester_name,
                source: translateTicketSource(translate, record.source),
                createdAt: formatDateTime(record.createdAt, locale),
              },
              "Opened by {{requester}} via {{source}} · {{createdAt}}"
            )
          : translate(
              "tickets.show.description",
              { ns: "starter" },
              "Review the issue, move it through the status flow, and keep notes on each step."
            )
      }
      closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
      closeTo={closeTo}
      nested={nested}
      actions={
        record ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!neighbours.previousId}
              aria-label={translate(
                "tickets.actions.previous",
                { ns: "starter" },
                "Previous ticket"
              )}
              title={translate(
                "tickets.actions.previous",
                { ns: "starter" },
                "Previous ticket"
              )}
              onClick={() =>
                neighbours.previousId &&
                openAbsolute(`/tickets/show/${neighbours.previousId}`)
              }
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!neighbours.nextId}
              aria-label={translate(
                "tickets.actions.next",
                { ns: "starter" },
                "Next ticket"
              )}
              title={translate(
                "tickets.actions.next",
                { ns: "starter" },
                "Next ticket"
              )}
              onClick={() =>
                neighbours.nextId &&
                openAbsolute(`/tickets/show/${neighbours.nextId}`)
              }
            >
              <ChevronRight />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                "tickets.actions.copyLink",
                { ns: "starter" },
                "Copy link"
              )}
              title={translate(
                "tickets.actions.copyLink",
                { ns: "starter" },
                "Copy link"
              )}
              onClick={() => void copyLink()}
            >
              <Link2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                "tickets.actions.print",
                { ns: "starter" },
                "Print ticket"
              )}
              title={translate(
                "tickets.actions.print",
                { ns: "starter" },
                "Print ticket"
              )}
              onClick={() =>
                printTicket({
                  ticket: record,
                  messages: messagesResult.data,
                  notes: notesResult.data,
                  csat: csatResult.data[0],
                  translate,
                  locale,
                })
              }
            >
              <Printer />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openChild("edit")}
            >
              <Pencil />
              {translate("buttons.edit", { ns: "starter" }, "Edit")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {query.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : query.isError || !record ? (
          <Alert variant="destructive">
            <AlertDescription>
              {translate(
                "tickets.show.loadError",
                { ns: "starter" },
                "The ticket may no longer exist, or you may not have permission to view it."
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0 space-y-5">
              <section className="flex flex-wrap items-center gap-2">
                {allowedTicketStatusTransitions(record.status).map((to) => {
                  const transition =
                    TRANSITION_DETAILS[`${record.status}:${to}`];
                  if (!transition) return null;
                  return (
                  <Button
                    key={`${to}-${transition.i18nKey}`}
                    type="button"
                    size="sm"
                    variant={transition.variant ?? "default"}
                    disabled={update.mutation.isPending}
                    onClick={() => applyStatus(to)}
                  >
                    <transition.icon />
                    {translate(
                      transition.i18nKey,
                      { ns: "starter" },
                      transition.fallback
                    )}
                  </Button>
                  );
                })}
                <CategoryBadge category={record.category} />
                {record.sla_breached ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-red-300/60 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                  >
                    <AlertTriangle className="size-3" />
                    {translate(
                      "tickets.show.slaBreached",
                      { ns: "starter" },
                      "SLA breached"
                    )}
                  </Badge>
                ) : null}
              </section>

              <Separator />

              <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
                <TabsList>
                  <TabsTrigger value="conversation">
                    {translate(
                      "tickets.tabs.conversation",
                      { ns: "starter", count: messagesResult.data.length },
                      "Conversation ({{count}})"
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    {translate(
                      "tickets.tabs.notes",
                      { ns: "starter", count: notesResult.data.length },
                      "Internal notes ({{count}})"
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="activity">
                    {translate("tickets.tabs.activity", { ns: "starter" }, "Activity")}
                  </TabsTrigger>
                  <TabsTrigger value="details">
                    {translate("tickets.tabs.details", { ns: "starter" }, "Details")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="conversation" className="pt-4">
                  <TicketConversation
                    record={record}
                    messages={messagesResult.data}
                  />
                </TabsContent>

                <TabsContent value="notes" className="pt-4">
                  <TicketNotes
                    ticketId={record.id}
                    notes={notesResult.data}
                    onRefetch={() => void notesQuery.refetch()}
                  />
                </TabsContent>

                <TabsContent value="activity" className="pt-4">
                  <TicketActivity
                    ticket={record}
                    messages={messagesResult.data}
                    notes={notesResult.data}
                    csat={csatResult.data}
                  />
                </TabsContent>

                <TabsContent value="details" className="space-y-5 pt-4">
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">
                      {translate(
                        "tickets.fields.description",
                        { ns: "starter" },
                        "Description"
                      )}
                    </h3>
                    <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
                      {record.description}
                    </p>
                  </section>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium">
                      {translate(
                        "tickets.show.timeline",
                        { ns: "starter" },
                        "Timeline"
                      )}
                    </h3>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <TimelineItem
                        label={translate(
                          "tickets.fields.created",
                          { ns: "starter" },
                          "Created"
                        )}
                        value={formatDateTime(record.createdAt, locale)}
                      />
                      <TimelineItem
                        label={translate(
                          "tickets.fields.responseDue",
                          { ns: "starter" },
                          "Response due"
                        )}
                        value={formatDateTime(record.response_due_at, locale)}
                      />
                      <TimelineItem
                        label={translate(
                          "tickets.fields.firstResponded",
                          { ns: "starter" },
                          "First responded"
                        )}
                        value={formatDateTime(record.first_responded_at, locale)}
                      />
                      <TimelineItem
                        label={translate(
                          "tickets.fields.resolutionDue",
                          { ns: "starter" },
                          "Resolution due"
                        )}
                        value={formatDateTime(record.resolution_due_at, locale)}
                      />
                      <TimelineItem
                        label={translate(
                          "tickets.fields.resolved",
                          { ns: "starter" },
                          "Resolved"
                        )}
                        value={
                          record.resolved_at
                            ? formatDateTime(record.resolved_at, locale)
                            : translate(
                                "tickets.show.pending",
                                { ns: "starter" },
                                "pending"
                              )
                        }
                      />
                      <TimelineItem
                        label={translate(
                          "performance.fields.avgResolution",
                          { ns: "starter" },
                          "Handling time"
                        )}
                        value={
                          record.resolution_mins != null
                            ? translate(
                                "performance.minutes",
                                { ns: "starter", count: record.resolution_mins },
                                "{{count}} min"
                              )
                            : "-"
                        }
                      />
                    </dl>
                  </section>
                  <Separator />
                  <TicketCsat
                    record={record}
                    responses={csatResult.data}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <aside className="space-y-4">
              <SlaTimers record={record} />
              <TicketProperties
                record={record}
                agents={agentsResult.data}
                onUpdated={() => void query.refetch()}
                openChild={openChild}
              />
              <RequesterPanel
                record={record}
                openChild={openChild}
                onOpenTicket={(ticketId) =>
                  openAbsolute(`/tickets/show/${ticketId}`)
                }
              />
              {record.assignee ? (
                <p className="px-1 text-xs text-muted-foreground">
                  {translate(
                    "tickets.show.assignedTo",
                    {
                      ns: "starter",
                      agent: agentDisplayName(record.assignee),
                    },
                    "Assigned to {{agent}}"
                  )}
                </p>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </RouteDrawer>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * Previous / next walk the desk in the same recency order the ticket list
 * defaults to, so an agent can work a queue without bouncing back to the table
 * between every ticket.
 */
function useTicketNeighbours(record?: TicketRecord) {
  const updatedAt = record?.updatedAt;
  const { result: newer } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [{ field: "updatedAt", operator: "gt", value: updatedAt ?? "" }],
    sorters: [{ field: "updatedAt", order: "asc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 1 },
    meta: { fields: ["id", "updatedAt"] },
    queryOptions: { retry: false, enabled: Boolean(updatedAt) },
  });
  const { result: older } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [{ field: "updatedAt", operator: "lt", value: updatedAt ?? "" }],
    sorters: [{ field: "updatedAt", order: "desc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 1 },
    meta: { fields: ["id", "updatedAt"] },
    queryOptions: { retry: false, enabled: Boolean(updatedAt) },
  });

  return {
    previousId: newer.data[0]?.id,
    nextId: older.data[0]?.id,
  };
}

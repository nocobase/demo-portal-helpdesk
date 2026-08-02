import {
  useCreate,
  useGetIdentity,
  useGetLocale,
  useList,
  useTranslate,
  useUpdate,
  type HttpError,
} from "@refinedev/core";
import { useShow } from "@refinedev/core";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Pencil,
  PlayCircle,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RouteDrawer } from "@/extensions/nocobase-route-surfaces";
import { AIEmployeeShortcut, useAIPageElementHandle, type AIEmployeeTask } from "@/extensions/nocobase-ai";
import { PriorityBadge, SlaBadge, TicketStatusBadge } from "../badges";
import {
  agentDisplayName,
  formatDateTime,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  SLA_HOURS,
  type AgentRef,
  type HelpArticleRecord,
  type MacroRecord,
  type CsatRecord,
  type TicketMessageRecord,
  type TicketNoteRecord,
  type TicketRecord,
  type TicketStatus,
  minutesBetween,
  translateTicketCategory,
  translateTicketSource,
} from "../lib";
import { AgentAvatar } from "./ticket-list";
import {
  useContextualCloseTo,
  useOpenContextualChild,
} from "../route-surfaces";

const TRANSITIONS: Record<
  TicketStatus,
  Array<{ i18nKey: string; fallback: string; to: TicketStatus; icon: typeof PlayCircle; variant?: "secondary" | "outline" | "default" }>
> = {
  open: [{ i18nKey: "tickets.actions.startProgress", fallback: "Start progress", to: "in_progress", icon: PlayCircle }],
  in_progress: [{ i18nKey: "tickets.actions.resolve", fallback: "Resolve", to: "resolved", icon: CheckCircle2 }],
  resolved: [
    { i18nKey: "tickets.actions.close", fallback: "Close", to: "closed", icon: XCircle },
    { i18nKey: "tickets.actions.reopen", fallback: "Reopen", to: "in_progress", icon: RotateCcw, variant: "outline" },
  ],
  closed: [
    { i18nKey: "tickets.actions.reopen", fallback: "Reopen", to: "open", icon: RotateCcw, variant: "outline" },
  ],
};

export function TicketShow() {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const openChild = useOpenContextualChild();
  const closeTo = useContextualCloseTo();
  const nested = useOutlet();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const {
    result: record,
    query,
  } = useShow<TicketRecord>({
    resource: "desk_tickets",
    id,
    meta: { appends: ["assignee", "queue", "ticket_type", "requester", "sla_policy", "csat_responses"] },
  });
  const update = useUpdate();

  const applyStatus = (to: TicketStatus) => {
    if (!record) return;
    const values: Record<string, unknown> = { status: to };
    if (to === "resolved") {
      const resolvedAt = new Date().toISOString();
      const resolutionBreached = Boolean(record.resolution_due_at && new Date(resolvedAt) > new Date(record.resolution_due_at));
      values.resolved_at = resolvedAt;
      values.resolution_mins = minutesBetween(record.createdAt, resolvedAt);
      values.resolution_breached = resolutionBreached;
      values.sla_breached = Boolean(record.response_breached || resolutionBreached);
    }
    if ((to === "in_progress" || to === "open") && record.resolved_at) {
      values.resolved_at = null;
    }
    update.mutate(
      { resource: "desk_tickets", id: record.id, values },
      { onSuccess: () => query.refetch() }
    );
  };

  return (
    <RouteDrawer
      title={
        query.isLoading && !record ? (
          <Skeleton className="h-6 w-56" />
        ) : (
          <span className="flex items-center gap-2">
            <span className="truncate">{record?.subject ?? translate("tickets.resource.singular", { ns: "starter" }, "Ticket")}</span>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openChild("edit")}
          >
            <Pencil />
            {translate("buttons.edit", { ns: "starter" }, "Edit")}
          </Button>
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
          <div className="space-y-5">
            <section className="flex flex-wrap items-center gap-2">
              {TRANSITIONS[record.status].map((transition) => (
                <Button
                  key={transition.to}
                  type="button"
                  size="sm"
                  variant={transition.variant ?? "default"}
                  disabled={update.mutation.isPending}
                  onClick={() => applyStatus(transition.to)}
                >
                  <transition.icon />
                  {translate(
                    transition.i18nKey,
                    { ns: "starter" },
                    transition.fallback
                  )}
                </Button>
              ))}
            </section>

            <Separator />

            <TicketShowBody record={record} locale={locale} onUpdated={() => query.refetch()} />

            <Separator />

            <TicketConversation record={record} />

            <Separator />

            <TicketCsat record={record} />

            <Separator />

            <TicketNotes ticketId={record.id} />
          </div>
        )}
      </div>
    </RouteDrawer>
  );
}

function TicketShowBody({
  record,
  locale,
  onUpdated,
}: {
  record: TicketRecord;
  locale?: string;
  onUpdated: () => void;
}) {
  const translate = useTranslate();
  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const update = useUpdate();
  const due = getTicketDueAt(record);
  const slaState = getSlaState(record);
  const selectedAssignee =
    agentsResult.data.find((agent) => agent.id === record.assigneeId) ??
    record.assignee;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">{translate("tickets.show.details", { ns: "starter" }, "Details")}</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.priority", { ns: "starter" }, "Priority")}</dt>
            <dd>
              <PriorityBadge priority={record.priority} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.category", { ns: "starter" }, "Category")}</dt>
            <dd className="text-sm font-medium">
              {record.category ? translateTicketCategory(translate, record.category) : "-"}
            </dd>
          </div>
          <div className="space-y-1"><dt className="text-xs text-muted-foreground">{translate("tickets.fields.queue", { ns: "starter" }, "Queue")}</dt><dd className="text-sm font-medium">{record.queue?.name ?? "-"}</dd></div>
          <div className="space-y-1"><dt className="text-xs text-muted-foreground">{translate("tickets.fields.type", { ns: "starter" }, "Ticket type")}</dt><dd className="text-sm font-medium">{record.ticket_type?.name ?? "-"}</dd></div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")}</dt>
            <dd>
              <Select
                value={
                  record.assigneeId != null ? String(record.assigneeId) : ""
                }
                onValueChange={(value) =>
                  update.mutate(
                    {
                      resource: "desk_tickets",
                      id: record.id,
                      values: {
                        assigneeId: value ? Number(value) : null,
                      },
                    },
                    { onSuccess: onUpdated }
                  )
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={translate("tickets.assignee.unassigned", { ns: "starter" }, "Unassigned")}>
                    {selectedAssignee
                      ? agentDisplayName(selectedAssignee, translate("tickets.assignee.unassigned", { ns: "starter" }, "Unassigned"))
                      : record.assigneeId != null
                        ? translate("tickets.assignee.loading", { ns: "starter" }, "Loading assignee...")
                        : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agentsResult.data.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agentDisplayName(agent, translate("tickets.assignee.unassigned", { ns: "starter" }, "Unassigned"))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.sla", { ns: "starter" }, "SLA")}</dt>
            <dd className="flex items-center gap-2">
              <SlaBadge
                state={slaState}
                detail={
                  due && slaState !== "on_track"
                    ? formatRelativeDeadline(due, translate)
                    : undefined
                }
              />
              {due ? (
                <span className="text-xs text-muted-foreground">
                  {translate(
                    "tickets.show.deadlineAt",
                    { ns: "starter", deadline: formatDateTime(record.resolution_due_at, locale) },
                    "due {{deadline}}"
                  )}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {translate(
            "tickets.show.deadlinePolicy",
            {
              ns: "starter",
              urgent: SLA_HOURS.urgent,
              high: SLA_HOURS.high,
              medium: SLA_HOURS.medium,
              low: SLA_HOURS.low,
            },
            "Deadlines by priority: urgent {{urgent}}h · high {{high}}h · medium {{medium}}h · low {{low}}h, measured from when the ticket is logged."
          )}
        </p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-medium">{translate("tickets.show.requester", { ns: "starter" }, "Requester")}</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.show.name", { ns: "starter" }, "Name")}</dt>
            <dd className="text-sm font-medium">{record.requester_name}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.show.email", { ns: "starter" }, "Email")}</dt>
            <dd className="flex items-center gap-1.5 text-sm font-medium">
              {record.requester_email ? (
                <>
                  <Mail className="size-3.5 text-muted-foreground" />
                  {record.requester_email}
                </>
              ) : (
                "-"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{translate("tickets.fields.description", { ns: "starter" }, "Description")}</h3>
        <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
          {record.description}
        </p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-medium">{translate("tickets.show.timeline", { ns: "starter" }, "Timeline")}</h3>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.created", { ns: "starter" }, "Created")}</dt>
            <dd className="text-sm font-medium">
              {formatDateTime(record.createdAt, locale)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.resolutionDue", { ns: "starter" }, "Resolution due")}</dt>
            <dd className="text-sm font-medium">
              {formatDateTime(record.resolution_due_at, locale)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">{translate("tickets.fields.resolved", { ns: "starter" }, "Resolved")}</dt>
            <dd className="text-sm font-medium">
              {record.resolved_at ? (
                formatDateTime(record.resolved_at, locale)
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  {translate("tickets.show.pending", { ns: "starter" }, "pending")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function TicketConversation({ record }: { record: TicketRecord }) {
  const translate = useTranslate();
  const [reply, setReply] = useState("");
  const [macroId, setMacroId] = useState("");
  const { data: identity } = useGetIdentity<AgentRef & { id: number }>();
  const { result: messagesResult, query: messagesQuery } = useList<TicketMessageRecord>({
    resource: "desk_ticket_messages",
    filters: [{ field: "ticketId", operator: "eq", value: record.id }],
    sorters: [{ field: "createdAt", order: "asc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    meta: { appends: ["author"] },
    queryOptions: { retry: false },
  });
  const { result: articlesResult } = useList<HelpArticleRecord>({
    resource: "desk_help_articles",
    filters: [{ field: "published", operator: "eq", value: true }],
    pagination: { mode: "server", currentPage: 1, pageSize: 20 },
    queryOptions: { retry: false },
  });
  const createMessage = useCreate<TicketMessageRecord, HttpError>({
    successNotification: () => ({
      message: translate(
        "tickets.conversation.replySent",
        { ns: "starter" },
        "Reply sent"
      ),
      type: "success",
    }),
    errorNotification: () => ({
      message: translate(
        "tickets.conversation.replyError",
        { ns: "starter" },
        "Couldn't send the reply"
      ),
      type: "error",
    }),
  });
  const updateTicket = useUpdate();
  const { result: macrosResult } = useList<MacroRecord>({ resource: "desk_macros", pagination: { mode: "server", currentPage: 1, pageSize: 100 }, sorters: [{ field: "title", order: "asc" }] });
  const matchingArticles = articlesResult.data.filter(
    (article) => !record.category || article.category === record.category
  );
  const conversationContext = useAIPageElementHandle({
    id: `ticket-${record.id}-conversation`,
    title: translate(
      "tickets.conversation.aiContextTitle",
      { ns: "starter", id: record.id, subject: record.subject },
      "Ticket #{{id}}: {{subject}}"
    ),
    kind: "record",
    getContext: () => ({
      ticket: {
        subject: record.subject,
        description: record.description,
        requester: record.requester_name,
        priority: record.priority,
        category: record.category,
        status: record.status,
      },
      conversation: messagesResult.data.map((message) => ({
        direction: message.direction,
        author: message.direction === "inbound"
          ? record.requester_name
          : agentDisplayName(
              message.author,
              translate(
                "tickets.assignee.unknown",
                { ns: "starter" },
                "Unknown agent"
              )
            ),
        content: message.content,
        sentAt: message.createdAt,
      })),
      matchingHelpArticles: matchingArticles.map((article) => ({
        title: article.title,
        summary: article.summary,
        body: article.body,
      })),
    }),
  });
  const aiTasks = useMemo<AIEmployeeTask[]>(() => [
    {
      title: translate(
        "tickets.conversation.aiTaskTitle",
        { ns: "starter" },
        "Draft a reply"
      ),
      autoSend: true,
      message: {
        system: translate(
          "tickets.conversation.aiSystemPrompt",
          { ns: "starter" },
          "You are a warm, concise customer support teammate. Use only the supplied ticket conversation and matching help articles. Never expose internal notes or invent commitments. Draft a customer-ready reply with a clear next step."
        ),
        user: translate(
          "tickets.conversation.aiUserPrompt",
          { ns: "starter" },
          "Draft the best next customer reply for this ticket. Keep it friendly, specific, and ready to review before sending."
        ),
        workContext: [conversationContext.context],
      },
    },
  ], [conversationContext.context, translate]);
  const submitReply = () => {
    const content = reply.trim();
    if (!content || createMessage.mutation.isPending) return;
    createMessage.mutate({
      resource: "desk_ticket_messages",
      values: { content, direction: "outbound", ticket: record.id, author: identity?.id ?? null },
    }, {
      onSuccess: () => {
        setReply("");
        void messagesQuery.refetch();
        if (!record.first_responded_at) {
          const respondedAt = new Date().toISOString();
          const breached = Boolean(record.response_due_at && new Date(respondedAt) > new Date(record.response_due_at));
          updateTicket.mutate({ resource: "desk_tickets", id: record.id, values: { first_responded_at: respondedAt, response_breached: breached, sla_breached: Boolean(record.resolution_breached || breached) } });
        }
      },
    });
  };

  return (
    <section ref={conversationContext.ref} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{translate("tickets.conversation.title", { ns: "starter" }, "Customer conversation")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{translate("tickets.conversation.description", { ns: "starter" }, "Visible customer messages and team replies, in order.")}</p>
        </div>
        <AIEmployeeShortcut aiEmployee="ellis" tasks={aiTasks} label={translate("tickets.conversation.aiAction", { ns: "starter" }, "Draft with AI")} size={30} className="border-primary/20 bg-primary/5" />
      </div>
      <ol className="space-y-3">
        <li className="flex gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{record.requester_name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">{record.requester_name}</span><span className="text-xs text-muted-foreground">{translate("tickets.conversation.opened", { ns: "starter" }, "Opened ticket")}</span></div>
            <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{record.description}</p>
          </div>
        </li>
        {messagesResult.data.map((message) => (
          <li key={message.id} className="flex gap-3">
            {message.direction === "outbound" ? <AgentAvatar agent={message.author} className="size-7 shrink-0" /> : <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{record.requester_name.slice(0, 1).toUpperCase()}</div>}
            <div className={message.direction === "outbound" ? "min-w-0 flex-1 rounded-xl border bg-card px-3 py-2.5" : "min-w-0 flex-1 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5"}>
              <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">{message.direction === "outbound" ? agentDisplayName(message.author, translate("tickets.assignee.unknown", { ns: "starter" }, "Unknown agent")) : record.requester_name}</span><NoteRelativeTime value={message.createdAt} /></div>
              <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
            </div>
          </li>
        ))}
      </ol>
      {matchingArticles.length ? <div className="rounded-xl border border-dashed bg-muted/35 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Sparkles className="size-3.5 text-primary" /> {translate("tickets.conversation.aiGrounding", { ns: "starter", count: matchingArticles.length }, `AI will use ${matchingArticles.length} matching help ${matchingArticles.length === 1 ? "article" : "articles"} for a grounded draft.`)}</p></div> : null}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={macroId} onValueChange={(value) => setMacroId(value ?? "")}><SelectTrigger className="flex-1"><SelectValue placeholder={translate("tickets.macros.placeholder", { ns: "starter" }, "Choose a reply macro")}>{macrosResult.data.find((macro) => String(macro.id) === macroId)?.title ?? null}</SelectValue></SelectTrigger><SelectContent>{macrosResult.data.map((macro) => <SelectItem key={macro.id} value={String(macro.id)}>{macro.title}</SelectItem>)}</SelectContent></Select>
          <Button type="button" variant="outline" disabled={!macroId} onClick={() => { const macro = macrosResult.data.find((item) => String(item.id) === macroId); if (macro) setReply((current) => current ? `${current}\n\n${macro.body}` : macro.body); }}>{translate("tickets.macros.insert", { ns: "starter" }, "Insert macro")}</Button>
        </div>
        <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={translate("tickets.conversation.replyPlaceholder", { ns: "starter" }, "Write a customer reply...")} className="min-h-28" />
        <div className="flex justify-end"><Button type="button" size="sm" disabled={!reply.trim() || createMessage.mutation.isPending} onClick={submitReply}><Send /> {translate("tickets.conversation.sendReply", { ns: "starter" }, "Send reply")}</Button></div>
      </div>
    </section>
  );
}

function TicketCsat({ record }: { record: TicketRecord }) {
  const translate = useTranslate();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const { result, query } = useList<CsatRecord>({ resource: "desk_csat", filters: [{ field: "ticket_id", operator: "eq", value: record.id }], pagination: { mode: "server", currentPage: 1, pageSize: 10 } });
  const create = useCreate<CsatRecord, HttpError>({ successNotification: () => ({ message: translate("tickets.csat.saved", { ns: "starter" }, "Customer satisfaction recorded"), type: "success" }) });
  if (record.status !== "resolved" && record.status !== "closed") return <section className="rounded-xl border border-dashed bg-muted/20 p-4"><h3 className="text-sm font-medium">{translate("tickets.csat.title", { ns: "starter" }, "Customer satisfaction")}</h3><p className="mt-1 text-xs text-muted-foreground">{translate("tickets.csat.pending", { ns: "starter" }, "The survey becomes available after the ticket is resolved.")}</p></section>;
  if (result.data[0]) return <section className="rounded-xl border bg-emerald-50/40 p-4 dark:bg-emerald-500/5"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">{translate("tickets.csat.title", { ns: "starter" }, "Customer satisfaction")}</h3><span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">{result.data[0].score}<Star className="size-4 fill-current" /></span></div><p className="mt-2 text-sm text-muted-foreground">{result.data[0].comment || translate("csat.noComment", { ns: "starter" }, "No comment provided.")}</p></section>;
  return <section className="space-y-3 rounded-xl border bg-muted/20 p-4"><div><h3 className="text-sm font-medium">{translate("tickets.csat.collectTitle", { ns: "starter" }, "Record post-resolution CSAT")}</h3><p className="mt-1 text-xs text-muted-foreground">{translate("tickets.csat.collectDescription", { ns: "starter" }, "Capture the requester’s 1–5 rating and optional comment.")}</p></div><div className="flex gap-1">{[1, 2, 3, 4, 5].map((value) => <Button key={value} type="button" variant="ghost" size="icon-sm" aria-label={translate("tickets.csat.scoreLabel", { ns: "starter", score: value }, "Score {{score}}") } onClick={() => setScore(value)}><Star className={value <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} /></Button>)}</div><Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={translate("tickets.csat.commentPlaceholder", { ns: "starter" }, "Optional customer comment")} /><div className="flex justify-end"><Button type="button" size="sm" disabled={create.mutation.isPending || query.isLoading} onClick={() => create.mutate({ resource: "desk_csat", values: { ticket_id: record.id, score, comment: comment.trim() || null } }, { onSuccess: () => query.refetch() })}>{translate("tickets.csat.save", { ns: "starter" }, "Save CSAT")}</Button></div></section>;
}

function TicketNotes({ ticketId }: { ticketId: number }) {
  const translate = useTranslate();
  const [content, setContent] = useState("");
  const { data: identity } = useGetIdentity<AgentRef & { id: number }>();
  const { result: notesResult, query: notesQuery } = useList<TicketNoteRecord>({
    resource: "desk_ticket_notes",
    filters: [{ field: "ticketId", operator: "eq", value: ticketId }],
    sorters: [{ field: "createdAt", order: "asc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    meta: { appends: ["author"] },
    queryOptions: { retry: false },
  });
  const createNote = useCreate<TicketNoteRecord, HttpError>({
    successNotification: () => ({
      message: translate(
        "tickets.notes.saved",
        { ns: "starter" },
        "Internal note added"
      ),
      type: "success",
    }),
    errorNotification: () => ({
      message: translate(
        "tickets.notes.saveError",
        { ns: "starter" },
        "Couldn't add the internal note"
      ),
      type: "error",
    }),
  });
  const notes = notesResult.data;

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || createNote.mutation.isPending) return;
    createNote.mutate(
      {
        resource: "desk_ticket_notes",
        values: {
          content: trimmed,
          ticket: ticketId,
          author: identity?.id ?? null,
        },
      },
      {
        onSuccess: () => {
          setContent("");
          void notesQuery.refetch();
        },
      }
    );
  };

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">
        {translate("tickets.notes.title", { ns: "starter", count: notes.length }, "Internal notes ({{count}})")}
      </h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            "tickets.notes.empty",
            { ns: "starter" },
            "No notes yet. Keep the private hand-off trail here: what you tried, what the customer said, and why the status moved."
          )}
        </p>
      ) : (
        <ol className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3">
              <AgentAvatar agent={note.author} className="size-7 shrink-0" />
              <div className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium">
                    {agentDisplayName(
                      note.author,
                      translate(
                        "tickets.assignee.unknown",
                        { ns: "starter" },
                        "Unknown agent"
                      )
                    )}
                  </span>
                  <NoteRelativeTime value={note.createdAt} />
                </div>
                <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={translate("tickets.notes.placeholder", { ns: "starter" }, "Add a private internal note...")}
          className="min-h-24"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!content.trim() || createNote.mutation.isPending}
            onClick={submit}
          >
            <Send />
            {translate("tickets.notes.add", { ns: "starter" }, "Add note")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function NoteRelativeTime({ value }: { value: string }) {
  const translate = useTranslate();
  const locale = useGetLocale()();
  const diff = Date.now() - new Date(value).getTime();
  const text =
    diff < 60 * 60 * 1000
      ? translate(
          "tickets.time.minutesAgo",
          { ns: "starter", count: Math.max(1, Math.floor(diff / 60000)) },
          "{{count}}m ago"
        )
      : new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value));
  return (
    <span
      className="shrink-0 text-xs text-muted-foreground"
      title={formatDateTime(value, locale)}
    >
      {text}
    </span>
  );
}

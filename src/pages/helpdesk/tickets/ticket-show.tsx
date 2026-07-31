import {
  useCreate,
  useGetIdentity,
  useGetLocale,
  useList,
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
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useOutlet, useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { CategoryBadge, PriorityBadge, SlaBadge, TicketStatusBadge } from "../badges";
import {
  agentDisplayName,
  CATEGORY_LABELS,
  formatDateTime,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  SLA_HOURS,
  SOURCE_LABELS,
  type AgentRef,
  type HelpArticleRecord,
  type TicketMessageRecord,
  type TicketNoteRecord,
  type TicketRecord,
  type TicketStatus,
} from "../lib";
import { AgentAvatar, ticketPaths } from "./ticket-list";

const TRANSITIONS: Record<
  TicketStatus,
  Array<{ label: string; to: TicketStatus; icon: typeof PlayCircle; variant?: "secondary" | "outline" | "default" }>
> = {
  open: [{ label: "Start progress", to: "in_progress", icon: PlayCircle }],
  in_progress: [{ label: "Resolve", to: "resolved", icon: CheckCircle2 }],
  resolved: [
    { label: "Close", to: "closed", icon: XCircle },
    { label: "Reopen", to: "in_progress", icon: RotateCcw, variant: "outline" },
  ],
  closed: [
    { label: "Reopen", to: "open", icon: RotateCcw, variant: "outline" },
  ],
};

export function TicketShow({ closeTo = ticketPaths.list }: { closeTo?: string }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const nested = useOutlet();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const {
    result: record,
    query,
  } = useShow<TicketRecord>({
    resource: "desk_tickets",
    id,
    meta: { appends: ["assignee"] },
  });
  const update = useUpdate();

  const applyStatus = (to: TicketStatus) => {
    if (!record) return;
    const values: Record<string, unknown> = { status: to };
    if (to === "resolved") values.resolved_at = new Date().toISOString();
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
            <span className="truncate">{record?.subject ?? "Ticket"}</span>
            {record ? <TicketStatusBadge status={record.status} /> : null}
          </span>
        )
      }
      description={
        record
          ? `Opened by ${record.requester_name} via ${SOURCE_LABELS[record.source] ?? record.source} · ${formatDateTime(record.createdAt, locale)}`
          : "Review the issue, move it through the status flow, and keep notes on each step."
      }
      closeLabel="Close"
      closeTo={closeTo}
      nested={nested}
      actions={
        record ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(ticketPaths.edit(record.id))}
          >
            <Pencil />
            Edit
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
              The ticket may no longer exist, or you may not have permission to
              view it.
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
                  {transition.label}
                </Button>
              ))}
            </section>

            <Separator />

            <TicketShowBody record={record} locale={locale} onUpdated={() => query.refetch()} />

            <Separator />

            <TicketConversation record={record} />

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
  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const update = useUpdate();
  const due = getTicketDueAt(record);
  const slaState = getSlaState(record);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Details</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Priority</dt>
            <dd>
              <PriorityBadge priority={record.priority} />
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Category</dt>
            <dd className="text-sm font-medium">
              {record.category ? CATEGORY_LABELS[record.category] : "-"}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Assignee</dt>
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
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {agentsResult.data.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agentDisplayName(agent)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">SLA</dt>
            <dd className="flex items-center gap-2">
              <SlaBadge
                state={slaState}
                detail={
                  due && slaState !== "on_track"
                    ? formatRelativeDeadline(due)
                    : undefined
                }
              />
              {due ? (
                <span className="text-xs text-muted-foreground">
                  due {formatDateTime(record.resolution_due_at, locale)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Deadlines by priority: urgent {SLA_HOURS.urgent}h · high{" "}
          {SLA_HOURS.high}h · medium {SLA_HOURS.medium}h · low {SLA_HOURS.low}h,
          measured from when the ticket is logged.
        </p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Requester</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="text-sm font-medium">{record.requester_name}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Email</dt>
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
        <h3 className="text-sm font-medium">Description</h3>
        <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
          {record.description}
        </p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Timeline</h3>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd className="text-sm font-medium">
              {formatDateTime(record.createdAt, locale)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Resolution due</dt>
            <dd className="text-sm font-medium">
              {formatDateTime(record.resolution_due_at, locale)}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Resolved</dt>
            <dd className="text-sm font-medium">
              {record.resolved_at ? (
                formatDateTime(record.resolved_at, locale)
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  pending
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
  const [reply, setReply] = useState("");
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
  const createMessage = useCreate<TicketMessageRecord, HttpError>();
  const matchingArticles = articlesResult.data.filter(
    (article) => !record.category || article.category === record.category
  );
  const conversationContext = useAIPageElementHandle({
    id: `ticket-${record.id}-conversation`,
    title: `Ticket #${record.id}: ${record.subject}`,
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
        author: message.direction === "inbound" ? record.requester_name : agentDisplayName(message.author),
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
      title: "Draft a reply",
      autoSend: true,
      message: {
        system: "You are a warm, concise customer support teammate. Use only the supplied ticket conversation and matching help articles. Never expose internal notes or invent commitments. Draft a customer-ready reply with a clear next step.",
        user: "Draft the best next customer reply for this ticket. Keep it friendly, specific, and ready to review before sending.",
        workContext: [conversationContext.context],
      },
    },
  ], [conversationContext.context]);
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
      },
    });
  };

  return (
    <section ref={conversationContext.ref} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Customer conversation</h3>
          <p className="mt-1 text-xs text-muted-foreground">Visible customer messages and team replies, in order.</p>
        </div>
        <AIEmployeeShortcut aiEmployee="ellis" tasks={aiTasks} label="Draft with AI" size={30} className="border-primary/20 bg-primary/5" />
      </div>
      <ol className="space-y-3">
        <li className="flex gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{record.requester_name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">{record.requester_name}</span><span className="text-xs text-muted-foreground">Opened ticket</span></div>
            <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{record.description}</p>
          </div>
        </li>
        {messagesResult.data.map((message) => (
          <li key={message.id} className="flex gap-3">
            {message.direction === "outbound" ? <AgentAvatar agent={message.author} className="size-7 shrink-0" /> : <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{record.requester_name.slice(0, 1).toUpperCase()}</div>}
            <div className={message.direction === "outbound" ? "min-w-0 flex-1 rounded-xl border bg-card px-3 py-2.5" : "min-w-0 flex-1 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5"}>
              <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">{message.direction === "outbound" ? agentDisplayName(message.author) : record.requester_name}</span><NoteRelativeTime value={message.createdAt} /></div>
              <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
            </div>
          </li>
        ))}
      </ol>
      {matchingArticles.length ? <div className="rounded-xl border border-dashed bg-muted/35 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Sparkles className="size-3.5 text-primary" /> AI will use {matchingArticles.length} matching help {matchingArticles.length === 1 ? "article" : "articles"} for a grounded draft.</p></div> : null}
      <div className="space-y-2">
        <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a customer reply..." className="min-h-28" />
        <div className="flex justify-end"><Button type="button" size="sm" disabled={!reply.trim() || createMessage.mutation.isPending} onClick={submitReply}><Send /> Send reply</Button></div>
      </div>
    </section>
  );
}

function TicketNotes({ ticketId }: { ticketId: number }) {
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
  const createNote = useCreate<TicketNoteRecord, HttpError>();
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
        Internal notes ({notes.length})
      </h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No notes yet. Keep the private hand-off trail here: what you tried,
          what the customer said, and why the status moved.
        </p>
      ) : (
        <ol className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3">
              <AgentAvatar agent={note.author} className="size-7 shrink-0" />
              <div className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium">
                    {agentDisplayName(note.author)}
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
          placeholder="Add a private internal note..."
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
            Add note
          </Button>
        </div>
      </div>
    </section>
  );
}

function NoteRelativeTime({ value }: { value: string }) {
  const locale = useGetLocale()();
  const diff = Date.now() - new Date(value).getTime();
  const text =
    diff < 60 * 60 * 1000
      ? `${Math.max(1, Math.floor(diff / 60000))}m ago`
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

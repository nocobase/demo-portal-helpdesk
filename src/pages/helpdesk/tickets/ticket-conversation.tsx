import {
  useCreate,
  useGetIdentity,
  useGetLocale,
  useList,
  useNotification,
  useTranslate,
  type HttpError,
} from "@refinedev/core";
import {
  Copy,
  Search,
  Send,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AIEmployeeShortcut,
  useAIPageElementHandle,
  type AIEmployeeTask,
} from "@/extensions/nocobase-ai";
import {
  agentDisplayName,
  formatDateTime,
  type AgentRef,
  type CsatRecord,
  type HelpArticleRecord,
  type MacroRecord,
  type TicketMessageRecord,
  type TicketNoteRecord,
  type TicketRecord,
} from "../lib";
import { AgentAvatar } from "./ticket-list";

export function TicketConversation({
  record,
  messages,
}: {
  record: TicketRecord;
  messages: TicketMessageRecord[];
}) {
  const translate = useTranslate();
  const [reply, setReply] = useState("");
  const { open: notify } = useNotification();
  const { result: articlesResult } = useList<HelpArticleRecord>({
    resource: "desk_help_articles",
    filters: [{ field: "published", operator: "eq", value: true }],
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    queryOptions: { retry: false },
  });
  const { result: macrosResult } = useList<MacroRecord>({
    resource: "desk_macros",
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "title", order: "asc" }],
    queryOptions: { retry: false },
  });
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
      conversation: messages.map((message) => ({
        direction: message.direction,
        author:
          message.direction === "inbound"
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

  const aiTasks = useMemo<AIEmployeeTask[]>(
    () => [
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
    ],
    [conversationContext.context, translate]
  );

  const appendToReply = (text: string) =>
    setReply((current) => (current ? `${current}\n\n${text}` : text));

  const copyReply = async () => {
    const content = reply.trim();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      notify?.({
        type: "success",
        message: translate(
          "tickets.conversation.draftCopied",
          { ns: "starter" },
          "Reply draft copied. Send it through an approved customer channel."
        ),
      });
    } catch {
      notify?.({
        type: "error",
        message: translate(
          "tickets.conversation.copyFailed",
          { ns: "starter" },
          "Couldn't copy the reply draft."
        ),
      });
    }
  };

  return (
    <section ref={conversationContext.ref} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {translate(
              "tickets.conversation.title",
              { ns: "starter" },
              "Customer conversation"
            )}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {translate(
              "tickets.conversation.recordDescription",
              { ns: "starter" },
              "Customer messages and recorded outbound drafts. Delivery status is shown explicitly."
            )}
          </p>
        </div>
        <AIEmployeeShortcut
          aiEmployee="ellis"
          tasks={aiTasks}
          label={translate(
            "tickets.conversation.aiAction",
            { ns: "starter" },
            "Draft with AI"
          )}
          size={30}
          className="border-primary/20 bg-primary/5"
        />
      </div>

      <ol className="space-y-3">
        <li className="flex gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {record.requester_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold">{record.requester_name}</span>
              <span className="text-xs text-muted-foreground">
                {translate(
                  "tickets.conversation.opened",
                  { ns: "starter" },
                  "Opened ticket"
                )}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">
              {record.description}
            </p>
          </div>
        </li>
        {messages.map((message) => (
          <li key={message.id} className="flex gap-3">
            {message.direction === "outbound" ? (
              <AgentAvatar agent={message.author} className="size-7 shrink-0" />
            ) : (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {record.requester_name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div
              className={cn(
                "min-w-0 flex-1 rounded-xl border px-3 py-2.5",
                message.direction === "outbound"
                  ? "bg-card"
                  : "border-primary/10 bg-primary/5"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold">
                  {message.direction === "outbound"
                    ? agentDisplayName(
                        message.author,
                        translate(
                          "tickets.assignee.unknown",
                          { ns: "starter" },
                          "Unknown agent"
                        )
                      )
                    : record.requester_name}
                </span>
                <RelativeTime value={message.createdAt} />
              </div>
              {message.direction === "outbound" ? (
                <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {translate(
                    "tickets.conversation.deliveryUnverified",
                    { ns: "starter" },
                    "Recorded outbound message — delivery is not verified"
                  )}
                </p>
              ) : null}
              <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {matchingArticles.length ? (
        <div className="rounded-xl border border-dashed bg-muted/35 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {translate(
              "tickets.conversation.aiGrounding",
              { ns: "starter", count: matchingArticles.length },
              `AI will use ${matchingArticles.length} matching help ${matchingArticles.length === 1 ? "article" : "articles"} for a grounded draft.`
            )}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <MacroPicker
            macros={macrosResult.data}
            preferredCategory={record.category}
            onApply={(macro) => appendToReply(macro.body)}
          />
        </div>
        <Textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder={translate(
            "tickets.conversation.replyPlaceholder",
            { ns: "starter" },
            "Write a customer reply..."
          )}
          className="min-h-28"
        />
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {translate(
            "tickets.conversation.deliveryUnavailable",
            { ns: "starter" },
            "Customer delivery is not configured. Copy this draft and send it through an approved channel; copying does not mark the first-response SLA as met."
          )}
        </p>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!reply.trim()}
            onClick={() => void copyReply()}
          >
            <Copy />
            {translate(
              "tickets.conversation.copyDraft",
              { ns: "starter" },
              "Copy reply draft"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Macros are Zendesk's one-click canned replies. The picker searches titles and
 * bodies, previews the text before it lands in the composer, and floats the
 * macros written for this ticket's category to the top.
 */
function MacroPicker({
  macros,
  preferredCategory,
  onApply,
}: {
  macros: MacroRecord[];
  preferredCategory?: TicketRecord["category"];
  onApply: (macro: MacroRecord) => void;
}) {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = macros
    .filter((macro) =>
      `${macro.title} ${macro.body}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    )
    .sort((a, b) => {
      const score = (macro: MacroRecord) =>
        preferredCategory && macro.category === preferredCategory ? 0 : 1;
      return score(a) - score(b);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Wand2 />
            {translate("tickets.macros.apply", { ns: "starter" }, "Apply macro")}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 pl-7"
            placeholder={translate(
              "tickets.macros.search",
              { ns: "starter" },
              "Search macros"
            )}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {translate(
                "tickets.macros.empty",
                { ns: "starter" },
                "No macro matches this search."
              )}
            </p>
          ) : (
            filtered.map((macro) => (
              <button
                key={macro.id}
                type="button"
                onClick={() => {
                  onApply(macro);
                  setOpen(false);
                }}
                className="block w-full rounded-md px-2 py-2 text-left hover:bg-accent/60"
              >
                <p className="text-xs font-semibold">{macro.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {macro.body}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TicketNotes({
  notes,
  ticketId,
  onRefetch,
}: {
  notes: TicketNoteRecord[];
  ticketId: number;
  onRefetch: () => void;
}) {
  const translate = useTranslate();
  const [content, setContent] = useState("");
  const { data: identity } = useGetIdentity<AgentRef & { id: number }>();
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
          onRefetch();
        },
      }
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">
          {translate(
            "tickets.notes.title",
            { ns: "starter", count: notes.length },
            "Internal notes ({{count}})"
          )}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {translate(
            "tickets.notes.description",
            { ns: "starter" },
            "Never shown to the customer. Keep the hand-off trail here."
          )}
        </p>
      </div>
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
              <div className="min-w-0 flex-1 rounded-lg border bg-amber-50/40 px-3 py-2 dark:bg-amber-500/5">
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
                  <RelativeTime value={note.createdAt} />
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
          placeholder={translate(
            "tickets.notes.placeholder",
            { ns: "starter" },
            "Add a private internal note..."
          )}
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

export function TicketCsat({
  record,
  responses,
}: {
  record: TicketRecord;
  responses: CsatRecord[];
}) {
  const translate = useTranslate();

  if (responses[0]) {
    return (
      <section className="rounded-xl border bg-emerald-50/40 p-4 dark:bg-emerald-500/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {translate(
              "tickets.csat.title",
              { ns: "starter" },
              "Customer satisfaction"
            )}
          </h3>
          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
            {responses[0].score}
            <Star className="size-4 fill-current" />
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {responses[0].comment ||
            translate("csat.noComment", { ns: "starter" }, "No comment provided.")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-dashed bg-muted/20 p-4">
      <h3 className="text-sm font-medium">
        {translate(
          "tickets.csat.title",
          { ns: "starter" },
          "Customer satisfaction"
        )}
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {record.status === "resolved" || record.status === "closed"
          ? translate(
              "tickets.csat.awaitingCustomer",
              { ns: "starter" },
              "No verified customer response is recorded. Agents cannot enter CSAT on a customer's behalf."
            )
          : translate(
              "tickets.csat.notEligible",
              { ns: "starter" },
              "Customer feedback is read-only here and can only be collected after resolution through a verified survey."
            )}
      </p>
    </section>
  );
}

export function RelativeTime({ value }: { value: string }) {
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

import { useGetLocale, useTranslate } from "@refinedev/core";
import {
  AlarmClockOff,
  CheckCircle2,
  Inbox,
  Lock,
  MailCheck,
  Reply,
  Star,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  agentDisplayName,
  formatDateTime,
  translateTicketSource,
  type CsatRecord,
  type TicketMessageRecord,
  type TicketNoteRecord,
  type TicketRecord,
} from "../lib";

type ActivityTone = "default" | "danger" | "success";

type ActivityEvent = {
  id: string;
  at: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  tone?: ActivityTone;
};

/**
 * The audit trail a support manager looks for first: when the ticket landed,
 * who answered, when the deadline was missed, and when it was finally closed.
 * Every entry is reconstructed from stored timestamps, so nothing here is
 * decorative — if the first-response clock was missed, that row is the record
 * of it.
 */
export function TicketActivity({
  ticket,
  messages,
  notes,
  csat,
}: {
  ticket: TicketRecord;
  messages: TicketMessageRecord[];
  notes: TicketNoteRecord[];
  csat: CsatRecord[];
}) {
  const translate = useTranslate();
  const locale = useGetLocale()();
  const unknownAgent = translate(
    "tickets.assignee.unknown",
    { ns: "starter" },
    "Unknown agent"
  );

  const events: ActivityEvent[] = [
    {
      id: "created",
      at: ticket.createdAt,
      icon: Inbox,
      title: translate(
        "tickets.activity.created",
        { ns: "starter" },
        "Ticket created"
      ),
      detail: translate(
        "tickets.activity.createdDetail",
        {
          ns: "starter",
          requester: ticket.requester_name,
          source: translateTicketSource(translate, ticket.source),
        },
        "{{requester}} via {{source}}"
      ),
    },
    ...messages.map((message) => ({
      id: `message-${message.id}`,
      at: message.createdAt,
      icon: message.direction === "outbound" ? Reply : Inbox,
      title:
        message.direction === "outbound"
          ? translate(
              "tickets.activity.outboundRecorded",
              { ns: "starter" },
              "Outbound message recorded (delivery unverified)"
            )
          : translate(
              "tickets.activity.customerWrote",
              { ns: "starter" },
              "Customer replied"
            ),
      detail:
        message.direction === "outbound"
          ? agentDisplayName(message.author, unknownAgent)
          : ticket.requester_name,
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      at: note.createdAt,
      icon: Lock,
      title: translate(
        "tickets.activity.noteAdded",
        { ns: "starter" },
        "Internal note added"
      ),
      detail: agentDisplayName(note.author, unknownAgent),
    })),
    ...csat.map((response) => ({
      id: `csat-${response.id}`,
      at: response.createdAt,
      icon: Star,
      tone: (response.score >= 4 ? "success" : "danger") as ActivityTone,
      title: translate(
        "tickets.activity.csat",
        { ns: "starter", score: response.score },
        "Customer rated this {{score}} / 5"
      ),
      detail: response.comment ?? undefined,
    })),
  ];

  if (ticket.first_responded_at) {
    events.push({
      id: "first-response",
      at: ticket.first_responded_at,
      icon: MailCheck,
      tone: ticket.response_breached ? "danger" : "success",
      title: ticket.response_breached
        ? translate(
            "tickets.activity.firstResponseLate",
            { ns: "starter" },
            "First response — after the target"
          )
        : translate(
            "tickets.activity.firstResponse",
            { ns: "starter" },
            "First response — within target"
          ),
      detail: ticket.response_due_at
        ? translate(
            "tickets.activity.targetWas",
            { ns: "starter", target: formatDateTime(ticket.response_due_at, locale) },
            "Target was {{target}}"
          )
        : undefined,
    });
  }

  if (
    !ticket.resolved_at &&
    ticket.resolution_due_at &&
    new Date(ticket.resolution_due_at) < new Date()
  ) {
    events.push({
      id: "resolution-breach",
      at: ticket.resolution_due_at,
      icon: AlarmClockOff,
      tone: "danger",
      title: translate(
        "tickets.activity.resolutionMissed",
        { ns: "starter" },
        "Resolution deadline passed"
      ),
    });
  }

  if (ticket.resolved_at) {
    events.push({
      id: "resolved",
      at: ticket.resolved_at,
      icon: CheckCircle2,
      tone: ticket.resolution_breached ? "danger" : "success",
      title: ticket.resolution_breached
        ? translate(
            "tickets.activity.resolvedLate",
            { ns: "starter" },
            "Resolved — after the deadline"
          )
        : translate(
            "tickets.activity.resolved",
            { ns: "starter" },
            "Resolved — within the deadline"
          ),
      detail:
        ticket.resolution_mins != null
          ? translate(
              "tickets.activity.handlingTime",
              { ns: "starter", count: ticket.resolution_mins },
              "Handling time {{count}} min"
            )
          : undefined,
    });
  }

  const ordered = events.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <ol className="relative space-y-4 border-l pl-6">
      {ordered.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={cn(
              "absolute -left-[31px] flex size-6 items-center justify-center rounded-full border bg-card [&_svg]:size-3",
              event.tone === "danger" &&
                "border-red-300/60 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400",
              event.tone === "success" &&
                "border-emerald-300/60 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400",
              !event.tone && "text-muted-foreground"
            )}
          >
            <event.icon />
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{event.title}</p>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(event.at, locale)}
            </span>
          </div>
          {event.detail ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

import type { useTranslate } from "@refinedev/core";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory =
  | "bug"
  | "question"
  | "feature_request"
  | "account"
  | "billing"
  | "other";
export type TicketSource = "email" | "web";
export type TicketMessageDirection = "inbound" | "outbound";

export type AgentRef = {
  id: number;
  nickname?: string | null;
  username?: string | null;
  email?: string | null;
};

export type TicketRecord = {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: TicketCategory | null;
  source: TicketSource;
  requester_name: string;
  requester_email?: string | null;
  assigneeId?: number | null;
  assignee?: AgentRef | null;
  queue_id?: number | null;
  queue?: NamedRecord | null;
  ticket_type_id?: number | null;
  ticket_type?: NamedRecord | null;
  requester_id?: number | null;
  requester?: RequesterRecord | null;
  sla_policy_id?: number | null;
  sla_policy?: SlaPolicyRecord | null;
  response_due_at?: string | null;
  first_responded_at?: string | null;
  resolution_due_at?: string | null;
  resolved_at?: string | null;
  resolution_mins?: number | null;
  sla_breached?: boolean;
  response_breached?: boolean;
  resolution_breached?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TicketNoteRecord = {
  id: number;
  content: string;
  ticketId: number;
  authorId?: number | null;
  author?: AgentRef | null;
  createdAt: string;
};

export type TicketMessageRecord = {
  id: number;
  content: string;
  direction: TicketMessageDirection;
  ticketId: number;
  authorId?: number | null;
  author?: AgentRef | null;
  createdAt: string;
};

export type HelpArticleRecord = {
  id: number;
  title: string;
  summary?: string | null;
  body: string;
  category?: TicketCategory | null;
  published: boolean;
  article_category_id?: number | null;
  article_category?: NamedRecord | null;
  helpful_yes?: number | null;
  helpful_no?: number | null;
  updatedAt: string;
};

export type NamedRecord = { id: number; name: string };

export type SlaPolicyRecord = NamedRecord & {
  priority: TicketPriority;
  response_mins: number;
  resolve_mins: number;
};

export type RequesterRecord = NamedRecord & {
  email: string;
  company: string;
  createdAt?: string;
};

export type MacroRecord = {
  id: number;
  title: string;
  body: string;
  category: TicketCategory;
};

export type CsatRecord = {
  id: number;
  score: number;
  comment?: string | null;
  ticket_id: number;
  ticket?: TicketRecord | null;
  createdAt: string;
};

export const TICKET_STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export const TICKET_PRIORITIES: TicketPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const TICKET_CATEGORIES: TicketCategory[] = [
  "bug",
  "question",
  "feature_request",
  "account",
  "billing",
  "other",
];

export const TICKET_SOURCES: TicketSource[] = ["email", "web"];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  bug: "Bug",
  question: "Question",
  feature_request: "Feature request",
  account: "Account",
  billing: "Billing",
  other: "Other",
};

export const CATEGORY_ICONS: Record<TicketCategory, string> = {
  bug: "Bug",
  question: "Help",
  feature_request: "Idea",
  account: "Account",
  billing: "Billing",
  other: "Other",
};

export const SOURCE_LABELS: Record<TicketSource, string> = {
  email: "Email",
  web: "Web portal",
};

type Translate = ReturnType<typeof useTranslate>;

export const translateTicketStatus = (
  translate: Translate,
  status: TicketStatus
) =>
  translate(`tickets.status.${status}`, { ns: "starter" }, STATUS_LABELS[status]);

export const translateTicketPriority = (
  translate: Translate,
  priority: TicketPriority
) =>
  translate(`tickets.priority.${priority}`, { ns: "starter" }, PRIORITY_LABELS[priority]);

export const translateTicketCategory = (
  translate: Translate,
  category: TicketCategory
) =>
  translate(`tickets.category.${category}`, { ns: "starter" }, CATEGORY_LABELS[category]);

export const translateTicketSource = (
  translate: Translate,
  source: TicketSource
) =>
  translate(`tickets.source.${source}`, { ns: "starter" }, SOURCE_LABELS[source]);

export const ACTIVE_STATUSES: TicketStatus[] = ["open", "in_progress"];

export const SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 8,
  medium: 24,
  low: 72,
};

export const DUE_SOON_WINDOW_HOURS = 2;

export type SlaState = "overdue" | "due_soon" | "on_track" | "no_deadline";

export const getTicketDueAt = (ticket: Pick<TicketRecord, "resolution_due_at">) =>
  ticket.resolution_due_at ? new Date(ticket.resolution_due_at) : null;

export const isActiveStatus = (status: TicketStatus) =>
  status === "open" || status === "in_progress";

export const getSlaState = (
  ticket: Pick<
    TicketRecord,
    "status" | "resolution_due_at"
  >,
  now: Date = new Date()
): SlaState => {
  if (!isActiveStatus(ticket.status)) return "on_track";
  const due = getTicketDueAt(ticket);
  if (!due) return "no_deadline";
  if (due.getTime() <= now.getTime()) return "overdue";
  if (
    due.getTime() - now.getTime() <=
    DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000
  ) {
    return "due_soon";
  }
  return "on_track";
};

export const computeResolutionDueAt = (
  priority: TicketPriority,
  from: Date = new Date()
) =>
  new Date(
    from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000
  ).toISOString();

export const computeDueAt = (minutes: number, from: Date = new Date()) =>
  new Date(from.getTime() + minutes * 60 * 1000).toISOString();

export const minutesBetween = (start: string, end: string) =>
  Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));

export const formatRelativeDeadline = (
  dueAt: Date,
  translate: Translate,
  now: Date = new Date()
) => {
  const diffMs = dueAt.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const duration =
    hours > 0
      ? translate(
          "tickets.sla.duration.hoursMinutes",
          { ns: "starter", hours, minutes },
          "{{hours}}h {{minutes}}m"
        )
      : translate(
          "tickets.sla.duration.minutes",
          { ns: "starter", minutes },
          "{{minutes}}m"
        );
  return diffMs < 0
    ? translate(
        "tickets.sla.deadline.overdueBy",
        { ns: "starter", duration },
        "{{duration}} overdue"
      )
    : translate(
        "tickets.sla.deadline.dueIn",
        { ns: "starter", duration },
        "due in {{duration}}"
      );
};

export const formatDateTime = (value: string | null | undefined, locale?: string) =>
  value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export const agentDisplayName = (
  agent?: AgentRef | null,
  fallback = "Unassigned"
) => agent?.nickname || agent?.username || agent?.email || fallback;

export const localToday = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Normalise a relation id for use as a Select value.
 *
 * Foreign keys reach these forms as either a string or a number: the edit
 * pages reset the form with `String(...)`, but Refine's useForm then
 * repopulates it from the fetched record, where the keys are raw numbers.
 * Select option values are strings and Base UI matches them with `===`, so an
 * unnormalised number never matches an option and the trigger falls back to
 * printing the raw id.
 */
export const asOptionValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "" : String(value);

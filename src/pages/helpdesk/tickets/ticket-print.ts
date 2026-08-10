import type { useTranslate } from "@refinedev/core";

import { escapeHtml, openPrintDocument } from "../export";
import {
  agentDisplayName,
  formatDateTime,
  translateTicketPriority,
  translateTicketSource,
  translateTicketStatus,
  type CsatRecord,
  type TicketMessageRecord,
  type TicketNoteRecord,
  type TicketRecord,
} from "../lib";

type Translate = ReturnType<typeof useTranslate>;

type PrintInput = {
  ticket: TicketRecord;
  messages: TicketMessageRecord[];
  notes: TicketNoteRecord[];
  csat?: CsatRecord | null;
  translate: Translate;
  locale?: string;
};

const row = (label: string, value: string) =>
  `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;

const entry = (author: string, when: string, body: string) =>
  `<div class="entry"><header><strong>${escapeHtml(author)}</strong><span>${escapeHtml(when)}</span></header><p>${escapeHtml(body)}</p></div>`;

/**
 * A ticket printout an agent can attach to an escalation or hand to finance:
 * the full property sheet, the customer conversation, and the internal notes,
 * in one self-contained document.
 */
export const printTicket = ({
  ticket,
  messages,
  notes,
  csat,
  translate,
  locale,
}: PrintInput) => {
  const unknownAgent = translate(
    "tickets.assignee.unknown",
    { ns: "starter" },
    "Unknown agent"
  );
  const unassigned = translate(
    "tickets.assignee.unassigned",
    { ns: "starter" },
    "Unassigned"
  );

  const properties = [
    row(
      translate("tickets.fields.status", { ns: "starter" }, "Status"),
      translateTicketStatus(translate, ticket.status)
    ),
    row(
      translate("tickets.fields.priority", { ns: "starter" }, "Priority"),
      translateTicketPriority(translate, ticket.priority)
    ),
    row(
      translate("tickets.fields.assignee", { ns: "starter" }, "Assignee"),
      agentDisplayName(ticket.assignee, unassigned)
    ),
    row(
      translate("tickets.fields.queue", { ns: "starter" }, "Queue"),
      ticket.queue?.name ?? "-"
    ),
    row(
      translate("tickets.fields.type", { ns: "starter" }, "Ticket type"),
      ticket.ticket_type?.name ?? "-"
    ),
    row(
      translate("tickets.show.requester", { ns: "starter" }, "Requester"),
      `${ticket.requester_name}${ticket.requester_email ? ` <${ticket.requester_email}>` : ""}`
    ),
    row(
      translate("tickets.fields.source", { ns: "starter" }, "Source"),
      translateTicketSource(translate, ticket.source)
    ),
    row(
      translate("tickets.fields.created", { ns: "starter" }, "Created"),
      formatDateTime(ticket.createdAt, locale)
    ),
    row(
      translate("tickets.fields.responseDue", { ns: "starter" }, "Response due"),
      formatDateTime(ticket.response_due_at, locale)
    ),
    row(
      translate(
        "tickets.fields.resolutionDue",
        { ns: "starter" },
        "Resolution due"
      ),
      formatDateTime(ticket.resolution_due_at, locale)
    ),
    row(
      translate("tickets.fields.resolved", { ns: "starter" }, "Resolved"),
      formatDateTime(ticket.resolved_at, locale)
    ),
    row(
      translate("tickets.fields.slaStatus", { ns: "starter" }, "SLA"),
      ticket.sla_breached
        ? translate("tickets.print.slaBreached", { ns: "starter" }, "Breached")
        : translate("tickets.print.slaMet", { ns: "starter" }, "Within target")
    ),
  ].join("");

  const conversation = [
    entry(
      ticket.requester_name,
      formatDateTime(ticket.createdAt, locale),
      ticket.description
    ),
    ...messages.map((message) =>
      entry(
        message.direction === "outbound"
          ? `${agentDisplayName(message.author, unknownAgent)} · ${translate(
              "tickets.print.deliveryUnverified",
              { ns: "starter" },
              "delivery unverified"
            )}`
          : ticket.requester_name,
        formatDateTime(message.createdAt, locale),
        message.content
      )
    ),
  ].join("");

  const internalNotes = notes.length
    ? notes
        .map((note) =>
          entry(
            agentDisplayName(note.author, unknownAgent),
            formatDateTime(note.createdAt, locale),
            note.content
          )
        )
        .join("")
    : `<p class="meta">${escapeHtml(
        translate("tickets.print.noNotes", { ns: "starter" }, "No internal notes.")
      )}</p>`;

  const satisfaction = csat
    ? `<h2>${escapeHtml(
        translate("tickets.csat.title", { ns: "starter" }, "Customer satisfaction")
      )}</h2><p>${escapeHtml(`${csat.score} / 5`)}${
        csat.comment ? ` — ${escapeHtml(csat.comment)}` : ""
      }</p>`
    : "";

  const body = `
<h1>#${escapeHtml(ticket.id)} · ${escapeHtml(ticket.subject)}</h1>
<p class="meta">${escapeHtml(
    translate(
      "tickets.print.header",
      {
        ns: "starter",
        requester: ticket.requester_name,
        createdAt: formatDateTime(ticket.createdAt, locale),
      },
      "Opened by {{requester}} on {{createdAt}}"
    )
  )}</p>
<h2>${escapeHtml(translate("tickets.show.details", { ns: "starter" }, "Details"))}</h2>
<table>${properties}</table>
<h2>${escapeHtml(
    translate(
      "tickets.conversation.recordsTitle",
      { ns: "starter" },
      "Conversation records"
    )
  )}</h2>
${conversation}
<h2>${escapeHtml(
    translate("tickets.notes.printTitle", { ns: "starter" }, "Internal notes")
  )}</h2>
${internalNotes}
${satisfaction}
<footer>${escapeHtml(
    translate(
      "tickets.print.footer",
      { ns: "starter", printedAt: formatDateTime(new Date().toISOString(), locale) },
      "Printed {{printedAt}}"
    )
  )}</footer>`;

  return openPrintDocument(`#${ticket.id} ${ticket.subject}`, body);
};

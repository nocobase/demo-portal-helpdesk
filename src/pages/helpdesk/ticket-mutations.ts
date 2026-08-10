import {
  computeDueAt,
  minutesBetween,
  type SlaPolicyRecord,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
} from "./lib";

export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: ["open"],
};

export const allowedTicketStatusTransitions = (status: TicketStatus) =>
  TICKET_STATUS_TRANSITIONS[status];

export function buildTicketStatusTransition(
  ticket: Pick<
    TicketRecord,
    | "status"
    | "createdAt"
    | "resolved_at"
    | "response_breached"
    | "resolution_due_at"
  >,
  to: TicketStatus,
  now = new Date()
) {
  if (!allowedTicketStatusTransitions(ticket.status).includes(to)) {
    throw new Error(`Ticket cannot move from ${ticket.status} to ${to}.`);
  }

  if (to === "resolved") {
    const resolvedAt = now.toISOString();
    const resolutionMins = minutesBetween(ticket.createdAt, resolvedAt);
    if (resolutionMins < 0) {
      throw new Error(
        "Ticket creation time is later than the resolution time. The status was not changed."
      );
    }
    const resolutionBreached = Boolean(
      ticket.resolution_due_at && now > new Date(ticket.resolution_due_at)
    );
    return {
      status: to,
      resolved_at: resolvedAt,
      resolution_mins: resolutionMins,
      resolution_breached: resolutionBreached,
      sla_breached: Boolean(ticket.response_breached || resolutionBreached),
    };
  }

  if (to === "open" || to === "in_progress") {
    return {
      status: to,
      resolved_at: null,
      resolution_mins: null,
      resolution_breached: false,
      sla_breached: Boolean(ticket.response_breached),
    };
  }

  if (to === "closed" && !ticket.resolved_at) {
    throw new Error(
      "This ticket has no resolution timestamp and cannot be closed. Reopen it, then resolve it through the normal transition."
    );
  }

  return { status: to };
}

export const policyForPriority = (
  policies: SlaPolicyRecord[],
  priority: TicketPriority
) => policies.find((policy) => policy.priority === priority);

export function buildTicketPriorityChange(
  priority: TicketPriority,
  policy?: SlaPolicyRecord,
  now = new Date()
) {
  return {
    priority,
    sla_policy_id: policy?.id ?? null,
    response_due_at: policy ? computeDueAt(policy.response_mins, now) : null,
    resolution_due_at: policy ? computeDueAt(policy.resolve_mins, now) : null,
    sla_breached: false,
    response_breached: false,
    resolution_breached: false,
  };
}

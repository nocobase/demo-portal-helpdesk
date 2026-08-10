import type { useTranslate } from "@refinedev/core";

import {
  isActiveStatus,
  type SlaPolicyRecord,
  type TicketPriority,
  type TicketRecord,
} from "./lib";

type Translate = ReturnType<typeof useTranslate>;

/**
 * A helpdesk ticket runs two independent clocks: one for the first agent
 * response and one for the resolution. Zendesk and Freshdesk both surface them
 * side by side, because a ticket can be perfectly on track for resolution while
 * the customer is still waiting for the first reply.
 */
export type SlaTarget = "response" | "resolution";

export type SlaClock = {
  target: SlaTarget;
  /** When the target must be met. */
  dueAt: Date | null;
  /** When it was actually met, if it already was. */
  metAt: Date | null;
  /** The backend's own breach flag, which survives the ticket being closed. */
  breached: boolean;
  /** Milliseconds left; negative once the deadline has passed. */
  remainingMs: number | null;
  /** 0-1 share of the window that has been consumed. */
  consumed: number;
  /** A clock still counts down only while the ticket is open. */
  running: boolean;
};

export const buildSlaClock = (
  ticket: TicketRecord,
  target: SlaTarget,
  now: Date = new Date()
): SlaClock => {
  const dueRaw =
    target === "response" ? ticket.response_due_at : ticket.resolution_due_at;
  const metRaw =
    target === "response" ? ticket.first_responded_at : ticket.resolved_at;
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  const metAt = metRaw ? new Date(metRaw) : null;
  const breached = Boolean(
    target === "response" ? ticket.response_breached : ticket.resolution_breached
  );
  const startedAt = new Date(ticket.createdAt);
  const reference = metAt ?? now;
  const window = dueAt ? dueAt.getTime() - startedAt.getTime() : 0;
  const elapsed = reference.getTime() - startedAt.getTime();

  return {
    target,
    dueAt,
    metAt,
    breached,
    remainingMs: dueAt ? dueAt.getTime() - reference.getTime() : null,
    consumed: window > 0 ? Math.min(1.5, Math.max(0, elapsed / window)) : 0,
    running: !metAt && isActiveStatus(ticket.status),
  };
};

export const isClockBreached = (clock: SlaClock) =>
  clock.breached || (clock.remainingMs !== null && clock.remainingMs < 0);

/**
 * Compact countdown used in list cells and timer chips: `2h 14m` / `-45m`.
 * Deliberately terser than `formatRelativeDeadline`, which writes a sentence.
 */
export const formatCountdown = (
  remainingMs: number,
  translate: Translate
) => {
  const overdue = remainingMs < 0;
  const abs = Math.abs(remainingMs);
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const value =
    days > 0
      ? translate(
          "tickets.sla.countdown.daysHours",
          { ns: "starter", days, hours },
          "{{days}}d {{hours}}h"
        )
      : hours > 0
        ? translate(
            "tickets.sla.countdown.hoursMinutes",
            { ns: "starter", hours, minutes },
            "{{hours}}h {{minutes}}m"
          )
        : translate(
            "tickets.sla.countdown.minutes",
            { ns: "starter", minutes },
            "{{minutes}}m"
          );
  return overdue
    ? translate(
        "tickets.sla.countdown.overdue",
        { ns: "starter", value },
        "-{{value}}"
      )
    : value;
};

export const formatMinutes = (minutes: number, translate: Translate) => {
  if (minutes >= 60 * 24) {
    const days = Math.round((minutes / (60 * 24)) * 10) / 10;
    return translate(
      "sla.duration.days",
      { ns: "starter", count: days },
      "{{count}}d"
    );
  }
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return translate(
      "sla.duration.hours",
      { ns: "starter", count: hours },
      "{{count}}h"
    );
  }
  return translate(
    "sla.duration.minutes",
    { ns: "starter", count: Math.round(minutes) },
    "{{count}}m"
  );
};

/**
 * Backlog ageing, the standard support-desk health check: an open ticket that
 * is a week old is a different problem from ten that are an hour old.
 */
export type AgingBucketId = "under_4h" | "under_24h" | "under_3d" | "under_7d" | "over_7d";

export const AGING_BUCKETS: Array<{
  id: AgingBucketId;
  i18nKey: string;
  fallback: string;
  /** Upper bound in hours; `null` means "everything older". */
  maxHours: number | null;
}> = [
  { id: "under_4h", i18nKey: "aging.bucket.under4h", fallback: "< 4h", maxHours: 4 },
  { id: "under_24h", i18nKey: "aging.bucket.under24h", fallback: "4-24h", maxHours: 24 },
  { id: "under_3d", i18nKey: "aging.bucket.under3d", fallback: "1-3d", maxHours: 72 },
  { id: "under_7d", i18nKey: "aging.bucket.under7d", fallback: "3-7d", maxHours: 168 },
  { id: "over_7d", i18nKey: "aging.bucket.over7d", fallback: "> 7d", maxHours: null },
];

export const agingBucketOf = (
  ticket: Pick<TicketRecord, "createdAt">,
  now: Date = new Date()
): AgingBucketId => {
  const hours =
    (now.getTime() - new Date(ticket.createdAt).getTime()) / (60 * 60 * 1000);
  for (const bucket of AGING_BUCKETS) {
    if (bucket.maxHours === null || hours < bucket.maxHours) return bucket.id;
  }
  return "over_7d";
};

/**
 * Policy attainment: of the tickets governed by a policy, how many met the
 * first-response and the resolution target. Computed from the ticket rows the
 * caller already loaded so no extra roundtrip is needed.
 */
export type PolicyAttainment = {
  total: number;
  responseMeasured: number;
  responseMet: number;
  resolutionMeasured: number;
  resolutionMet: number;
};

export const emptyAttainment = (): PolicyAttainment => ({
  total: 0,
  responseMeasured: 0,
  responseMet: 0,
  resolutionMeasured: 0,
  resolutionMet: 0,
});

export const accumulateAttainment = (
  attainment: PolicyAttainment,
  ticket: TicketRecord
): PolicyAttainment => {
  attainment.total += 1;
  if (ticket.first_responded_at) {
    attainment.responseMeasured += 1;
    if (!ticket.response_breached) attainment.responseMet += 1;
  }
  if (ticket.resolved_at) {
    attainment.resolutionMeasured += 1;
    if (!ticket.resolution_breached) attainment.resolutionMet += 1;
  }
  return attainment;
};

export const attainmentRate = (met: number, measured: number) =>
  measured > 0 ? (met / measured) * 100 : null;

/**
 * The policy matrix Zendesk shows on its SLA page: one row per priority, one
 * column per target. Policies are keyed by priority in this schema, so a
 * priority with no policy is a real configuration gap worth surfacing.
 */
export const policyByPriority = (policies: SlaPolicyRecord[]) => {
  const map = new Map<TicketPriority, SlaPolicyRecord>();
  for (const policy of policies) {
    if (!map.has(policy.priority)) map.set(policy.priority, policy);
  }
  return map;
};

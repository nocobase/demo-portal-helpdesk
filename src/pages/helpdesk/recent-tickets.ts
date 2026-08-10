export type RecentTicket = { id: number; subject: string; at: string };

const STORAGE_KEY = "helpdesk.recent-tickets";

function isRecentTicket(value: unknown): value is RecentTicket {
  if (!value || typeof value !== "object") return false;

  const ticket = value as Record<string, unknown>;
  return (
    typeof ticket.id === "number" &&
    Number.isFinite(ticket.id) &&
    typeof ticket.subject === "string" &&
    typeof ticket.at === "string"
  );
}

export function recordRecentTicket(ticket: {
  id: number;
  subject: string;
}): void {
  const recent = readRecentTickets().filter((item) => item.id !== ticket.id);

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: ticket.id, subject: ticket.subject, at: new Date().toISOString() },
        ...recent,
      ].slice(0, 8))
    );
  } catch {
    // Storage can be unavailable or full without affecting ticket viewing.
  }
}

export function readRecentTickets(): RecentTicket[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isRecentTicket)) return [];

    return parsed.slice(0, 8);
  } catch {
    return [];
  }
}

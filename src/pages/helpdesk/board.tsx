import { useList, useTranslate, useUpdate } from "@refinedev/core";
import { Plus } from "lucide-react";
import { useState, type DragEvent } from "react";
import { Outlet } from "react-router";

import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PriorityBadge, TicketStatusBadge } from "./badges";
import {
  isActiveStatus,
  TICKET_STATUSES,
  agentDisplayName,
  formatRelativeDeadline,
  getSlaState,
  getTicketDueAt,
  type TicketRecord,
  type TicketStatus,
} from "./lib";
import { AgentAvatar } from "./tickets/ticket-list";
import { useOpenContextualChild } from "./route-surfaces";

const COLUMN_STYLES: Record<TicketStatus, string> = {
  open: "border-t-blue-400",
  in_progress: "border-t-amber-400",
  resolved: "border-t-emerald-400",
  closed: "border-t-muted-foreground/40",
};

export function BoardPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const update = useUpdate();
  const [dragOver, setDragOver] = useState<TicketStatus | null>(null);
  const { result, query } = useList<TicketRecord>({
    resource: "desk_tickets",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    sorters: [{ field: "createdAt", order: "desc" }],
    meta: { appends: ["assignee"] },
    queryOptions: { retry: false },
  });

  const moveTicket = (ticket: TicketRecord, to: TicketStatus) => {
    if (ticket.status === to) return;
    const values: Record<string, unknown> = { status: to };
    if (to === "resolved") values.resolved_at = new Date().toISOString();
    if ((to === "in_progress" || to === "open") && ticket.resolved_at) {
      values.resolved_at = null;
    }
    update.mutate(
      { resource: "desk_tickets", id: ticket.id, values },
      { onSuccess: () => query.refetch() }
    );
  };

  const handleDrop = (event: DragEvent, status: TicketStatus) => {
    event.preventDefault();
    setDragOver(null);
    const raw = event.dataTransfer.getData("text/ticket-id");
    const ticket = result.data.find((item) => String(item.id) === raw);
    if (ticket) moveTicket(ticket, status);
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center text-muted-foreground">
          <Breadcrumb />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.035em]">
              {translate("navigation.board", { ns: "starter" }, "Board")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {translate(
                "board.description",
                { ns: "starter" },
                "Drag cards between columns to move tickets through open, in progress, resolved, and closed."
              )}
            </p>
          </div>
          <Button type="button" onClick={() => openChild("create")}>
            <Plus />
            {translate("tickets.actions.new", { ns: "starter" }, "New ticket")}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TICKET_STATUSES.map((status) => (
            <div key={status} className="rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid flex-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TICKET_STATUSES.map((status) => {
            const tickets = result.data.filter(
              (ticket) => ticket.status === status
            );
            return (
              <div
                key={status}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(status);
                }}
                onDragLeave={() => setDragOver((current) => (current === status ? null : current))}
                onDrop={(event) => handleDrop(event, status)}
                className={cn(
                  "flex min-h-48 flex-col gap-3 rounded-xl border border-t-2 bg-muted/40 p-3 transition-colors",
                  COLUMN_STYLES[status],
                  dragOver === status && "border-primary/50 bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <TicketStatusBadge status={status} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {tickets.length}
                  </span>
                </div>
                {tickets.map((ticket) => (
                  <BoardCard
                    key={ticket.id}
                    ticket={ticket}
                    onOpen={() => openChild(String(ticket.id))}
                  />
                ))}
                {tickets.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    {translate(
                      "board.emptyColumn",
                      { ns: "starter" },
                      "Drop tickets here"
                    )}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <Outlet />
    </div>
  );
}

function BoardCard({
  ticket,
  onOpen,
}: {
  ticket: TicketRecord;
  onOpen: () => void;
}) {
  const translate = useTranslate();
  const due = getTicketDueAt(ticket);
  const slaState = getSlaState(ticket);
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) =>
        event.dataTransfer.setData("text/ticket-id", String(ticket.id))
      }
      onClick={onOpen}
      className="cursor-grab space-y-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <p className="line-clamp-2 text-sm font-medium">{ticket.subject}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={ticket.priority} />
        {isActiveStatus(ticket.status) && slaState !== "on_track" && due ? (
          <span
            className={cn(
              "text-xs font-medium",
              slaState === "overdue"
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {formatRelativeDeadline(due, translate)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {ticket.requester_name}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AgentAvatar agent={ticket.assignee} className="size-5" />
          {agentDisplayName(
            ticket.assignee,
            translate(
              "tickets.assignee.unassigned",
              { ns: "starter" },
              "Unassigned"
            )
          )}
        </span>
      </div>
    </button>
  );
}

import {
  useDeleteMany,
  useNotification,
  useTranslate,
  useUpdateMany,
  type BaseKey,
} from "@refinedev/core";
import { ChevronDown, Trash2, UserRoundCheck, X } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  agentDisplayName,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  translateTicketPriority,
  translateTicketStatus,
  type AgentRef,
  type SlaPolicyRecord,
  type TicketPriority,
  type TicketRecord,
  type TicketStatus,
} from "./lib";
import {
  allowedTicketStatusTransitions,
  buildTicketPriorityChange,
  buildTicketStatusTransition,
  policyForPriority,
} from "./ticket-mutations";

/**
 * The floating bar Zendesk and Freshdesk show once rows are ticked. Everything
 * here is a real bulk write against the selected ids: reassign, move through
 * the status flow, re-prioritise, or delete with a confirmation step.
 */
export function TicketBulkActions({
  selected,
  agents,
  policies,
  onDone,
  onClear,
}: {
  selected: TicketRecord[];
  agents: AgentRef[];
  policies: SlaPolicyRecord[];
  onDone: () => void;
  onClear: () => void;
}) {
  const translate = useTranslate();
  const { open: notify } = useNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateMany = useUpdateMany();
  const deleteMany = useDeleteMany();
  const ids = selected.map((ticket) => ticket.id as BaseKey);
  const pending = updateMany.mutation.isPending || deleteMany.mutation.isPending;

  const applyValues = (values: Record<string, unknown>) => {
    if (!ids.length) return;
    updateMany.mutate(
      { resource: "desk_tickets", ids, values },
      { onSuccess: onDone }
    );
  };

  // Resolving in bulk has to write the same derived SLA fields the detail
  // drawer writes, otherwise the reports would silently disagree with the
  // ticket. Per-ticket values mean one call each for that transition.
  const applyStatus = async (status: TicketStatus) => {
    const changedAt = new Date();
    try {
      await Promise.all(
        selected.map((ticket) =>
          updateMany.mutateAsync({
            resource: "desk_tickets",
            ids: [ticket.id as BaseKey],
            values: buildTicketStatusTransition(ticket, status, changedAt),
            successNotification: false,
            errorNotification: false,
          })
        )
      );
      onDone();
    } catch (error) {
      notify?.({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Some tickets could not be updated. No successful changes were hidden.",
      });
      onDone();
    }
  };

  const commonStatusTargets = TICKET_STATUSES.filter((status) =>
    selected.every((ticket) =>
      allowedTicketStatusTransitions(ticket.status).includes(status)
    )
  );

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
      <span className="text-sm font-medium">
        {translate(
          "tickets.bulk.selected",
          { ns: "starter", count: selected.length },
          "{{count}} selected"
        )}
      </span>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              <UserRoundCheck />
              {translate("tickets.bulk.assign", { ns: "starter" }, "Assign")}
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel>
            {translate("tickets.bulk.assignTo", { ns: "starter" }, "Assign to")}
          </DropdownMenuLabel>
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onClick={() => applyValues({ assigneeId: agent.id })}
            >
              {agentDisplayName(agent)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => applyValues({ assigneeId: null })}>
            {translate("tickets.bulk.unassign", { ns: "starter" }, "Unassign")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              {translate("tickets.bulk.status", { ns: "starter" }, "Status")}
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          {commonStatusTargets.map((status) => (
            <DropdownMenuItem key={status} onClick={() => void applyStatus(status)}>
              {translateTicketStatus(translate, status)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              {translate("tickets.bulk.priority", { ns: "starter" }, "Priority")}
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          {TICKET_PRIORITIES.map((priority: TicketPriority) => (
            <DropdownMenuItem
              key={priority}
              onClick={() =>
                applyValues(
                  buildTicketPriorityChange(
                    priority,
                    policyForPriority(policies, priority)
                  )
                )
              }
            >
              {translateTicketPriority(translate, priority)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 />
        {translate("buttons.delete", { ns: "starter" }, "Delete")}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto"
        onClick={onClear}
      >
        <X />
        {translate("tickets.bulk.clear", { ns: "starter" }, "Clear selection")}
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate(
                "tickets.bulk.deleteTitle",
                { ns: "starter", count: selected.length },
                "Delete {{count}} tickets?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translate(
                "tickets.bulk.deleteDescription",
                { ns: "starter" },
                "The conversation, internal notes, and satisfaction responses attached to them go with the tickets. This cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {translate("buttons.cancel", { ns: "starter" }, "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMany.mutate(
                  { resource: "desk_tickets", ids },
                  { onSuccess: onDone }
                )
              }
            >
              {translate("buttons.delete", { ns: "starter" }, "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

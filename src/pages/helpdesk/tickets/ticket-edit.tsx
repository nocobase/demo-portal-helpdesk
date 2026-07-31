import { type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";
import { useParams } from "react-router";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
  useRouteSurfaceClose,
} from "@/extensions/nocobase-route-surfaces";
import {
  computeResolutionDueAt,
  type TicketPriority,
  type TicketRecord,
} from "../lib";
import {
  TicketFormFields,
  type TicketFormValues,
} from "./ticket-form-fields";
import { ticketPaths } from "./ticket-list";

export function TicketEdit() {
  const { id } = useParams<{ id: string }>();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title="Edit ticket"
        description="Change ticket details. Changing the priority resets the response deadline."
        closeLabel="Close"
        closeTo={ticketPaths.list}
        beforeClose={beforeClose}
      >
        <TicketEditForm ticketId={id} />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function TicketEditForm({ ticketId }: { ticketId?: string }) {
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm<TicketRecord, HttpError, TicketFormValues>({
    refineCoreProps: {
      resource: "desk_tickets",
      action: "edit",
      id: ticketId,
      redirect: false,
      meta: { appends: ["assignee"] },
      onMutationSuccess: () => {
        close({ skipBeforeClose: true });
      },
    },
    defaultValues: {
      subject: "",
      description: "",
      priority: "medium",
      category: "",
      source: "email",
      requester_name: "",
      requester_email: "",
      assigneeId: "",
    },
  });
  const record = query?.data?.data;

  useEffect(() => {
    if (!record) return;
    form.reset({
      subject: record.subject ?? "",
      description: record.description ?? "",
      priority: record.priority ?? "medium",
      category: record.category ?? "",
      source: record.source ?? "email",
      requester_name: record.requester_name ?? "",
      requester_email: record.requester_email ?? "",
      assigneeId: record.assigneeId != null ? String(record.assigneeId) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  if (query?.isLoading) {
    return <LoadingState className="min-h-64" />;
  }

  const originalPriority = record?.priority ?? "medium";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onFinish(
            toUpdatePayload(values, originalPriority) as unknown as TicketFormValues
          )
        )}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
          <TicketFormFields form={form} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}

function toUpdatePayload(values: TicketFormValues, originalPriority: string) {
  const payload: Record<string, unknown> = {
    subject: values.subject,
    description: values.description,
    priority: values.priority,
    category: values.category || null,
    source: values.source,
    requester_name: values.requester_name,
    requester_email: values.requester_email || null,
    assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
  };
  if (values.priority !== originalPriority) {
    payload.resolution_due_at = computeResolutionDueAt(
      values.priority as TicketPriority
    );
  }
  return payload;
}

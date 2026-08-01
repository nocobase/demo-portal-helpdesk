import { useTranslate, type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";
import { useParams } from "react-router";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
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
import { useContextualCloseTo } from "../route-surfaces";

export function TicketEdit() {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const closeTo = useContextualCloseTo();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate("tickets.actions.edit", { ns: "starter" }, "Edit ticket")}
        description={translate("tickets.form.editDescription", { ns: "starter" }, "Change ticket details. Changing the priority resets the response deadline.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <TicketEditForm ticketId={id} />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function TicketEditForm({ ticketId }: { ticketId?: string }) {
  const translate = useTranslate();
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
            {translate("buttons.cancel", { ns: "starter" }, "Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? translate("tickets.actions.saving", { ns: "starter" }, "Saving...")
              : translate("tickets.actions.save", { ns: "starter" }, "Save changes")}
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

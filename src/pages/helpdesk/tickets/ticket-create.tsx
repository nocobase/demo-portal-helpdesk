import { type HttpError, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { AIEmployeeShortcut, useAIForm, type AIEmployeeTask } from "@/extensions/nocobase-ai";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
  useRouteSurfaceClose,
} from "@/extensions/nocobase-route-surfaces";
import { computeResolutionDueAt, type TicketRecord, type TicketPriority } from "../lib";
import {
  TicketFormFields,
  type TicketFormValues,
} from "./ticket-form-fields";
import { ticketPaths } from "./ticket-list";

export function TicketCreate() {
  const translate = useTranslate();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title="New ticket"
        description="Log a customer issue coming in by email or the web portal. The response deadline is set from the priority."
        closeLabel="Close"
        closeTo={ticketPaths.list}
        beforeClose={beforeClose}
      >
        <TicketCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function TicketCreateForm() {
  const close = useRouteSurfaceClose();
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<TicketRecord, HttpError, TicketFormValues>({
    refineCoreProps: {
      resource: "desk_tickets",
      action: "create",
      redirect: false,
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
  const aiFormRef = useAIForm({
    id: "ticket-intake-form",
    title: "New ticket intake",
    fields: useMemo(
      () => [
        { name: "subject", title: "Subject", required: true },
        { name: "description", title: "Description", required: true },
        { name: "category", title: "Category", enum: ["bug", "question", "feature_request", "account", "billing", "other"] },
        { name: "priority", title: "Priority", enum: ["low", "medium", "high", "urgent"] },
      ],
      []
    ),
    getValues: () => form.getValues(),
    setValues: (values) => {
      for (const [name, value] of Object.entries(values)) {
        form.setValue(name as keyof TicketFormValues, value as never, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      }
    },
  });
  const classifyTask = useMemo<AIEmployeeTask>(() => ({
    title: "Suggest category and priority",
    autoSend: true,
    message: {
      system: "You are a support ticket triage assistant. Read the subject and description. Fill only category and priority in the current form. Choose urgent only when there is an outage, data loss, security concern, or an immediate major customer impact. Do not submit the form.",
      user: "Classify this incoming support ticket and fill in its category and priority.",
    },
  }), []);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onFinish(
            toCreatePayload(values) as unknown as TicketFormValues
          )
        )}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div ref={aiFormRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
            <p className="text-xs leading-5 text-muted-foreground">Paste the customer’s plain-text request, then have AI suggest a category and priority. You stay in control before creating the ticket.</p>
            <AIEmployeeShortcut aiEmployee="dex" tasks={[classifyTask]} label="Triage with AI" size={28} className="shrink-0" />
          </div>
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
            {form.formState.isSubmitting ? "Creating..." : "Create ticket"}
          </Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}

export function toCreatePayload(values: TicketFormValues) {
  return {
    subject: values.subject,
    description: values.description,
    status: "open",
    priority: values.priority,
    category: values.category || null,
    source: values.source,
    requester_name: values.requester_name,
    requester_email: values.requester_email || null,
    assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
    resolution_due_at: computeResolutionDueAt(
      values.priority as TicketPriority
    ),
  };
}

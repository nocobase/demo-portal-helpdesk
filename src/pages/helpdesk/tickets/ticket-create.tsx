import { useTranslate, type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useMemo } from "react";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { AIEmployeeShortcut, useAIForm, type AIEmployeeTask } from "@/extensions/nocobase-ai";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { computeResolutionDueAt, type TicketRecord, type TicketPriority } from "../lib";
import {
  TicketFormFields,
  type TicketFormValues,
} from "./ticket-form-fields";
import { useContextualCloseTo } from "../route-surfaces";

export function TicketCreate() {
  const translate = useTranslate();
  const closeTo = useContextualCloseTo();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate("tickets.actions.new", { ns: "starter" }, "New ticket")}
        description={translate("tickets.form.createDescription", { ns: "starter" }, "Log a customer issue coming in by email or the web portal. The response deadline is set from the priority.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <TicketCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function TicketCreateForm() {
  const translate = useTranslate();
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
    title: translate("tickets.form.aiContextTitle", { ns: "starter" }, "New ticket intake"),
    fields: useMemo(
      () => [
        { name: "subject", title: translate("tickets.fields.subject", { ns: "starter" }, "Subject"), required: true },
        { name: "description", title: translate("tickets.fields.description", { ns: "starter" }, "Description"), required: true },
        { name: "category", title: translate("tickets.fields.category", { ns: "starter" }, "Category"), enum: ["bug", "question", "feature_request", "account", "billing", "other"] },
        { name: "priority", title: translate("tickets.fields.priority", { ns: "starter" }, "Priority"), enum: ["low", "medium", "high", "urgent"] },
      ],
      [translate]
    ),
    getValues: () => form.getValues(),
    setValues: (values) => {
      for (const [name, value] of Object.entries(values)) {
        form.setValue(name as keyof TicketFormValues, value as never, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      }
    },
  });
  const classifyTask = useMemo<AIEmployeeTask>(() => ({
    title: translate("tickets.form.aiTaskTitle", { ns: "starter" }, "Suggest category and priority"),
    autoSend: true,
    message: {
      system: translate("tickets.form.aiSystemPrompt", { ns: "starter" }, "You are a support ticket triage assistant. Read the subject and description. Fill only category and priority in the current form. Choose urgent only when there is an outage, data loss, security concern, or an immediate major customer impact. Do not submit the form."),
      user: translate("tickets.form.aiUserPrompt", { ns: "starter" }, "Classify this incoming support ticket and fill in its category and priority."),
    },
  }), [translate]);

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
            <p className="text-xs leading-5 text-muted-foreground">{translate("tickets.form.aiHint", { ns: "starter" }, "Paste the customer's plain-text request, then have AI suggest a category and priority. You stay in control before creating the ticket.")}</p>
            <AIEmployeeShortcut aiEmployee="dex" tasks={[classifyTask]} label={translate("tickets.form.aiAction", { ns: "starter" }, "Triage with AI")} size={28} className="shrink-0" />
          </div>
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
              ? translate("tickets.actions.creating", { ns: "starter" }, "Creating...")
              : translate("tickets.actions.create", { ns: "starter" }, "Create ticket")}
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

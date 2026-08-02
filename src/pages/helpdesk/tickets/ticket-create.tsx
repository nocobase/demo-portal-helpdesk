import { useList, useTranslate, type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useMemo } from "react";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";

import { AiFillPanel, useAiFill, type AiFillField } from "@/components/ai-fill";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { AIEmployeeShortcut, useAIForm, type AIEmployeeTask } from "@/extensions/nocobase-ai";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import {
  computeDueAt,
  computeResolutionDueAt,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
  type SlaPolicyRecord,
  type TicketRecord,
  type TicketPriority,
} from "../lib";
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
  const { result: policies } = useList<SlaPolicyRecord>({ resource: "desk_sla_policies", pagination: { mode: "server", currentPage: 1, pageSize: 20 } });
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
      queue_id: "",
      ticket_type_id: "",
      requester_id: "",
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
  // Field contract for the one-shot "fill from a description" panel. The allowed
  // values are the exported constants the Select inputs render from, so a value
  // the form cannot display can never be written.
  const aiFillFields = useMemo<AiFillField[]>(
    () => [
      {
        name: "subject",
        title: translate("tickets.fields.subject", { ns: "starter" }, "Subject"),
        type: "string",
        description: "A short title for the ticket, at most 80 characters.",
      },
      {
        name: "description",
        title: translate("tickets.fields.description", { ns: "starter" }, "Description"),
        type: "string",
        description: "Restate the customer's issue in clear English.",
      },
      {
        name: "category",
        title: translate("tickets.fields.category", { ns: "starter" }, "Category"),
        type: "string",
        enum: [...TICKET_CATEGORIES],
      },
      {
        name: "priority",
        title: translate("tickets.fields.priority", { ns: "starter" }, "Priority"),
        type: "string",
        enum: [...TICKET_PRIORITIES],
      },
      {
        name: "source",
        title: translate("tickets.fields.source", { ns: "starter" }, "Source"),
        type: "string",
        enum: [...TICKET_SOURCES],
      },
      {
        name: "requester_name",
        title: translate("tickets.fields.requesterName", { ns: "starter" }, "Requester name"),
        type: "string",
        description: "Only when the text names the person reporting the issue.",
      },
      {
        name: "requester_email",
        title: translate("tickets.fields.requesterEmail", { ns: "starter" }, "Requester email"),
        type: "string",
        description: "Only when the text contains an email address.",
      },
    ],
    [translate]
  );

  const ai = useAiFill({
    formId: "desk-ticket-create",
    title: translate("tickets.actions.new", { ns: "starter" }, "New ticket"),
    fields: aiFillFields,
    getValues: () => form.getValues() as Record<string, unknown>,
    setValues: (values) => {
      for (const [name, value] of Object.entries(values)) {
        form.setValue(name as keyof TicketFormValues, value as never, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
    },
    instructions:
      "Choose the urgent priority only for an outage, data loss, a security concern, " +
      "or an immediate major customer impact. Use the web source unless the text reads like an email.",
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
            toCreatePayload(values, policies.data.find((policy) => policy.priority === values.priority)) as unknown as TicketFormValues
          )
        )}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div ref={aiFormRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
          <AiFillPanel
            ai={ai}
            title={translate("tickets.form.aiFillTitle", { ns: "starter" }, "AI assist")}
            description={translate(
              "tickets.form.aiFillDescription",
              { ns: "starter" },
              "Paste the customer's request in plain language. AI assist will structure the ticket for you."
            )}
            inputLabel={translate(
              "tickets.form.aiFillLabel",
              { ns: "starter" },
              "Describe the customer's issue"
            )}
            placeholder={translate(
              "tickets.form.aiFillPlaceholder",
              { ns: "starter" },
              "Example: Maria Lopez emailed that she cannot log in after yesterday's billing change and her team is blocked."
            )}
          />

          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
            <p className="text-xs leading-5 text-muted-foreground">{translate("tickets.form.aiHint", { ns: "starter" }, "Already typed the subject and description? Have the AI employee re-check just the category and priority.")}</p>
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

export function toCreatePayload(values: TicketFormValues, policy?: SlaPolicyRecord) {
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
    queue_id: values.queue_id ? Number(values.queue_id) : null,
    ticket_type_id: values.ticket_type_id ? Number(values.ticket_type_id) : null,
    requester_id: values.requester_id ? Number(values.requester_id) : null,
    sla_policy_id: policy?.id ?? null,
    response_due_at: policy ? computeDueAt(policy.response_mins) : null,
    resolution_due_at: computeResolutionDueAt(
      values.priority as TicketPriority
    ),
    ...(policy ? { resolution_due_at: computeDueAt(policy.resolve_mins) } : {}),
    sla_breached: false,
    response_breached: false,
    resolution_breached: false,
  };
}

import { asOptionValue } from "../lib";
import { useMemo } from "react";
import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  agentDisplayName,
  SLA_HOURS,
  TICKET_PRIORITIES,
  type AgentRef,
  type NamedRecord,
  type RequesterRecord,
  translateTicketCategory,
  translateTicketPriority,
  translateTicketSource,
} from "../lib";

export type TicketFormValues = {
  subject: string;
  description: string;
  priority: string;
  category: string;
  source: string;
  requester_name: string;
  requester_email: string;
  assigneeId: string;
  queue_id: string;
  ticket_type_id: string;
  requester_id: string;
};

export function TicketFormFields({
  form,
}: {
  form: UseFormReturn<TicketFormValues>;
}) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const watchedPriority = form.watch("priority");
  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const { result: queuesResult } = useList<NamedRecord>({ resource: "desk_queues", pagination: { mode: "server", currentPage: 1, pageSize: 50 } });
  const { result: typesResult } = useList<NamedRecord>({ resource: "desk_ticket_types", pagination: { mode: "server", currentPage: 1, pageSize: 50 } });
  const { result: requestersResult } = useList<RequesterRecord>({ resource: "desk_requesters", pagination: { mode: "server", currentPage: 1, pageSize: 100 } });
  // Base UI resolves a Select's trigger label from `items`. Without it the
  // trigger prints the raw value, which for these async-loaded relations is a
  // bare foreign-key id: the options only arrive after the first render, and
  // passing the looked-up label as static SelectValue children does not
  // re-render once they do.
  const queueItems = useMemo(
    () =>
      queuesResult.data.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [queuesResult.data]
  );
  const typeItems = useMemo(
    () =>
      typesResult.data.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [typesResult.data]
  );
  const requesterItems = useMemo(
    () =>
      requestersResult.data.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [requestersResult.data]
  );
  const unassignedLabel = translate(
    "tickets.assignee.unassigned",
    { ns: "starter" },
    "Unassigned"
  );
  const agentItems = useMemo(
    () =>
      agentsResult.data.map((agent) => ({
        value: String(agent.id),
        label: agentDisplayName(agent, unassignedLabel),
      })),
    [agentsResult.data, unassignedLabel]
  );

  const slaHours =
    SLA_HOURS[watchedPriority as keyof typeof SLA_HOURS] ?? SLA_HOURS.medium;
  const deadlinePreview = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Date.now() + slaHours * 60 * 60 * 1000));

  return (
    <>
      <FormField
        control={form.control}
        name="subject"
        rules={{ required: translate("tickets.form.validation.subjectRequired", { ns: "starter" }, "Subject is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("tickets.fields.subject", { ns: "starter" }, "Subject")}</FormLabel>
            <FormControl
              render={
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate("tickets.form.subjectPlaceholder", { ns: "starter" }, "Short summary of the customer's issue")}
                />
              }
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        rules={{ required: translate("tickets.form.validation.descriptionRequired", { ns: "starter" }, "Description is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("tickets.fields.description", { ns: "starter" }, "Description")}</FormLabel>
            <FormControl
              render={
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={translate("tickets.form.descriptionPlaceholder", { ns: "starter" }, "What happened, steps to reproduce, impacted customers...")}
                />
              }
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField control={form.control} name="queue_id" rules={{ required: translate("tickets.form.validation.queueRequired", { ns: "starter" }, "Queue is required") }} render={({ field }) => <FormItem><FormLabel>{translate("tickets.fields.queue", { ns: "starter" }, "Queue")}</FormLabel><FormControl render={<Select items={queueItems} value={asOptionValue(field.value)} onValueChange={(value) => field.onChange(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder={translate("tickets.form.queuePlaceholder", { ns: "starter" }, "Select queue")} /></SelectTrigger><SelectContent>{queuesResult.data.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>} /><FormMessage /></FormItem>} />
        <FormField control={form.control} name="ticket_type_id" rules={{ required: translate("tickets.form.validation.typeRequired", { ns: "starter" }, "Ticket type is required") }} render={({ field }) => <FormItem><FormLabel>{translate("tickets.fields.type", { ns: "starter" }, "Ticket type")}</FormLabel><FormControl render={<Select items={typeItems} value={asOptionValue(field.value)} onValueChange={(value) => field.onChange(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder={translate("tickets.form.typePlaceholder", { ns: "starter" }, "Select ticket type")} /></SelectTrigger><SelectContent>{typesResult.data.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select>} /><FormMessage /></FormItem>} />
      </div>

      <FormField control={form.control} name="requester_id" rules={{ required: translate("tickets.form.validation.requesterProfileRequired", { ns: "starter" }, "Requester profile is required") }} render={({ field }) => <FormItem><FormLabel>{translate("tickets.fields.requesterProfile", { ns: "starter" }, "Requester profile")}</FormLabel><FormControl render={<Select items={requesterItems} value={asOptionValue(field.value)} onValueChange={(value) => { field.onChange(value ?? ""); const requester = requestersResult.data.find((item) => String(item.id) === value); if (requester) { form.setValue("requester_name", requester.name, { shouldDirty: true }); form.setValue("requester_email", requester.email, { shouldDirty: true }); } }}><SelectTrigger className="w-full"><SelectValue placeholder={translate("tickets.form.requesterProfilePlaceholder", { ns: "starter" }, "Select requester")} /></SelectTrigger><SelectContent>{requestersResult.data.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.company}</SelectItem>)}</SelectContent></Select>} /><FormMessage /></FormItem>} />

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="priority"
          rules={{ required: translate("tickets.form.validation.priorityRequired", { ns: "starter" }, "Priority is required") }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.priority", { ns: "starter" }, "Priority")}</FormLabel>
              <FormControl
                render={
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={translate("tickets.form.priorityPlaceholder", { ns: "starter" }, "Select priority")}>
                        {field.value
                          ? translateTicketPriority(
                              translate,
                              field.value as Parameters<typeof translateTicketPriority>[1]
                            )
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {translateTicketPriority(translate, priority)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <FormDescription>
                {translate(
                  "tickets.form.responseDeadline",
                  { ns: "starter", hours: slaHours, deadline: deadlinePreview },
                  "Response deadline: {{hours}}h (by {{deadline}})"
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="source"
          rules={{ required: translate("tickets.form.validation.sourceRequired", { ns: "starter" }, "Source is required") }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.source", { ns: "starter" }, "Source")}</FormLabel>
              <FormControl
                render={
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={translate("tickets.form.sourcePlaceholder", { ns: "starter" }, "Select source")}>
                        {field.value
                          ? translateTicketSource(
                              translate,
                              field.value as Parameters<typeof translateTicketSource>[1]
                            )
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">{translateTicketSource(translate, "email")}</SelectItem>
                      <SelectItem value="web">{translateTicketSource(translate, "web")}</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.category", { ns: "starter" }, "Category")}</FormLabel>
              <FormControl
                render={
                  <Select
                    value={field.value || ""}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={translate("tickets.form.categoryPlaceholder", { ns: "starter" }, "Select category")}>
                        {field.value
                          ? translateTicketCategory(
                              translate,
                              field.value as Parameters<typeof translateTicketCategory>[1]
                            )
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">{translateTicketCategory(translate, "bug")}</SelectItem>
                      <SelectItem value="question">{translateTicketCategory(translate, "question")}</SelectItem>
                      <SelectItem value="feature_request">
                        {translateTicketCategory(translate, "feature_request")}
                      </SelectItem>
                      <SelectItem value="account">{translateTicketCategory(translate, "account")}</SelectItem>
                      <SelectItem value="billing">{translateTicketCategory(translate, "billing")}</SelectItem>
                      <SelectItem value="other">{translateTicketCategory(translate, "other")}</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="assigneeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.assignee", { ns: "starter" }, "Assignee")}</FormLabel>
              <FormControl
                render={
                  <Select
                    items={agentItems}
                    value={asOptionValue(field.value)}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={unassignedLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      {agentsResult.data.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agentDisplayName(agent, translate("tickets.assignee.unassigned", { ns: "starter" }, "Unassigned"))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="requester_name"
          rules={{ required: translate("tickets.form.validation.requesterNameRequired", { ns: "starter" }, "Requester name is required") }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.requesterName", { ns: "starter" }, "Requester name")}</FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate("tickets.form.requesterNamePlaceholder", { ns: "starter" }, "Customer name")}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requester_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.requesterEmail", { ns: "starter" }, "Requester email")}</FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    type="email"
                    placeholder={translate("tickets.form.requesterEmailPlaceholder", { ns: "starter" }, "customer@example.com")}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}

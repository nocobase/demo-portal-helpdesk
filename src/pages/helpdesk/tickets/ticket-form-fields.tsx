import { useGetLocale, useList, useTranslate } from "@refinedev/core";
import React, { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  agentDisplayName,
  asOptionValue,
  TICKET_PRIORITIES,
  type AgentRef,
  type NamedRecord,
  type RequesterRecord,
  type SlaPolicyRecord,
  type TicketRecord,
  translateTicketCategory,
  translateTicketPriority,
  translateTicketSource,
} from "../lib";
import { RequesterPicker } from "./requester-picker";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function TicketFormFields({
  form,
  excludeTicketId,
  policies,
}: {
  form: UseFormReturn<TicketFormValues>;
  excludeTicketId?: string | number;
  policies: SlaPolicyRecord[];
}) {
  const translate = useTranslate();
  const getLocale = useGetLocale();
  const locale = getLocale();
  const watchedPriority = form.watch("priority");
  const watchedRequesterId = form.watch("requester_id");
  const watchedRequesterEmail = form.watch("requester_email");
  const [debouncedRequesterEmail, setDebouncedRequesterEmail] = useState("");
  const numericExcludeTicketId =
    excludeTicketId === undefined || excludeTicketId === ""
      ? undefined
      : Number(excludeTicketId);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedRequesterEmail(watchedRequesterEmail.trim()),
      500
    );
    return () => window.clearTimeout(timeout);
  }, [watchedRequesterEmail]);

  const { result: agentsResult } = useList<AgentRef>({
    resource: "users",
    pagination: { mode: "server", currentPage: 1, pageSize: 200 },
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const { result: queuesResult } = useList<NamedRecord>({
    resource: "desk_queues",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
  });
  const { result: typesResult } = useList<NamedRecord>({
    resource: "desk_ticket_types",
    pagination: { mode: "server", currentPage: 1, pageSize: 50 },
  });
  const { result: requestersResult, query: requestersQuery } =
    useList<RequesterRecord>({
      resource: "desk_requesters",
      pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    });

  const selectedRequester = requestersResult.data.find(
    (requester) => String(requester.id) === watchedRequesterId
  );
  const emailLookupEnabled =
    EMAIL_PATTERN.test(debouncedRequesterEmail) &&
    debouncedRequesterEmail.toLowerCase() !==
      (selectedRequester?.email ?? "").toLowerCase();
  const { result: duplicateRequesterResult } = useList<RequesterRecord>({
    resource: "desk_requesters",
    filters: [
      {
        field: "email",
        operator: "eq",
        value: debouncedRequesterEmail,
      },
    ],
    pagination: { mode: "server", currentPage: 1, pageSize: 1 },
    queryOptions: { retry: false, enabled: emailLookupEnabled },
  });
  const { result: openTicketsResult } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [
      {
        field: "requester_id",
        operator: "eq",
        value: watchedRequesterId ? Number(watchedRequesterId) : undefined,
      },
      {
        field: "status",
        operator: "in",
        value: ["open", "in_progress"],
      },
      ...(typeof numericExcludeTicketId === "number" &&
      Number.isFinite(numericExcludeTicketId)
        ? [
            {
              field: "id",
              operator: "ne" as const,
              value: numericExcludeTicketId,
            },
          ]
        : []),
    ],
    sorters: [{ field: "createdAt", order: "desc" }],
    pagination: { mode: "server", currentPage: 1, pageSize: 3 },
    queryOptions: { retry: false, enabled: Boolean(watchedRequesterId) },
  });

  const duplicateRequester = emailLookupEnabled
    ? duplicateRequesterResult.data.find(
        (requester) => String(requester.id) !== watchedRequesterId
      )
    : undefined;
  const openTicketsTotal = openTicketsResult.total ?? 0;

  // Base UI resolves a Select's trigger label from `items`. Without it the
  // trigger prints the raw value while async relation options are loading.
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

  const selectRequester = (requester: RequesterRecord | null) => {
    form.setValue("requester_id", requester ? String(requester.id) : "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (requester) {
      form.setValue("requester_name", requester.name, { shouldDirty: true });
      form.setValue("requester_email", requester.email, { shouldDirty: true });
    }
  };

  const selectedPolicy = policies.find(
    (policy) => policy.priority === watchedPriority
  );
  const deadlineFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const responseDeadlinePreview = selectedPolicy
    ? deadlineFormatter.format(
        new Date(Date.now() + selectedPolicy.response_mins * 60 * 1000)
      )
    : null;
  const resolutionDeadlinePreview = selectedPolicy
    ? deadlineFormatter.format(
        new Date(Date.now() + selectedPolicy.resolve_mins * 60 * 1000)
      )
    : null;

  return (
    <div className="space-y-6">
      <FormSection
        title={translate(
          "tickets.form.sections.issue",
          { ns: "starter" },
          "Issue"
        )}
      >
        <FormField
          control={form.control}
          name="subject"
          rules={{
            required: translate(
              "tickets.form.validation.subjectRequired",
              { ns: "starter" },
              "Subject is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "tickets.fields.subject",
                  { ns: "starter" },
                  "Subject"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "tickets.form.subjectPlaceholder",
                      { ns: "starter" },
                      "Short summary of the customer's issue"
                    )}
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
          rules={{
            required: translate(
              "tickets.form.validation.descriptionRequired",
              { ns: "starter" },
              "Description is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "tickets.fields.description",
                  { ns: "starter" },
                  "Description"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder={translate(
                      "tickets.form.descriptionPlaceholder",
                      { ns: "starter" },
                      "What happened, steps to reproduce, impacted customers..."
                    )}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>

      <Separator />
      <FormSection
        title={translate(
          "tickets.form.sections.classification",
          { ns: "starter" },
          "Classification"
        )}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="queue_id"
            rules={{
              required: translate(
                "tickets.form.validation.queueRequired",
                { ns: "starter" },
                "Queue is required"
              ),
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {translate(
                    "tickets.fields.queue",
                    { ns: "starter" },
                    "Queue"
                  )}
                </FormLabel>
                <FormControl
                  render={
                    <Select
                      items={queueItems}
                      value={asOptionValue(field.value)}
                      onValueChange={(value) => field.onChange(value ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={translate(
                            "tickets.form.queuePlaceholder",
                            { ns: "starter" },
                            "Select queue"
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {queuesResult.data.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
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
          <FormField
            control={form.control}
            name="ticket_type_id"
            rules={{
              required: translate(
                "tickets.form.validation.typeRequired",
                { ns: "starter" },
                "Ticket type is required"
              ),
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {translate(
                    "tickets.fields.type",
                    { ns: "starter" },
                    "Ticket type"
                  )}
                </FormLabel>
                <FormControl
                  render={
                    <Select
                      items={typeItems}
                      value={asOptionValue(field.value)}
                      onValueChange={(value) => field.onChange(value ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={translate(
                            "tickets.form.typePlaceholder",
                            { ns: "starter" },
                            "Select ticket type"
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {typesResult.data.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
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
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {translate(
                    "tickets.fields.category",
                    { ns: "starter" },
                    "Category"
                  )}
                </FormLabel>
                <FormControl
                  render={
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => field.onChange(value ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={translate(
                            "tickets.form.categoryPlaceholder",
                            { ns: "starter" },
                            "Select category"
                          )}
                        >
                          {field.value
                            ? translateTicketCategory(
                                translate,
                                field.value as Parameters<
                                  typeof translateTicketCategory
                                >[1]
                              )
                            : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bug">
                          {translateTicketCategory(translate, "bug")}
                        </SelectItem>
                        <SelectItem value="question">
                          {translateTicketCategory(translate, "question")}
                        </SelectItem>
                        <SelectItem value="feature_request">
                          {translateTicketCategory(
                            translate,
                            "feature_request"
                          )}
                        </SelectItem>
                        <SelectItem value="account">
                          {translateTicketCategory(translate, "account")}
                        </SelectItem>
                        <SelectItem value="billing">
                          {translateTicketCategory(translate, "billing")}
                        </SelectItem>
                        <SelectItem value="other">
                          {translateTicketCategory(translate, "other")}
                        </SelectItem>
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
            name="priority"
            rules={{
              required: translate(
                "tickets.form.validation.priorityRequired",
                { ns: "starter" },
                "Priority is required"
              ),
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {translate(
                    "tickets.fields.priority",
                    { ns: "starter" },
                    "Priority"
                  )}
                </FormLabel>
                <FormControl
                  render={
                    <Select
                      value={field.value}
                      onValueChange={(value) => field.onChange(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={translate(
                            "tickets.form.priorityPlaceholder",
                            { ns: "starter" },
                            "Select priority"
                          )}
                        >
                          {field.value
                            ? translateTicketPriority(
                                translate,
                                field.value as Parameters<
                                  typeof translateTicketPriority
                                >[1]
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
                  {selectedPolicy ? (
                    <span className="block space-y-1">
                      <span className="block">
                        {translate(
                          "tickets.form.responseTargetPreview",
                          {
                            ns: "starter",
                            minutes: selectedPolicy.response_mins,
                            deadline: responseDeadlinePreview,
                          },
                          "First response: {{minutes}} min (by {{deadline}})"
                        )}
                      </span>
                      <span className="block">
                        {translate(
                          "tickets.form.resolutionTargetPreview",
                          {
                            ns: "starter",
                            minutes: selectedPolicy.resolve_mins,
                            deadline: resolutionDeadlinePreview,
                          },
                          "Resolution: {{minutes}} min (by {{deadline}})"
                        )}
                      </span>
                    </span>
                  ) : (
                    translate(
                      "tickets.form.noMatchingPolicy",
                      { ns: "starter" },
                      "No SLA policy matches this priority. No response or resolution deadline will be set."
                    )
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="source"
          rules={{
            required: translate(
              "tickets.form.validation.sourceRequired",
              { ns: "starter" },
              "Source is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "tickets.fields.source",
                  { ns: "starter" },
                  "Source"
                )}
              </FormLabel>
              <FormControl
                render={
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={translate(
                          "tickets.form.sourcePlaceholder",
                          { ns: "starter" },
                          "Select source"
                        )}
                      >
                        {field.value
                          ? translateTicketSource(
                              translate,
                              field.value as Parameters<
                                typeof translateTicketSource
                              >[1]
                            )
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        {translateTicketSource(translate, "email")}
                      </SelectItem>
                      <SelectItem value="web">
                        {translateTicketSource(translate, "web")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>

      <Separator />
      <FormSection
        title={translate(
          "tickets.form.sections.requester",
          { ns: "starter" },
          "Requester"
        )}
      >
        <FormField
          control={form.control}
          name="requester_id"
          rules={{
            required: translate(
              "tickets.form.validation.requesterProfileRequired",
              { ns: "starter" },
              "Requester profile is required"
            ),
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "tickets.fields.requesterProfile",
                  { ns: "starter" },
                  "Requester profile"
                )}
              </FormLabel>
              <FormControl
                render={
                  <RequesterPicker
                    value={field.value ?? ""}
                    onSelect={selectRequester}
                    requesters={requestersResult.data}
                    onCreated={() => {
                      void requestersQuery.refetch();
                    }}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="requester_name"
            rules={{
              required: translate(
                "tickets.form.validation.requesterNameRequired",
                { ns: "starter" },
                "Requester name is required"
              ),
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {translate(
                    "tickets.fields.requesterName",
                    { ns: "starter" },
                    "Requester name"
                  )}
                </FormLabel>
                <FormControl
                  render={
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder={translate(
                        "tickets.form.requesterNamePlaceholder",
                        { ns: "starter" },
                        "Customer name"
                      )}
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
            rules={{
              pattern: {
                value: EMAIL_PATTERN,
                message: translate(
                  "tickets.form.validation.emailInvalid",
                  { ns: "starter" },
                  "Enter a valid email address"
                ),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {translate(
                    "tickets.fields.requesterEmail",
                    { ns: "starter" },
                    "Requester email"
                  )}
                </FormLabel>
                <FormControl
                  render={
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="email"
                      placeholder={translate(
                        "tickets.form.requesterEmailPlaceholder",
                        { ns: "starter" },
                        "customer@example.com"
                      )}
                    />
                  }
                />
                <FormMessage />
                {duplicateRequester ? (
                  <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                    {translate(
                      "tickets.form.duplicateEmail",
                      {
                        ns: "starter",
                        name: duplicateRequester.name,
                        company: duplicateRequester.company,
                      },
                      "A requester profile already exists for this email: {{name}} · {{company}}"
                    )}{" "}
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-auto p-0 text-current"
                      onClick={() => selectRequester(duplicateRequester)}
                    >
                      {translate(
                        "tickets.form.useRequesterProfile",
                        { ns: "starter" },
                        "Use this profile"
                      )}
                    </Button>
                  </p>
                ) : null}
              </FormItem>
            )}
          />
        </div>

        {openTicketsTotal > 0 ? (
          <p className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="block">
              {translate(
                "tickets.form.openTicketsWarning",
                { ns: "starter", count: openTicketsTotal },
                `${openTicketsTotal} open ${openTicketsTotal === 1 ? "ticket already exists" : "tickets already exist"} for this requester`
              )}
            </span>
            {openTicketsResult.data
              .filter(
                (ticket) =>
                  excludeTicketId === undefined ||
                  String(ticket.id) !== String(excludeTicketId)
              )
              .map((ticket) => (
                <span key={ticket.id} className="mt-1 block">
                  {ticket.subject}
                </span>
              ))}
          </p>
        ) : null}
      </FormSection>

      <Separator />
      <FormSection
        title={translate(
          "tickets.form.sections.assignment",
          { ns: "starter" },
          "Assignment"
        )}
      >
        <FormField
          control={form.control}
          name="assigneeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {translate(
                  "tickets.fields.assignee",
                  { ns: "starter" },
                  "Assignee"
                )}
              </FormLabel>
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
                          {agentDisplayName(agent, unassignedLabel)}
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
      </FormSection>
    </div>
  );
}

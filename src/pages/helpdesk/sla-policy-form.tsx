import { useTranslate, type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useParams } from "react-router";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { TICKET_PRIORITIES, translateTicketPriority, type SlaPolicyRecord } from "./lib";
import { useContextualCloseTo } from "./route-surfaces";

type SlaPolicyFormValues = { name: string; priority: string; response_mins: string; resolve_mins: string };

function SlaPolicyFields({ form }: { form: UseFormReturn<SlaPolicyFormValues> }) {
  const translate = useTranslate();
  const priority = form.watch("priority");
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        rules={{ required: translate("slaPolicies.form.validation.nameRequired", { ns: "starter" }, "Policy name is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("slaPolicies.fields.name", { ns: "starter" }, "Policy name")}</FormLabel>
            <FormControl render={<Input {...field} value={field.value ?? ""} placeholder={translate("slaPolicies.form.namePlaceholder", { ns: "starter" }, "e.g. Standard")} />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="priority"
        rules={{ required: translate("slaPolicies.form.validation.priorityRequired", { ns: "starter" }, "Priority is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("tickets.fields.priority", { ns: "starter" }, "Priority")}</FormLabel>
            <FormControl
              render={
                <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={translate("tickets.form.priorityPlaceholder", { ns: "starter" }, "Select priority")}>
                      {priority ? translateTicketPriority(translate, priority as Parameters<typeof translateTicketPriority>[1]) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((item) => (
                      <SelectItem key={item} value={item}>{translateTicketPriority(translate, item)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="response_mins"
          rules={{ required: translate("slaPolicies.form.validation.responseRequired", { ns: "starter" }, "First response target is required") }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("slaPolicies.fields.responseMins", { ns: "starter" }, "First response (minutes)")}</FormLabel>
              <FormControl render={<Input {...field} value={field.value ?? ""} type="number" min={1} />} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="resolve_mins"
          rules={{ required: translate("slaPolicies.form.validation.resolveRequired", { ns: "starter" }, "Resolution target is required") }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("slaPolicies.fields.resolveMins", { ns: "starter" }, "Resolution (minutes)")}</FormLabel>
              <FormControl render={<Input {...field} value={field.value ?? ""} type="number" min={1} />} />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}

const toPayload = (values: SlaPolicyFormValues) => ({
  name: values.name,
  priority: values.priority,
  response_mins: Number(values.response_mins),
  resolve_mins: Number(values.resolve_mins),
});

export function SlaPolicyCreate() {
  const translate = useTranslate();
  const closeTo = useContextualCloseTo();
  const close = useRouteSurfaceClose();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();
  const { refineCore: { onFinish }, ...form } = useForm<SlaPolicyRecord, HttpError, SlaPolicyFormValues>({
    refineCoreProps: {
      resource: "desk_sla_policies",
      action: "create",
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { name: "", priority: "medium", response_mins: "60", resolve_mins: "480" },
  });

  return (
    <>
      <RouteDrawer
        title={translate("slaPolicies.actions.new", { ns: "starter" }, "New SLA policy")}
        description={translate("slaPolicies.form.createDescription", { ns: "starter" }, "Define first-response and resolution targets for a priority tier.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => onFinish(toPayload(values) as unknown as SlaPolicyFormValues))} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
              <SlaPolicyFields form={form} />
            </div>
            <RouteDrawerFooter className="flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{translate("slaPolicies.actions.create", { ns: "starter" }, "Create policy")}</Button>
            </RouteDrawerFooter>
          </form>
        </Form>
      </RouteDrawer>
      {confirmation}
    </>
  );
}

export function SlaPolicyEdit({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const policyId = params[idParam];
  const closeTo = useContextualCloseTo();
  const close = useRouteSurfaceClose();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();
  const { refineCore: { onFinish, query }, ...form } = useForm<SlaPolicyRecord, HttpError, SlaPolicyFormValues>({
    refineCoreProps: {
      resource: "desk_sla_policies",
      action: "edit",
      id: policyId,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { name: "", priority: "medium", response_mins: "60", resolve_mins: "480" },
  });
  const record = query?.data?.data;

  useEffect(() => {
    if (!record) return;
    form.reset({
      name: record.name ?? "",
      priority: record.priority ?? "medium",
      response_mins: String(record.response_mins ?? ""),
      resolve_mins: String(record.resolve_mins ?? ""),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  return (
    <>
      <RouteDrawer
        title={translate("slaPolicies.actions.edit", { ns: "starter" }, "Edit SLA policy")}
        description={translate("slaPolicies.form.editDescription", { ns: "starter" }, "Adjust the first-response and resolution targets.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        {query?.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => onFinish(toPayload(values) as unknown as SlaPolicyFormValues))} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
                <SlaPolicyFields form={form} />
              </div>
              <RouteDrawerFooter className="flex-row justify-end">
                <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>{translate("tickets.actions.save", { ns: "starter" }, "Save changes")}</Button>
              </RouteDrawerFooter>
            </form>
          </Form>
        )}
      </RouteDrawer>
      {confirmation}
    </>
  );
}

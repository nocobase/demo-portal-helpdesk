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
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import type { NamedRecord } from "../lib";
import { useContextualCloseTo } from "../route-surfaces";

type TicketTypeFormValues = { name: string };

function TicketTypeFields({ form }: { form: UseFormReturn<TicketTypeFormValues> }) {
  const translate = useTranslate();
  return (
    <FormField
      control={form.control}
      name="name"
      rules={{ required: translate("ticketTypes.form.validation.nameRequired", { ns: "starter" }, "Ticket type name is required") }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{translate("ticketTypes.fields.name", { ns: "starter" }, "Ticket type")}</FormLabel>
          <FormControl render={<Input {...field} value={field.value ?? ""} placeholder={translate("ticketTypes.form.namePlaceholder", { ns: "starter" }, "e.g. Incident")} />} />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TicketTypeCreate() {
  const translate = useTranslate();
  const closeTo = useContextualCloseTo();
  const close = useRouteSurfaceClose();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();
  const { refineCore: { onFinish }, ...form } = useForm<NamedRecord, HttpError, TicketTypeFormValues>({
    refineCoreProps: {
      resource: "desk_ticket_types",
      action: "create",
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { name: "" },
  });

  return (
    <>
      <RouteDrawer
        title={translate("ticketTypes.actions.new", { ns: "starter" }, "New ticket type")}
        description={translate("ticketTypes.form.createDescription", { ns: "starter" }, "Add a category tickets can be classified under.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => onFinish(values))} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10">
              <TicketTypeFields form={form} />
            </div>
            <RouteDrawerFooter className="flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{translate("ticketTypes.actions.create", { ns: "starter" }, "Create ticket type")}</Button>
            </RouteDrawerFooter>
          </form>
        </Form>
      </RouteDrawer>
      {confirmation}
    </>
  );
}

export function TicketTypeEdit({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const typeId = params[idParam];
  const closeTo = useContextualCloseTo();
  const close = useRouteSurfaceClose();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();
  const { refineCore: { onFinish, query }, ...form } = useForm<NamedRecord, HttpError, TicketTypeFormValues>({
    refineCoreProps: {
      resource: "desk_ticket_types",
      action: "edit",
      id: typeId,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { name: "" },
  });
  const record = query?.data?.data;

  useEffect(() => {
    if (!record) return;
    form.reset({ name: record.name ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  return (
    <>
      <RouteDrawer
        title={translate("ticketTypes.actions.edit", { ns: "starter" }, "Edit ticket type")}
        description={translate("ticketTypes.form.editDescription", { ns: "starter" }, "Rename this ticket type. Existing ticket classification is unaffected.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        {query?.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => onFinish(values))} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10">
                <TicketTypeFields form={form} />
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

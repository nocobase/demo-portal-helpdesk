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
import type { RequesterRecord } from "./lib";
import { useContextualCloseTo } from "./route-surfaces";

type RequesterFormValues = { name: string; company: string; email: string };

function RequesterFields({ form }: { form: UseFormReturn<RequesterFormValues> }) {
  const translate = useTranslate();
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        rules={{ required: translate("requesters.form.validation.nameRequired", { ns: "starter" }, "Requester name is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("requesters.fields.name", { ns: "starter" }, "Requester")}</FormLabel>
            <FormControl render={<Input {...field} value={field.value ?? ""} placeholder={translate("requesters.form.namePlaceholder", { ns: "starter" }, "Customer name")} />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="company"
        rules={{ required: translate("requesters.form.validation.companyRequired", { ns: "starter" }, "Company is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("requesters.fields.company", { ns: "starter" }, "Company")}</FormLabel>
            <FormControl render={<Input {...field} value={field.value ?? ""} placeholder={translate("requesters.form.companyPlaceholder", { ns: "starter" }, "Customer's company")} />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="email"
        rules={{ required: translate("requesters.form.validation.emailRequired", { ns: "starter" }, "Email is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("requesters.fields.email", { ns: "starter" }, "Email")}</FormLabel>
            <FormControl render={<Input {...field} value={field.value ?? ""} type="email" placeholder={translate("tickets.form.requesterEmailPlaceholder", { ns: "starter" }, "customer@example.com")} />} />
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function RequesterCreate() {
  const translate = useTranslate();
  const closeTo = useContextualCloseTo();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate("requesters.actions.new", { ns: "starter" }, "New requester")}
        description={translate("requesters.form.createDescription", { ns: "starter" }, "Add a customer profile that tickets can be linked to.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <RequesterCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function RequesterCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const { refineCore: { onFinish }, ...form } = useForm<RequesterRecord, HttpError, RequesterFormValues>({
    refineCoreProps: {
      resource: "desk_requesters",
      action: "create",
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { name: "", company: "", email: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onFinish(values))} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10">
          <RequesterFields form={form} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>{translate("requesters.actions.create", { ns: "starter" }, "Create requester")}</Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}

export function RequesterEdit({ idParam = "id" }: { idParam?: string }) {
  const translate = useTranslate();
  const params = useParams();
  const requesterId = params[idParam];
  const closeTo = useContextualCloseTo();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate("requesters.actions.edit", { ns: "starter" }, "Edit requester")}
        description={translate("requesters.form.editDescription", { ns: "starter" }, "Update this customer's profile details.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <RequesterEditForm requesterId={requesterId} />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function RequesterEditForm({ requesterId }: { requesterId?: string }) {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const { refineCore: { onFinish, query }, ...form } = useForm<RequesterRecord, HttpError, RequesterFormValues>({
    refineCoreProps: {
      resource: "desk_requesters",
      action: "edit",
      id: requesterId,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { name: "", company: "", email: "" },
  });
  const record = query?.data?.data;

  useEffect(() => {
    if (!record) return;
    form.reset({ name: record.name ?? "", company: record.company ?? "", email: record.email ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  if (query?.isLoading) {
    return <LoadingState className="min-h-64" />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onFinish(values))} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10">
          <RequesterFields form={form} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>{translate("tickets.actions.save", { ns: "starter" }, "Save changes")}</Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}

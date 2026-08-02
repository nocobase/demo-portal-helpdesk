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
import { Textarea } from "@/components/ui/textarea";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import { TICKET_CATEGORIES, translateTicketCategory, type MacroRecord } from "./lib";
import { useContextualCloseTo } from "./route-surfaces";

type MacroFormValues = { title: string; category: string; body: string };

function MacroFields({ form }: { form: UseFormReturn<MacroFormValues> }) {
  const translate = useTranslate();
  const category = form.watch("category");
  return (
    <>
      <FormField
        control={form.control}
        name="title"
        rules={{ required: translate("macros.form.validation.titleRequired", { ns: "starter" }, "Macro title is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("macros.fields.title", { ns: "starter" }, "Title")}</FormLabel>
            <FormControl render={<Input {...field} value={field.value ?? ""} placeholder={translate("macros.form.titlePlaceholder", { ns: "starter" }, "e.g. Refund confirmation")} />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="category"
        rules={{ required: translate("macros.form.validation.categoryRequired", { ns: "starter" }, "Category is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("tickets.fields.category", { ns: "starter" }, "Category")}</FormLabel>
            <FormControl
              render={
                <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={translate("tickets.form.categoryPlaceholder", { ns: "starter" }, "Select category")}>
                      {category ? translateTicketCategory(translate, category as Parameters<typeof translateTicketCategory>[1]) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>{translateTicketCategory(translate, item)}</SelectItem>
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
        name="body"
        rules={{ required: translate("macros.form.validation.bodyRequired", { ns: "starter" }, "Macro body is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("macros.fields.body", { ns: "starter" }, "Body")}</FormLabel>
            <FormControl render={<Textarea {...field} value={field.value ?? ""} className="min-h-32" placeholder={translate("macros.form.bodyPlaceholder", { ns: "starter" }, "Text inserted into the reply composer")} />} />
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function MacroCreate() {
  const translate = useTranslate();
  const closeTo = useContextualCloseTo();
  const close = useRouteSurfaceClose();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();
  const { refineCore: { onFinish }, ...form } = useForm<MacroRecord, HttpError, MacroFormValues>({
    refineCoreProps: {
      resource: "desk_macros",
      action: "create",
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { title: "", category: "other", body: "" },
  });

  return (
    <>
      <RouteDrawer
        title={translate("macros.actions.new", { ns: "starter" }, "New macro")}
        description={translate("macros.form.createDescription", { ns: "starter" }, "Add a reusable reply agents can insert while working a ticket.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => onFinish(values))} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
              <MacroFields form={form} />
            </div>
            <RouteDrawerFooter className="flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{translate("macros.actions.create", { ns: "starter" }, "Create macro")}</Button>
            </RouteDrawerFooter>
          </form>
        </Form>
      </RouteDrawer>
      {confirmation}
    </>
  );
}

export function MacroEdit() {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const closeTo = useContextualCloseTo();
  const close = useRouteSurfaceClose();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();
  const { refineCore: { onFinish, query }, ...form } = useForm<MacroRecord, HttpError, MacroFormValues>({
    refineCoreProps: {
      resource: "desk_macros",
      action: "edit",
      id,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { title: "", category: "other", body: "" },
  });
  const record = query?.data?.data;

  useEffect(() => {
    if (!record) return;
    form.reset({ title: record.title ?? "", category: record.category ?? "other", body: record.body ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  return (
    <>
      <RouteDrawer
        title={translate("macros.actions.edit", { ns: "starter" }, "Edit macro")}
        description={translate("macros.form.editDescription", { ns: "starter" }, "Update this reply snippet.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        {query?.isLoading ? (
          <LoadingState className="min-h-64" />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => onFinish(values))} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
                <MacroFields form={form} />
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

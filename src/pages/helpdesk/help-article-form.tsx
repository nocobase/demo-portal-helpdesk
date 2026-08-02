import { useList, useTranslate, type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useParams } from "react-router";
import { useRouteSurfaceClose } from "@nocobase/portal-sdk/routing";

import { LoadingState } from "@/components/app-shell/loading-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RouteDrawer,
  RouteDrawerFooter,
  useRefineUnsavedChangesGuard,
} from "@/extensions/nocobase-route-surfaces";
import {
  asOptionValue, TICKET_CATEGORIES, translateTicketCategory, type HelpArticleRecord, type NamedRecord } from "./lib";
import { useContextualCloseTo } from "./route-surfaces";

type HelpArticleFormValues = {
  title: string;
  summary: string;
  body: string;
  category: string;
  article_category_id: string;
  published: boolean;
};

function HelpArticleFields({ form }: { form: UseFormReturn<HelpArticleFormValues> }) {
  const translate = useTranslate();
  const category = form.watch("category");
  const { result: categoriesResult } = useList<NamedRecord>({ resource: "desk_article_categories", pagination: { mode: "server", currentPage: 1, pageSize: 100 }, sorters: [{ field: "name", order: "asc" }] });
  // Base UI resolves the trigger label from `items`; see asOptionValue for why
  // the selected value has to be normalised to a string first.
  const categoryItems = useMemo(
    () =>
      categoriesResult.data.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [categoriesResult.data]
  );
  return (
    <>
      <FormField
        control={form.control}
        name="title"
        rules={{ required: translate("helpLibrary.form.validation.titleRequired", { ns: "starter" }, "Title is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("helpLibrary.fields.title", { ns: "starter" }, "Title")}</FormLabel>
            <FormControl render={<Input {...field} value={field.value ?? ""} />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="summary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("helpLibrary.fields.summary", { ns: "starter" }, "Summary")}</FormLabel>
            <FormControl render={<Textarea {...field} value={field.value ?? ""} className="min-h-16" />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="body"
        rules={{ required: translate("helpLibrary.form.validation.bodyRequired", { ns: "starter" }, "Body is required") }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{translate("helpLibrary.fields.body", { ns: "starter" }, "Body")}</FormLabel>
            <FormControl render={<Textarea {...field} value={field.value ?? ""} className="min-h-40" />} />
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("tickets.fields.category", { ns: "starter" }, "Category")}</FormLabel>
              <FormControl
                render={
                  <Select value={field.value || ""} onValueChange={(value) => field.onChange(value ?? "")}>
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
          name="article_category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{translate("helpLibrary.fields.articleCategory", { ns: "starter" }, "Library category")}</FormLabel>
              <FormControl
                render={
                  <Select items={categoryItems} value={asOptionValue(field.value)} onValueChange={(value) => field.onChange(value ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={translate("helpLibrary.form.categoryPlaceholder", { ns: "starter" }, "Select a library category")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesResult.data.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
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
      <FormField
        control={form.control}
        name="published"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-2 space-y-0">
            <FormControl render={<Checkbox checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(checked === true)} />} />
            <FormLabel className="font-normal">{translate("helpLibrary.fields.published", { ns: "starter" }, "Published to the help library")}</FormLabel>
          </FormItem>
        )}
      />
    </>
  );
}

const toPayload = (values: HelpArticleFormValues) => ({
  title: values.title,
  summary: values.summary || null,
  body: values.body,
  category: values.category || null,
  article_category_id: values.article_category_id ? Number(values.article_category_id) : null,
  published: values.published,
});

export function HelpArticleCreate() {
  const translate = useTranslate();
  const closeTo = useContextualCloseTo();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate("helpLibrary.actions.new", { ns: "starter" }, "New article")}
        description={translate("helpLibrary.form.createDescription", { ns: "starter" }, "Publish reusable support guidance for the team.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <HelpArticleCreateForm />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function HelpArticleCreateForm() {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const { refineCore: { onFinish }, ...form } = useForm<HelpArticleRecord, HttpError, HelpArticleFormValues>({
    refineCoreProps: {
      resource: "desk_help_articles",
      action: "create",
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { title: "", summary: "", body: "", category: "other", article_category_id: "", published: true },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onFinish(toPayload(values) as unknown as HelpArticleFormValues))} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
          <HelpArticleFields form={form} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>{translate("helpLibrary.actions.create", { ns: "starter" }, "Create article")}</Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}

export function HelpArticleEdit() {
  const translate = useTranslate();
  const { id } = useParams<{ id: string }>();
  const closeTo = useContextualCloseTo();
  const { beforeClose, confirmation } = useRefineUnsavedChangesGuard();

  return (
    <>
      <RouteDrawer
        title={translate("helpLibrary.actions.edit", { ns: "starter" }, "Edit article")}
        description={translate("helpLibrary.form.editDescription", { ns: "starter" }, "Update this support guidance article.")}
        closeLabel={translate("buttons.close", { ns: "starter" }, "Close")}
        closeTo={closeTo}
        beforeClose={beforeClose}
      >
        <HelpArticleEditForm articleId={id} />
      </RouteDrawer>
      {confirmation}
    </>
  );
}

function HelpArticleEditForm({ articleId }: { articleId?: string }) {
  const translate = useTranslate();
  const close = useRouteSurfaceClose();
  const { refineCore: { onFinish, query }, ...form } = useForm<HelpArticleRecord, HttpError, HelpArticleFormValues>({
    refineCoreProps: {
      resource: "desk_help_articles",
      action: "edit",
      id: articleId,
      redirect: false,
      onMutationSuccess: () => close({ skipBeforeClose: true }),
    },
    defaultValues: { title: "", summary: "", body: "", category: "other", article_category_id: "", published: true },
  });
  const record = query?.data?.data;

  useEffect(() => {
    if (!record) return;
    form.reset({
      title: record.title ?? "",
      summary: record.summary ?? "",
      body: record.body ?? "",
      category: record.category ?? "other",
      article_category_id: record.article_category_id != null ? String(record.article_category_id) : "",
      published: Boolean(record.published),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  if (query?.isLoading) {
    return <LoadingState className="min-h-64" />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onFinish(toPayload(values) as unknown as HelpArticleFormValues))} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 [&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10">
          <HelpArticleFields form={form} />
        </div>
        <RouteDrawerFooter className="flex-row justify-end">
          <Button type="button" variant="outline" onClick={() => close()}>{translate("buttons.cancel", { ns: "starter" }, "Cancel")}</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>{translate("tickets.actions.save", { ns: "starter" }, "Save changes")}</Button>
        </RouteDrawerFooter>
      </form>
    </Form>
  );
}

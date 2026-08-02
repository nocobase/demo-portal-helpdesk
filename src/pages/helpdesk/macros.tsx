import { useList, useTranslate } from "@refinedev/core";
import { Pencil, Plus, Search, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsHeader } from "./analytics-ui";
import { CategoryBadge } from "./badges";
import type { MacroRecord } from "./lib";
import { useOpenContextualChild } from "./route-surfaces";

export function MacrosPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const [search, setSearch] = useState("");
  const { result, query } = useList<MacroRecord>({ resource: "desk_macros", pagination: { mode: "server", currentPage: 1, pageSize: 100 }, sorters: [{ field: "title", order: "asc" }] });
  const macros = useMemo(() => result.data.filter((macro) => `${macro.title} ${macro.body}`.toLowerCase().includes(search.toLowerCase())), [result.data, search]);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("macros.title", { ns: "starter" }, "Reply macros")}
        description={translate("macros.description", { ns: "starter" }, "Reusable reply snippets agents can insert into ticket conversations.")}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate("macros.search", { ns: "starter" }, "Search macros")} />
            </div>
            <Button type="button" size="sm" onClick={() => openChild("create")}>
              <Plus />
              {translate("macros.actions.new", { ns: "starter" }, "New macro")}
            </Button>
          </div>
        }
      />
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)}</div>
      ) : macros.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{translate("macros.empty", { ns: "starter" }, "No macros match this search.")}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {macros.map((macro) => (
            <article key={macro.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wand2 className="size-4" /></span>
                <div className="flex items-center gap-1.5">
                  <CategoryBadge category={macro.category} />
                  <Button type="button" variant="ghost" size="icon" aria-label={translate("buttons.edit", { ns: "starter" }, "Edit")} title={translate("buttons.edit", { ns: "starter" }, "Edit")} onClick={() => openChild(`edit/${macro.id}`)}><Pencil /></Button>
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold leading-6">{macro.title}</h3>
              <p className="mt-2 line-clamp-4 flex-1 text-sm leading-6 text-muted-foreground">{macro.body}</p>
            </article>
          ))}
        </div>
      )}
      <Outlet />
    </div>
  );
}

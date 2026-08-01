import { useList, useTranslate } from "@refinedev/core";
import { BookOpenText, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "./badges";
import { type HelpArticleRecord } from "./lib";

export function HelpArticlesPage() {
  const translate = useTranslate();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const { result, query: articlesQuery } = useList<HelpArticleRecord>({
    resource: "desk_help_articles",
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "updatedAt", order: "desc" }],
    queryOptions: { retry: false },
  });
  const articles = result.data.filter((article) =>
    !deferredQuery ||
    `${article.title} ${article.summary ?? ""} ${article.body}`.toLowerCase().includes(deferredQuery)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center text-muted-foreground"><Breadcrumb /></div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{translate("helpLibrary.eyebrow", { ns: "starter" }, "Reply with confidence")}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{translate("navigation.helpLibrary", { ns: "starter" }, "Help library")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{translate("helpLibrary.intro", { ns: "starter" }, "Practical answer starters the team can use before sending a reply.")}</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder={translate("helpLibrary.searchPlaceholder", { ns: "starter" }, "Search articles")} />
          </label>
        </div>
      </div>
      {articlesQuery.isLoading ? <p className="text-sm text-muted-foreground">{translate("helpLibrary.loading", { ns: "starter" }, "Loading articles...")}</p> : articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">{translate("helpLibrary.empty", { ns: "starter" }, "No matching articles yet.")}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <article key={article.id} className="help-article-card rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpenText className="size-4" /></span>
                <CategoryBadge category={article.category} />
              </div>
              <h3 className="mt-5 text-base font-semibold leading-6">{article.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{article.summary}</p>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-foreground/80">{article.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

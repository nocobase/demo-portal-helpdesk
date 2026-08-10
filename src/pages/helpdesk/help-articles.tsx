import { useList, useTranslate, useUpdate } from "@refinedev/core";
import {
  BookOpenText,
  Link2,
  Pencil,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Outlet, useSearchParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AnalyticsHeader } from "./analytics-ui";
import { CategoryBadge } from "./badges";
import type { HelpArticleRecord, NamedRecord } from "./lib";
import { useOpenContextualChild } from "./route-surfaces";

type ArticleCategory = NamedRecord & { parentId?: number | null };
type PublishFilter = "all" | "published" | "draft";
type ArticleSort = "updated" | "helpful";

const helpfulScore = (article: HelpArticleRecord) =>
  Number(article.helpful_yes ?? 0) - Number(article.helpful_no ?? 0);

export function HelpArticlesPage() {
  const translate = useTranslate();
  const openChild = useOpenContextualChild();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");
  const [sort, setSort] = useState<ArticleSort>("updated");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const update = useUpdate();

  // Replies written in the ticket drawer link back here with `?article=<id>`,
  // so following that link has to land on the article itself rather than the
  // top of an unfiltered library.
  const linkedArticleId = Number(searchParams.get("article")) || null;

  const { result, query: articlesQuery } = useList<HelpArticleRecord>({
    resource: "desk_help_articles",
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "updatedAt", order: "desc" }],
    meta: { appends: ["article_category"] },
    queryOptions: { retry: false },
  });
  const { result: categories } = useList<ArticleCategory>({
    resource: "desk_article_categories",
    pagination: { mode: "server", currentPage: 1, pageSize: 100 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const linkedArticle = linkedArticleId
    ? result.data.find((article) => article.id === linkedArticleId)
    : undefined;

  const articles = result.data
    .filter(
      (article) =>
        (!categoryId || article.article_category_id === categoryId) &&
        (publishFilter === "all" ||
          (publishFilter === "published" ? article.published : !article.published)) &&
        (!deferredQuery ||
          `${article.title} ${article.summary ?? ""} ${article.body}`
            .toLowerCase()
            .includes(deferredQuery))
    )
    .sort((a, b) => {
      if (linkedArticleId) {
        if (a.id === linkedArticleId) return -1;
        if (b.id === linkedArticleId) return 1;
      }
      return sort === "helpful"
        ? helpfulScore(b) - helpfulScore(a)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const vote = (article: HelpArticleRecord, helpful: boolean) =>
    update.mutate(
      {
        resource: "desk_help_articles",
        id: article.id,
        values: {
          [helpful ? "helpful_yes" : "helpful_no"]:
            Number(helpful ? article.helpful_yes : article.helpful_no) + 1,
        },
      },
      { onSuccess: () => articlesQuery.refetch() }
    );

  const clearLinked = () =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("article");
        return next;
      },
      { replace: true }
    );

  const roots = categories.data.filter((item) => !item.parentId);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsHeader
        title={translate("navigation.helpLibrary", { ns: "starter" }, "Help library")}
        description={translate(
          "helpLibrary.intro",
          { ns: "starter" },
          "Search structured support guidance, browse categories, and use article feedback to improve answer quality."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder={translate(
                  "helpLibrary.searchPlaceholder",
                  { ns: "starter" },
                  "Search titles and article content"
                )}
              />
            </label>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as ArticleSort)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">
                  {translate(
                    "helpLibrary.sort.updated",
                    { ns: "starter" },
                    "Recently updated"
                  )}
                </SelectItem>
                <SelectItem value="helpful">
                  {translate(
                    "helpLibrary.sort.helpful",
                    { ns: "starter" },
                    "Most helpful"
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" onClick={() => openChild("create")}>
              <Plus />
              {translate("helpLibrary.actions.new", { ns: "starter" }, "New article")}
            </Button>
          </div>
        }
      />

      {linkedArticle ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <Link2 className="size-4 text-primary" />
            {translate(
              "helpLibrary.linkedFromTicket",
              { ns: "starter", title: linkedArticle.title },
              "Opened from a ticket reply: {{title}}"
            )}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={clearLinked}>
            <X />
            {translate("helpLibrary.clearLinked", { ns: "starter" }, "Show everything")}
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_1fr]">
        <aside className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
          <div>
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translate("helpLibrary.categories", { ns: "starter" }, "Categories")}
            </p>
            <Button
              type="button"
              variant={categoryId === null ? "secondary" : "ghost"}
              className="w-full justify-between"
              onClick={() => setCategoryId(null)}
            >
              <span>
                {translate("helpLibrary.allArticles", { ns: "starter" }, "All articles")}
              </span>
              <Badge variant="outline">{result.data.length}</Badge>
            </Button>
            <div className="mt-2 space-y-3">
              {roots.map((root) => (
                <div key={root.id}>
                  <p className="px-2 py-1 text-xs font-semibold">{root.name}</p>
                  <div className="space-y-0.5">
                    {categories.data
                      .filter((item) => item.parentId === root.id)
                      .map((child) => {
                        const count = result.data.filter(
                          (article) => article.article_category_id === child.id
                        ).length;
                        return (
                          <Button
                            key={child.id}
                            type="button"
                            variant={categoryId === child.id ? "secondary" : "ghost"}
                            className="h-8 w-full justify-between text-xs font-normal"
                            onClick={() => setCategoryId(child.id)}
                          >
                            <span className="truncate">{child.name}</span>
                            <span className="text-muted-foreground">{count}</span>
                          </Button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {translate("helpLibrary.state", { ns: "starter" }, "State")}
            </p>
            {(["all", "published", "draft"] as PublishFilter[]).map((value) => (
              <Button
                key={value}
                type="button"
                variant={publishFilter === value ? "secondary" : "ghost"}
                className="h-8 w-full justify-between text-xs font-normal"
                onClick={() => setPublishFilter(value)}
              >
                <span>
                  {translate(
                    `helpLibrary.state.${value}`,
                    { ns: "starter" },
                    value === "all"
                      ? "All"
                      : value === "published"
                        ? "Published"
                        : "Draft"
                  )}
                </span>
                <span className="text-muted-foreground">
                  {value === "all"
                    ? result.data.length
                    : result.data.filter((article) =>
                        value === "published" ? article.published : !article.published
                      ).length}
                </span>
              </Button>
            ))}
          </div>
        </aside>

        <main>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {translate(
                "helpLibrary.resultCount",
                { ns: "starter", count: articles.length },
                "{{count}} matching articles"
              )}
            </p>
            {categoryId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCategoryId(null)}
              >
                {translate(
                  "helpLibrary.clearCategory",
                  { ns: "starter" },
                  "Clear category"
                )}
              </Button>
            ) : null}
          </div>
          {articlesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              {translate("helpLibrary.loading", { ns: "starter" }, "Loading articles...")}
            </p>
          ) : articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
              {translate("helpLibrary.empty", { ns: "starter" }, "No matching articles yet.")}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className={cn(
                    "group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
                    article.id === linkedArticleId && "border-primary/40 ring-2 ring-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BookOpenText className="size-4" />
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {article.published ? null : (
                        <Badge variant="outline" className="border-dashed">
                          {translate(
                            "helpLibrary.state.draft",
                            { ns: "starter" },
                            "Draft"
                          )}
                        </Badge>
                      )}
                      {article.article_category ? (
                        <Badge variant="secondary">{article.article_category.name}</Badge>
                      ) : null}
                      <CategoryBadge category={article.category} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={translate("buttons.edit", { ns: "starter" }, "Edit")}
                        title={translate("buttons.edit", { ns: "starter" }, "Edit")}
                        onClick={() => openChild(`edit/${article.id}`)}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-semibold leading-6">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {article.summary}
                  </p>
                  <p className="mt-4 line-clamp-4 flex-1 text-sm leading-6 text-foreground/80">
                    {article.body}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      {translate(
                        "helpLibrary.helpfulPrompt",
                        { ns: "starter" },
                        "Was this helpful?"
                      )}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 gap-1.5",
                          helpfulScore(article) > 0 &&
                            "text-emerald-600 dark:text-emerald-400"
                        )}
                        onClick={() => vote(article, true)}
                      >
                        <ThumbsUp className="size-3.5" />
                        {article.helpful_yes ?? 0}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => vote(article, false)}
                      >
                        <ThumbsDown className="size-3.5" />
                        {article.helpful_no ?? 0}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
      <Outlet />
    </div>
  );
}

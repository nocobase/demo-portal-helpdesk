import { useList, useTranslate } from "@refinedev/core";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { TicketStatusBadge } from "@/pages/helpdesk/badges";
import type {
  HelpArticleRecord,
  RequesterRecord,
  TicketRecord,
} from "@/pages/helpdesk/lib";
import {
  readRecentTickets,
  type RecentTicket,
} from "@/pages/helpdesk/recent-tickets";

const SEARCH_DELAY_MS = 250;

export function GlobalSearch() {
  const translate = useTranslate();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DELAY_MS
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchQuery = debouncedQuery.trim();
  const searchEnabled = searchQuery.length >= 2;

  const { result: tickets, query: ticketsQuery } = useList<TicketRecord>({
    resource: "desk_tickets",
    filters: [
      {
        operator: "or",
        value: [
          { field: "subject", operator: "contains", value: searchQuery },
          {
            field: "requester_name",
            operator: "contains",
            value: searchQuery,
          },
          {
            field: "requester_email",
            operator: "contains",
            value: searchQuery,
          },
        ],
      },
    ],
    pagination: { mode: "server", currentPage: 1, pageSize: 5 },
    queryOptions: { retry: false, enabled: searchEnabled },
    errorNotification: false,
  });
  const { result: requesters, query: requestersQuery } =
    useList<RequesterRecord>({
      resource: "desk_requesters",
      filters: [
        {
          operator: "or",
          value: [
            { field: "name", operator: "contains", value: searchQuery },
            { field: "email", operator: "contains", value: searchQuery },
            { field: "company", operator: "contains", value: searchQuery },
          ],
        },
      ],
      pagination: { mode: "server", currentPage: 1, pageSize: 5 },
      queryOptions: { retry: false, enabled: searchEnabled },
      errorNotification: false,
    });
  const { result: articles, query: articlesQuery } =
    useList<HelpArticleRecord>({
      resource: "desk_help_articles",
      filters: [
        { field: "published", operator: "eq", value: true },
        {
          operator: "or",
          value: [
            { field: "title", operator: "contains", value: searchQuery },
            { field: "summary", operator: "contains", value: searchQuery },
          ],
        },
      ],
      pagination: { mode: "server", currentPage: 1, pageSize: 5 },
      queryOptions: { retry: false, enabled: searchEnabled },
      errorNotification: false,
    });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setRecentTickets(readRecentTickets());
  };
  const selectTarget = (target: string) => {
    navigate(target);
    setOpen(false);
    setQuery("");
  };
  const isLoading =
    ticketsQuery.isLoading ||
    requestersQuery.isLoading ||
    articlesQuery.isLoading;
  const hasResults =
    tickets.data.length > 0 ||
    requesters.data.length > 0 ||
    articles.data.length > 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl border-border/70 bg-background/60"
        onClick={() => handleOpenChange(true)}
      >
        <Search />
        <span className="hidden sm:inline">
          {translate("search.trigger", { ns: "starter" }, "Search")}
        </span>
        <Kbd>⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={translate(
          "search.dialog.title",
          { ns: "starter" },
          "Global search"
        )}
        description={translate(
          "search.dialog.description",
          { ns: "starter" },
          "Search tickets, requesters, and help articles"
        )}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={translate(
              "search.placeholder",
              { ns: "starter" },
              "Search tickets, requesters, and help articles..."
            )}
          />
          <CommandList>
            {searchEnabled ? (
              <>
                {tickets.data.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "search.groups.tickets",
                      { ns: "starter" },
                      "Tickets"
                    )}
                  >
                    {tickets.data.map((ticket) => (
                      <CommandItem
                        key={ticket.id}
                        value={`ticket-${ticket.id}`}
                        onSelect={() =>
                          selectTarget(`/tickets/show/${ticket.id}`)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{ticket.subject}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            #{ticket.id} · {ticket.requester_name}
                          </p>
                        </div>
                        <TicketStatusBadge
                          status={ticket.status}
                          className="ml-auto"
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {requesters.data.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "search.groups.requesters",
                      { ns: "starter" },
                      "Requesters"
                    )}
                  >
                    {requesters.data.map((requester) => (
                      <CommandItem
                        key={requester.id}
                        value={`requester-${requester.id}`}
                        onSelect={() =>
                          selectTarget(`/requesters/${requester.id}`)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{requester.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {requester.email} · {requester.company}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {articles.data.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "search.groups.articles",
                      { ns: "starter" },
                      "Help articles"
                    )}
                  >
                    {articles.data.map((article) => (
                      <CommandItem
                        key={article.id}
                        value={`article-${article.id}`}
                        onSelect={() =>
                          selectTarget(`/help-library?article=${article.id}`)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{article.title}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {article.summary}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {!isLoading && !hasResults ? (
                  <CommandEmpty>
                    {translate(
                      "search.noMatches",
                      { ns: "starter" },
                      "No matches"
                    )}
                  </CommandEmpty>
                ) : null}
              </>
            ) : (
              <>
                {recentTickets.length > 0 ? (
                  <CommandGroup
                    heading={translate(
                      "search.groups.recentlyViewed",
                      { ns: "starter" },
                      "Recently viewed"
                    )}
                  >
                    {recentTickets.map((ticket) => (
                      <CommandItem
                        key={ticket.id}
                        value={`recent-ticket-${ticket.id}`}
                        onSelect={() =>
                          selectTarget(`/tickets/show/${ticket.id}`)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            #{ticket.id}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                <CommandGroup
                  heading={translate(
                    "search.groups.jumpTo",
                    { ns: "starter" },
                    "Jump to"
                  )}
                >
                  <CommandItem
                    value="jump-unassigned"
                    onSelect={() => selectTarget("/tickets?view=unassigned")}
                  >
                    {translate(
                      "search.jump.unassigned",
                      { ns: "starter" },
                      "Unassigned tickets"
                    )}
                  </CommandItem>
                  <CommandItem
                    value="jump-breaching"
                    onSelect={() => selectTarget("/tickets?view=breaching")}
                  >
                    {translate(
                      "search.jump.breaching",
                      { ns: "starter" },
                      "Breaching SLA"
                    )}
                  </CommandItem>
                  <CommandItem
                    value="jump-my-open"
                    onSelect={() => selectTarget("/tickets?view=my_open")}
                  >
                    {translate(
                      "search.jump.myOpen",
                      { ns: "starter" },
                      "My open tickets"
                    )}
                  </CommandItem>
                  <CommandItem
                    value="jump-sla"
                    onSelect={() => selectTarget("/sla")}
                  >
                    {translate(
                      "search.jump.slaEscalations",
                      { ns: "starter" },
                      "SLA & escalations"
                    )}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

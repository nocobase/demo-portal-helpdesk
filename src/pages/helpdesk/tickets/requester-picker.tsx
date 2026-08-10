import { useCreate, useTranslate, type HttpError } from "@refinedev/core";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RequesterRecord } from "../lib";

export function RequesterPicker({
  value,
  onSelect,
  requesters,
  onCreated,
}: {
  value: string;
  onSelect: (requester: RequesterRecord | null) => void;
  requesters: RequesterRecord[];
  onCreated: () => void;
}) {
  const translate = useTranslate();
  const create = useCreate<RequesterRecord, HttpError>();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdRequester, setCreatedRequester] =
    useState<RequesterRecord | null>(null);
  const [newRequester, setNewRequester] = useState({
    name: "",
    email: "",
    company: "",
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      requesters.filter((requester) =>
        `${requester.name} ${requester.email} ${requester.company}`
          .toLowerCase()
          .includes(normalizedSearch)
      ),
    [normalizedSearch, requesters]
  );
  const selected =
    requesters.find((requester) => String(requester.id) === value) ??
    (createdRequester && String(createdRequester.id) === value
      ? createdRequester
      : null);

  const openCreateForm = () => {
    setNewRequester({ name: search.trim(), email: "", company: "" });
    setCreateOpen(true);
  };

  const submitRequester = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      {
        resource: "desk_requesters",
        values: {
          name: newRequester.name.trim(),
          email: newRequester.email.trim(),
          company: newRequester.company.trim(),
        },
      },
      {
        onSuccess: ({ data }) => {
          setCreatedRequester(data);
          onSelect(data);
          onCreated();
          setOpen(false);
          setCreateOpen(false);
          setSearch("");
        },
      }
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between px-3 font-normal"
          >
            <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
              {selected
                ? `${selected.name} · ${selected.company}`
                : translate(
                    "tickets.form.requesterProfilePlaceholder",
                    { ns: "starter" },
                    "Select requester"
                  )}
            </span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
      >
        {createOpen ? (
          <form className="space-y-3 p-3" onSubmit={submitRequester}>
            <p className="text-xs font-semibold">
              {translate(
                "tickets.requesterPicker.createTitle",
                { ns: "starter" },
                "New requester profile"
              )}
            </p>
            <Input
              autoFocus
              required
              value={newRequester.name}
              onChange={(event) =>
                setNewRequester((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={translate(
                "tickets.requesterPicker.namePlaceholder",
                { ns: "starter" },
                "Name"
              )}
            />
            <Input
              required
              type="email"
              value={newRequester.email}
              onChange={(event) =>
                setNewRequester((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder={translate(
                "tickets.requesterPicker.emailPlaceholder",
                { ns: "starter" },
                "Email"
              )}
            />
            <Input
              required
              value={newRequester.company}
              onChange={(event) =>
                setNewRequester((current) => ({
                  ...current,
                  company: event.target.value,
                }))
              }
              placeholder={translate(
                "tickets.requesterPicker.companyPlaceholder",
                { ns: "starter" },
                "Company"
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                {translate("buttons.cancel", { ns: "starter" }, "Cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={create.mutation.isPending}
              >
                {create.mutation.isPending
                  ? translate(
                      "tickets.requesterPicker.creating",
                      { ns: "starter" },
                      "Creating..."
                    )
                  : translate(
                      "tickets.requesterPicker.create",
                      { ns: "starter" },
                      "Create requester"
                    )}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="relative border-b p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-8 pl-7"
                placeholder={translate(
                  "tickets.requesterPicker.search",
                  { ns: "starter" },
                  "Search requesters"
                )}
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {filtered.map((requester) => (
                <button
                  key={requester.id}
                  type="button"
                  onClick={() => {
                    onSelect(requester);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="block w-full rounded-md px-2 py-2 text-left hover:bg-accent/60"
                >
                  <p className="text-xs font-semibold">{requester.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {requester.email} · {requester.company}
                  </p>
                </button>
              ))}
              {filtered.length === 0 ? (
                <>
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    {translate(
                      "tickets.requesterPicker.empty",
                      { ns: "starter" },
                      "No requester matches this search."
                    )}
                  </p>
                  {search.trim() ? (
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="block w-full rounded-md px-2 py-2 text-left text-xs font-medium hover:bg-accent/60"
                    >
                      {translate(
                        "tickets.requesterPicker.createFromSearch",
                        { ns: "starter", text: search.trim() },
                        "Create {{text}} as a new requester"
                      )}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

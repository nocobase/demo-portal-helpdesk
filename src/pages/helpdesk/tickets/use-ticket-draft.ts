import { useCallback, useEffect, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import type { TicketFormValues } from "./ticket-form-fields";

const STORAGE_KEY = "helpdesk.tickets.draft";
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;

type TicketDraft = {
  savedAt: string;
  values: TicketFormValues;
};

const VALUE_KEYS: (keyof TicketFormValues)[] = [
  "subject",
  "description",
  "priority",
  "category",
  "source",
  "requester_name",
  "requester_email",
  "assigneeId",
  "queue_id",
  "ticket_type_id",
  "requester_id",
];

function isTicketDraft(value: unknown): value is TicketDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TicketDraft>;
  if (typeof candidate.savedAt !== "string") return false;
  if (!candidate.values || typeof candidate.values !== "object") return false;
  return VALUE_KEYS.every((key) => typeof candidate.values?.[key] === "string");
}

function readDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isTicketDraft(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const savedAt = new Date(parsed.savedAt).getTime();
    if (
      !Number.isFinite(savedAt) ||
      savedAt > Date.now() ||
      Date.now() - savedAt >= MAX_DRAFT_AGE_MS
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return null;
  }
}

function removeDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Draft persistence must never make the ticket form unusable.
  }
}

function hasAnyValue(values: TicketFormValues) {
  return VALUE_KEYS.some((key) => (values[key] ?? "").trim().length > 0);
}

export function useTicketDraft(form: UseFormReturn<TicketFormValues>) {
  const [draft, setDraft] = useState<TicketDraft | null>(() => readDraft());
  const values = useWatch({ control: form.control }) as TicketFormValues;

  useEffect(() => {
    if (!form.formState.isDirty || !hasAnyValue(values)) return;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ savedAt: new Date().toISOString(), values })
        );
      } catch {
        // A blocked store or full quota should not interrupt form editing.
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [form.formState.isDirty, values]);

  const restore = useCallback(() => {
    if (!draft) return;
    form.reset(draft.values);
    setDraft(null);
  }, [draft, form]);

  const discard = useCallback(() => {
    removeDraft();
    setDraft(null);
  }, []);

  const clear = useCallback(() => {
    removeDraft();
    setDraft(null);
  }, []);

  return { draft, restore, discard, clear };
}

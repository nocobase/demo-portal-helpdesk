import { useCallback, useEffect, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";

export type TableDensity = "compact" | "comfortable";

export type TicketTablePrefs = {
  columnVisibility: VisibilityState;
  density: TableDensity;
  pageSize: number;
};

const STORAGE_KEY = "helpdesk.tickets.table-prefs";

const DEFAULT_PREFS: TicketTablePrefs = {
  columnVisibility: {},
  density: "comfortable",
  pageSize: 20,
};

const readPrefs = (): TicketTablePrefs => {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<TicketTablePrefs>;
    return {
      columnVisibility: parsed.columnVisibility ?? DEFAULT_PREFS.columnVisibility,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      pageSize: Number(parsed.pageSize) || DEFAULT_PREFS.pageSize,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

/**
 * Column layout, density, and page size survive a reload — the small piece of
 * per-agent state every production list keeps, and the first thing that feels
 * missing when a demo resets the table on every visit.
 */
export function useTicketTablePrefs() {
  const [prefs, setPrefs] = useState<TicketTablePrefs>(readPrefs);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // A full or blocked storage quota must never break the table.
    }
  }, [prefs]);

  const setColumnVisibility = useCallback(
    (updater: VisibilityState | ((current: VisibilityState) => VisibilityState)) =>
      setPrefs((current) => ({
        ...current,
        columnVisibility:
          typeof updater === "function"
            ? updater(current.columnVisibility)
            : updater,
      })),
    []
  );

  const setDensity = useCallback(
    (density: TableDensity) =>
      setPrefs((current) => ({ ...current, density })),
    []
  );

  const setPageSize = useCallback(
    (pageSize: number) => setPrefs((current) => ({ ...current, pageSize })),
    []
  );

  return { prefs, setColumnVisibility, setDensity, setPageSize };
}

/** Row padding overrides applied around the shared DataTable. */
export const densityClassName = (density: TableDensity) =>
  density === "compact"
    ? "[&_tbody_td]:py-1 [&_thead_th]:py-1.5 [&_tbody_td]:text-[13px]"
    : "";

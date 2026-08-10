export type CsvColumn<T> = {
  key: string;
  label: string;
  value: (record: T) => string | number | null | undefined;
};

const escapeCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildCsv = <T>(records: T[], columns: CsvColumn<T>[]) =>
  [
    columns.map((column) => escapeCell(column.label)).join(","),
    ...records.map((record) =>
      columns.map((column) => escapeCell(column.value(record))).join(",")
    ),
  ].join("\r\n");

/**
 * Exports what the agent is currently looking at, filters included. A BOM is
 * prefixed so Excel opens non-ASCII requester names correctly instead of
 * mojibake — the usual first complaint about a CSV export.
 */
export const downloadCsv = <T>(
  filename: string,
  records: T[],
  columns: CsvColumn<T>[]
) => {
  const blob = new Blob(["﻿", buildCsv(records, columns)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Opens a standalone, print-ready document. Support desks routinely need a
 * paper or PDF copy of a ticket for escalation and audit, and rendering it as
 * its own document keeps the app chrome, drawers, and dark theme out of the
 * printout.
 */
export const openPrintDocument = (title: string, bodyHtml: string) => {
  const printWindow = window.open("", "_blank", "noopener,width=900,height=1000");
  if (!printWindow) return false;
  printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px; font: 13px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin: 28px 0 8px; }
  .meta { color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td, th { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; width: 30%; }
  .entry { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
  .entry header { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
  .entry p { margin: 0; white-space: pre-wrap; }
  footer { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 11px; color: #9ca3af; }
  @page { margin: 16mm; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
};

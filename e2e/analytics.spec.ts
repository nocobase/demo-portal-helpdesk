import { expect, test } from "@playwright/test";
import { gotoApp, numericValue, saveEvidence } from "./helpers";

async function metricText(page: import("@playwright/test").Page, label: string) {
  const candidates = page.getByText(label, { exact: true });
  const texts: string[] = [];
  for (let index = 0; index < await candidates.count(); index += 1) {
    texts.push(await candidates.nth(index).locator("..").locator("..").innerText());
  }
  return texts.find((text) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n\\s*\\d`).test(text)) ?? texts.at(-1) ?? "";
}

test("dashboard KPIs are populated", async ({ page }) => {
  await gotoApp(page, "dashboard");
  for (const label of ["Open tickets", "Overdue", "Resolved today"]) {
    const text = await metricText(page, label);
    const value = numericValue(text.replace(label, ""));
    expect(value, `${label} should be a non-zero numeric KPI; card was: ${text}`).toBeGreaterThan(0);
  }
});

test("dashboard ticket-status chart renders graphical marks", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: the Tickets by status Recharts wrapper is empty; only the numeric legend renders.");
  await gotoApp(page, "dashboard");
  const section = page.getByRole("heading", { name: "Tickets by status" }).locator("..");
  await saveEvidence(page, testInfo, "dashboard-status-chart-empty");
  expect(await section.locator("svg path, svg rect, canvas").count()).toBeGreaterThan(0);
});

test("dashboard due-soon KPI agrees with visible due-soon tickets", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: the dashboard reports zero due within two hours while the board visibly contains due-soon tickets.");
  await gotoApp(page, "dashboard");
  const dueCard = page.getByText("Due within 2h", { exact: true }).locator("..").locator("..");
  const value = numericValue((await dueCard.innerText()).replace("Due within 2h", ""));
  await saveEvidence(page, testInfo, "dashboard-due-soon-zero");
  expect(value).toBeGreaterThan(0);
});

test("CSAT KPIs and charts are non-empty", async ({ page }) => {
  await gotoApp(page, "csat");
  for (const label of ["Average score", "Positive ratings", "Responses", "Latest score"]) {
    const text = await metricText(page, label);
    expect(text).not.toMatch(/NaN|—/);
    expect(numericValue(text.replace(label, ""))).toBeGreaterThan(0);
  }
  expect(await page.locator("svg.recharts-surface path, svg.recharts-surface rect").count()).toBeGreaterThan(5);
});

test("CSAT exposes every date-range tab and each produces a valid state", async ({ page }, testInfo) => {
  await gotoApp(page, "csat");
  await saveEvidence(page, testInfo, "csat-range-tabs-missing");
  for (const label of ["Last 30 days", "Last 90 days", "Last 12 months", "All time"]) {
    const range = page.getByRole("button", { name: label, exact: true });
    await expect(range).toBeVisible({ timeout: 2_000 });
    await range.click();
    await expect(page.getByRole("heading", { name: "Needs a follow-up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent feedback" })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain("NaN");
  }
});

test("requester, performance and ticket-type KPIs are non-zero", async ({ page }) => {
  const cases = [
    ["requesters", ["Requester profiles", "Companies", "Repeat requesters"]],
    ["performance", ["Tickets resolved", "Active workload", "Team CSAT", "SLA compliance"]],
    ["ticket-types", ["Ticket types", "Categorized tickets"]],
  ] as const;
  for (const [route, labels] of cases) {
    await gotoApp(page, route);
    for (const label of labels) {
      const text = await metricText(page, label);
      expect(text).not.toMatch(/NaN|—/);
      expect(numericValue(text.replace(label, "")), `${route}: ${text}`).toBeGreaterThan(0);
    }
  }
});

test("all report charts render real SVG graph elements", async ({ page }) => {
  await gotoApp(page, "reports");
  const charts = page.locator("svg.recharts-surface");
  expect(await charts.count()).toBeGreaterThanOrEqual(5);
  for (let index = 0; index < 5; index += 1) {
    expect(await charts.nth(index).locator("path, rect, circle, line").count()).toBeGreaterThan(0);
  }
});

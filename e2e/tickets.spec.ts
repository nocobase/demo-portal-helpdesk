import { expect, test } from "@playwright/test";
import { gotoApp, saveEvidence } from "./helpers";

const firstTicketText = async (page: import("@playwright/test").Page) =>
  (await page.locator("tbody tr").first().innerText()).trim();

test("ticket pagination changes the rendered rows", async ({ page }) => {
  await gotoApp(page, "tickets");
  const initial = await firstTicketText(page);
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await expect.poll(() => firstTicketText(page)).not.toBe(initial);
});

test("ticket subject sorting changes the first row", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: the deployed Subject sort control makes no change to the rendered rows.");
  await gotoApp(page, "tickets");
  const initial = await firstTicketText(page);
  await page.getByRole("button", { name: /Sort by subject/i }).click();
  await saveEvidence(page, testInfo, "ticket-subject-sort-stuck");
  await expect.poll(() => firstTicketText(page), { timeout: 3_000 }).not.toBe(initial);
});

test("ticket details show properties, timeline and customer conversation", async ({ page }) => {
  await gotoApp(page, "tickets");
  await page.locator("tbody tr").first().getByRole("button").filter({ hasNotText: "Delete" }).first().click();
  await expect(page).toHaveURL(/\/tickets\/show\/\d+$/);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Details", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Timeline", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Created", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Customer conversation", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Opened ticket", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
});

test("single-record delete offers confirmation and can be cancelled", async ({ page }) => {
  await gotoApp(page, "tickets");
  await page.getByRole("button", { name: "Delete ticket" }).first().click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "Are you sure?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).toBeHidden();
});

test("ticket create form validates required fields and cancels without writing", async ({ page }) => {
  await gotoApp(page, "tickets/create");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "New ticket" })).toBeVisible();
  for (const label of ["Subject", "Description", "Queue", "Ticket type", "Requester profile", "Requester name", "Requester email"]) {
    await expect(dialog.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Create ticket" }).click();
  await expect(dialog.getByText("Subject is required", { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("ticket workspace exposes all saved views and table tools", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: the deployed ticket list is an older generic table without the saved-view workspace and tools declared by the portal source.");
  await gotoApp(page, "tickets");
  await saveEvidence(page, testInfo, "ticket-workspace-missing");
  for (const view of [
    "All tickets",
    "Unassigned",
    "My open tickets",
    "Awaiting first reply",
    "Breaching SLA",
    "Urgent & high",
    "Solved today",
    "Recently updated",
  ]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${view}`) })).toBeVisible();
  }
  await expect(page.getByPlaceholder("Search subject or requester")).toBeVisible();
  await expect(page.getByRole("button", { name: "Columns" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
});

test("dashboard ticket KPI drilldown filters the ticket list", async ({ page }, testInfo) => {
  test.fail(true, "The E2E target is serving an older portal bundle that still links Open tickets to view=my_open; current src cannot be deployed in this task.");
  await gotoApp(page, "dashboard");
  const kpi = page.getByRole("button", { name: /Open tickets/ });
  await expect(kpi).toBeVisible({ timeout: 2_000 });
  const expectedCount = Number((await kpi.innerText()).match(/\d+/)?.[0]);
  await kpi.click();
  await page.waitForLoadState("networkidle");
  await saveEvidence(page, testInfo, "ticket-kpi-drilldown-unfiltered");
  await expect(page).toHaveURL(/view=team_open/);
  await expect(page.getByText(`${expectedCount} row(s)`, { exact: true })).toBeVisible();
});

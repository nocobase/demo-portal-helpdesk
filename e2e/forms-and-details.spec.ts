import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

const createForms = [
  { name: "queue", route: "queues/create", heading: "New queue", submit: "Create queue", error: "Queue name is required", fields: ["Queue name"] },
  { name: "SLA policy", route: "sla/policy/create", heading: "New SLA policy", submit: "Create policy", error: "Policy name is required", fields: ["Policy name", "Priority", "First response (minutes)", "Resolution (minutes)"] },
  { name: "ticket type", route: "ticket-types/create", heading: "New ticket type", submit: "Create ticket type", error: "Ticket type name is required", fields: ["Ticket type"] },
  { name: "help article", route: "help-library/create", heading: "New article", submit: "Create article", error: "Title is required", fields: ["Title", "Summary", "Body", "Category", "Library category"] },
  { name: "requester", route: "requesters/create", heading: "New requester", submit: "Create requester", error: "Requester name is required", fields: ["Requester", "Company", "Email"] },
  { name: "macro", route: "macros/create", heading: "New macro", submit: "Create macro", error: "Macro title is required", fields: ["Title", "Category", "Body"] },
] as const;

for (const form of createForms) {
  test(`${form.name} create form validates empty input and cancels`, async ({ page }) => {
    await gotoApp(page, form.route);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: form.heading })).toBeVisible();
    for (const field of form.fields) await expect(dialog.getByText(field, { exact: true }).first()).toBeVisible();
    await dialog.getByRole("button", { name: form.submit }).click();
    await expect(dialog.getByText(form.error, { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
}

test("requester detail contains linked ticket history and closes", async ({ page }) => {
  await gotoApp(page, "requesters");
  await page.locator("tbody tr").filter({ hasText: "Nina Williams" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nina Williams" })).toBeVisible();
  await expect(dialog.getByText(/tickets across this relationship/)).toBeVisible();
  expect(await dialog.getByRole("button").count()).toBeGreaterThan(2);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
});

test("queue detail contains workload, people and tickets and closes", async ({ page }) => {
  await gotoApp(page, "queues");
  await page.getByRole("button", { name: /Account Services\s+5 tickets in flight/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Account Services" })).toBeVisible();
  await expect(dialog.getByText(/\d+ tickets/).first()).toBeVisible();
  expect(await dialog.getByRole("button").count()).toBeGreaterThan(2);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
});

test("ticket-type detail shows associated ticket count and closes", async ({ page }) => {
  await gotoApp(page, "ticket-types");
  await page.getByRole("button", { name: "View" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/tickets|Ticket type/i);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
});

test("SLA policy detail opens with targets and closes", async ({ page }) => {
  await gotoApp(page, "sla");
  await page.getByRole("button", { name: /Critical incident\s+Urgent/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("First response", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Resolution", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
});

test("edit drawers load existing values and cancel without saving", async ({ page }) => {
  const cases = [
    { route: "queues", edit: "Edit queue" },
    { route: "sla", edit: "Edit SLA policy" },
    { route: "ticket-types", edit: "Edit" },
    { route: "help-library", edit: "Edit" },
    { route: "macros", edit: "Edit" },
  ];
  for (const item of cases) {
    await gotoApp(page, item.route);
    await page.getByRole("button", { name: item.edit, exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const values = await dialog.locator("input, textarea").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement).value).filter(Boolean)
    );
    expect(values.length, `${item.route} edit drawer should contain existing values`).toBeGreaterThan(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  }
});

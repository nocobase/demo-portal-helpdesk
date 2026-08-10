import { expect, test } from "@playwright/test";
import { gotoApp, saveEvidence } from "./helpers";

test("every help-library category filter yields data or a normal empty state", async ({ page }) => {
  await gotoApp(page, "help-library");
  const categories = [
    "All articles",
    "Invoices & Tax",
    "Payments & Refunds",
    "Subscriptions",
    "Integrations & API",
    "Reporting & Export",
    "Workspace Setup",
    "Authentication",
    "Data Privacy & Compliance",
    "User Management",
    "Email & Notifications",
    "Mobile Application",
    "Web Application",
  ];
  const aside = page.locator("aside");
  for (const name of categories) {
    await aside.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    const resultText = await page.getByText(/\d+ matching articles/).innerText();
    const count = Number(resultText.match(/\d+/)?.[0]);
    if (count === 0) await expect(page.getByText("No matching articles yet.")).toBeVisible();
    else expect(await page.locator("article").count()).toBeGreaterThan(0);
  }

});

test("help-library search really changes the result", async ({ page }) => {
  await gotoApp(page, "help-library");
  const firstTitle = async () => (await page.locator("article h3").first().innerText()).trim();
  const search = page.getByPlaceholder("Search articles");
  await search.fill("Rotating an expiring SAML signing certificate");
  await expect(page.locator("article h3")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Rotating an expiring SAML signing certificate" })).toBeVisible();
  await search.fill("");
  await expect.poll(() => page.locator("article").count()).toBeGreaterThan(1);
  expect(await firstTitle()).not.toBe("");
});

test("help-library exposes state filters and sorting", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: the deployed Help library omits All/Published/Draft state filters and Recently updated/Most helpful sorting.");
  await gotoApp(page, "help-library");
  await saveEvidence(page, testInfo, "help-library-state-sort-missing");
  await expect(page.getByRole("button", { name: /^Draft\s*\d+$/ })).toBeVisible({ timeout: 2_000 });
});

test("ticket-type, macro and requester searches change their lists", async ({ page }) => {
  await gotoApp(page, "ticket-types");
  await page.getByPlaceholder("Search ticket types").fill("Incident");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("Incident");

  await gotoApp(page, "macros");
  await page.getByPlaceholder("Search macros").fill("Account access restored after lockout");
  await expect(page.locator("h3")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Account access restored after lockout" })).toBeVisible();

  await gotoApp(page, "requesters");
  const before = (await page.locator("tbody tr").first().innerText()).trim();
  await page.getByPlaceholder("Search requesters").fill("Nina Williams");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("Nina Williams");
  expect((await page.locator("tbody tr").first().innerText()).trim()).not.toBe(before);
});

test("requester CSV export produces a non-empty download", async ({ page }, testInfo) => {
  await gotoApp(page, "requesters");
  await saveEvidence(page, testInfo, "requester-export-missing");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible({ timeout: 2_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let bytes = 0;
  for await (const chunk of stream) bytes += chunk.length;
  expect(bytes).toBeGreaterThan(0);
});

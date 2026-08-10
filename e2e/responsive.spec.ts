import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("narrow viewport navigation works and dismisses the sidebar", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: selecting a mobile navigation link changes the URL but leaves the full-screen Sidebar dialog open.");
  await gotoApp(page, "dashboard");
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  const ticketsLink = page.getByRole("link", { name: "Tickets", exact: true }).filter({ visible: true });
  await expect(ticketsLink.first()).toBeVisible();
  await ticketsLink.first().click();
  await expect(page).toHaveURL(/\/tickets$/);
  await page.screenshot({ path: testInfo.outputPath("mobile-sidebar-stuck.png"), fullPage: true });
  await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden({ timeout: 2_000 });
  await expect(page.getByRole("heading", { name: "Tickets", exact: true }).last()).toBeVisible();

});

test("narrow viewport has no page-level horizontal overflow", async ({ page }, testInfo) => {
  test.fail(true, "Product defect: the 390px dashboard renders a 505px-wide document.");
  await gotoApp(page, "dashboard");
  await page.screenshot({ path: testInfo.outputPath("mobile-overflow.png"), fullPage: true });
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});

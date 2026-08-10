import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";

export const portalUrl = (route = "") => `./${route.replace(/^\/+/, "")}`;

export async function gotoApp(page: Page, route: string) {
  await page.goto(portalUrl(route));
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).not.toContainText(
    /Sorry, the page you visited does not exist|Something went wrong/i
  );
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
}

export function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`Uncaught: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) errors.push(`HTTP 404: ${response.url()}`);
  });
  return errors;
}

export async function expectNoRuntimeErrors(errors: string[]) {
  expect(errors, `Unexpected browser runtime errors:\n${errors.join("\n")}`).toEqual([]);
}

export async function saveEvidence(page: Page, testInfo: TestInfo, name: string) {
  await mkdir("e2e/evidence", { recursive: true });
  const path = `e2e/evidence/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
  return path;
}

export async function expectTableHasRows(page: Page) {
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(page.locator("body")).not.toContainText(/No records/i);
}

export function numericValue(text: string) {
  const match = text.match(/(?:^|\n)\s*(-?\d+(?:\.\d+)?)/m);
  return match ? Number(match[1]) : Number.NaN;
}

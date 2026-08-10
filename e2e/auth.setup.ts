import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const authFile = "e2e/.auth/admin.json";

setup("authenticate through the sign-in UI", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("textbox", { name: /Username or email/i }).fill("admin@nocobase.com");
  await page.getByLabel(/^Password$/i).fill("admin123");
  await page.getByRole("button", { name: /Sign in/i }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveURL(/\/x\/desk\/dashboard(?:[/?#]|$)/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const nocobaseKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith("NOCOBASE_"))
  );
  console.log(`Confirmed NocoBase storage keys: ${nocobaseKeys.join(", ")}`);
  expect(nocobaseKeys.length).toBeGreaterThan(0);
  expect(nocobaseKeys.some((key) => /TOKEN/i.test(key))).toBeTruthy();

  await mkdir("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: authFile });
});

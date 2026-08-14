import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const authFile = "e2e/.auth/admin.json";

const account = process.env.NOCOBASE_E2E_ACCOUNT ?? "admin@nocobase.com";
const password = process.env.NOCOBASE_E2E_PASSWORD;
if (!password) {
  throw new Error(
    "NOCOBASE_E2E_PASSWORD is not set. Copy .env.e2e.example to .env.e2e and fill it in — " +
      "the sign-in password is deliberately not committed."
  );
}

setup("authenticate through the sign-in UI", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("textbox", { name: /Username or email/i }).fill(account);
  await page.getByLabel(/^Password$/i).fill(password);
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

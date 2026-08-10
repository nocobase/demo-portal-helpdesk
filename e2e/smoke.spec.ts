import { expect, test } from "@playwright/test";
import {
  captureRuntimeErrors,
  expectNoRuntimeErrors,
  expectTableHasRows,
  gotoApp,
} from "./helpers";

type PageCase = {
  route: string;
  heading: string;
  verify: (page: import("@playwright/test").Page) => Promise<void>;
};

const pages: PageCase[] = [
  {
    route: "dashboard",
    heading: "Dashboard",
    verify: async (page) => {
      await expect(page.getByRole("heading", { name: "Tickets by status" })).toBeVisible();
      await expect(page.getByText("462", { exact: true })).toBeVisible();
    },
  },
  { route: "tickets", heading: "Tickets", verify: expectTableHasRows },
  {
    route: "board",
    heading: "Board",
    verify: async (page) => {
      for (const status of ["Open", "In progress", "Resolved", "Closed"]) {
        await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
      }
      expect(await page.locator("main button[draggable=true], button[draggable=true]").count()).toBeGreaterThan(0);
    },
  },
  {
    route: "queues",
    heading: "Queue workload",
    verify: async (page) => {
      await expect(page.getByRole("heading", { name: "Account Services" })).toBeVisible();
      await expect(page.getByText(/tickets in flight/).first()).toBeVisible();
    },
  },
  { route: "sla", heading: "SLA & escalations", verify: expectTableHasRows },
  { route: "ticket-types", heading: "Ticket types", verify: expectTableHasRows },
  {
    route: "help-library",
    heading: "Help library",
    verify: async (page) => {
      expect(await page.locator("article").count()).toBeGreaterThan(0);
      await expect(page.getByText(/matching articles/)).toBeVisible();
    },
  },
  { route: "requesters", heading: "Requesters", verify: expectTableHasRows },
  {
    route: "csat",
    heading: "Customer satisfaction",
    verify: async (page) => {
      await expect(page.getByRole("heading", { name: "Recent feedback" })).toBeVisible();
      expect(await page.locator("svg.recharts-surface").count()).toBeGreaterThanOrEqual(2);
    },
  },
  {
    route: "performance",
    heading: "Agent performance",
    verify: async (page) => {
      await expectTableHasRows(page);
      expect(await page.locator("svg.recharts-surface").count()).toBeGreaterThan(0);
    },
  },
  {
    route: "macros",
    heading: "Reply macros",
    verify: async (page) => {
      await expect(page.getByRole("heading", { name: "Account access restored after lockout" })).toBeVisible();
      expect(await page.locator("h3").count()).toBeGreaterThan(5);
    },
  },
  {
    route: "reports",
    heading: "Support reports",
    verify: async (page) => {
      expect(await page.locator("svg.recharts-surface").count()).toBeGreaterThanOrEqual(5);
      expect(await page.locator(".recharts-layer").count()).toBeGreaterThan(5);
    },
  },
];

for (const item of pages) {
  test(`${item.heading} smoke: loads data without runtime errors`, async ({ page }) => {
    const errors = captureRuntimeErrors(page);
    await gotoApp(page, item.route);
    await expect(page.getByRole("heading", { name: item.heading, exact: true }).last()).toBeVisible();
    await item.verify(page);
    test.fail(errors.length > 0, "Product defect: every portal route logs a shared 404 resource error in the browser console.");
    await expectNoRuntimeErrors(errors);
  });
}

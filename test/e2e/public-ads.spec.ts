import { expect, test } from "@playwright/test";
import {
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_SCRIPT_SRC,
  ADSTERRA_SOCIAL_BAR_SCRIPT_SRC,
  ADSTERRA_BANNER_OPTIONS,
} from "../../app/utils/public-ads";

const LAST_SOCIAL_AT_KEY = "dealsrky:adsterra:social-bar:last-shown-v2";

test.beforeEach(async ({ page }) => {
  await page.route(/highrevenueformat\.com|profitableratecpmnetwork\.com/, route => route.abort());
});

async function assertBanner(page: import("@playwright/test").Page, name: string, lazy: boolean) {
  const node = page.locator(`[data-ad-placement="${name}"]`);
  await expect(node).toHaveCount(1);
  await expect(node).toHaveAttribute("data-ad-banner-key", ADSTERRA_BANNER_KEY);
  const iframe = node.locator("iframe");
  await expect(iframe).toHaveAttribute("loading", "eager");
  await expect(iframe).toHaveAttribute("height", "50");
  await expect(iframe).toHaveAttribute("width", "320");
  await expect(iframe).toHaveAttribute("sandbox", /allow-scripts.*allow-same-origin/);
  if (!lazy) await expect(iframe).toHaveAttribute("src", "/adsterra-banner.html");
  // Deferred banners are activated when scrolled into the viewport.
  if (lazy) {
    await node.scrollIntoViewIfNeeded();
    await expect(iframe).toHaveAttribute("src", "/adsterra-banner.html");
  }
}

test("homepage has three screenshot-marked banners and no Social Bar", async ({ page }) => {
  await page.goto("/?market=US");
  await assertBanner(page, "home-after-header", false);
  await assertBanner(page, "home-after-categories", true);
  await assertBanner(page, "home-after-first-row", true);
  await expect(page.locator('[data-ad-placement]')).toHaveCount(3);
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);

  await page.goto("/?market=CA");
  await expect(page.locator('[data-ad-placement]')).toHaveCount(3);
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
});

test("collection has three marked banner positions and one Social Bar attempt", async ({ page }) => {
  await page.goto("/collections/trending?market=US");
  await assertBanner(page, "collection-after-header", false);
  await assertBanner(page, "collection-before-grid", true);
  await assertBanner(page, "collection-before-footer", true);
  await expect(page.locator('[data-ad-placement]')).toHaveCount(3);
  await expect(page.locator(`body > script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(1);
  expect(await page.evaluate((key) => Number(localStorage.getItem(key)) > 0, LAST_SOCIAL_AT_KEY)).toBe(true);
});

test("Social Bar appears only once in five minutes across public URLs, reload and tabs", async ({ page, context }) => {
  await page.goto("/about");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(1);
  await page.reload();
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);

  await page.goto("/contact");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);

  const nextTab = await context.newPage();
  await nextTab.route(/highrevenueformat\.com|profitableratecpmnetwork\.com/, route => route.abort());
  await nextTab.goto("/collections/latest");
  await expect(nextTab.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
  await nextTab.close();

  await page.evaluate(key => localStorage.setItem(key, String(Date.now() - 300001)), LAST_SOCIAL_AT_KEY);
  await page.goto("/privacy");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(1);
});

test("returning to homepage removes the existing Social Bar script", async ({ page }) => {
  await page.goto("/collections/trending?market=US");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(1);
  await page.getByRole("link", { name: "Home" }).first().click();
  await expect(page).toHaveURL("http://localhost:5173/");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
});

test("Social Bar never loads on home or protected/public redirect pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
  await page.goto("/admin/login");
  await expect(page.locator('[data-ad-placement]')).toHaveCount(0);
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
  await page.goto("/portal/login");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
});

test("Social Bar fails closed when localStorage is inaccessible", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      configurable: true,
      value() { throw new Error("storage prohibited"); },
    });
  });
  await page.goto("/about");
  await expect(page.locator(`script[src="${ADSTERRA_SOCIAL_BAR_SCRIPT_SRC}"]`)).toHaveCount(0);
});

import { expect, test } from "@playwright/test";
import { ADSTERRA_BANNER_SCRIPT_SRC } from "../../app/utils/public-ads";

test("approved inline banner survives client navigation without an extra iframe or request", async ({ page }) => {
  let publisherRequests = 0;
  await page.route(ADSTERRA_BANNER_SCRIPT_SRC, async (route) => {
    publisherRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `document.write('<span data-test-banner-creative="1" style="display:inline-block;width:320px;height:50px">Ad test creative</span>');`,
    });
  });
  await page.route(/profitableratecpmnetwork\.com/, (route) => route.abort());

  await page.goto("/about", { waitUntil: "domcontentloaded" });
  const banner = page.locator('[data-ad-placement="public-under-header"]');
  await expect(banner).toHaveCount(1);
  await expect(banner.locator('[data-test-banner-creative="1"]')).toHaveCount(1);
  await expect(banner.locator("iframe")).toHaveCount(0);
  expect(publisherRequests).toBe(1);
  const initialScript = await banner.locator("script[src]").count();
  expect(initialScript).toBe(1);

  await page.locator('a[href="/privacy"]').first().click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(banner.locator('[data-test-banner-creative="1"]')).toHaveCount(1);
  expect(publisherRequests).toBe(1);

  await page.locator('a[href="/about"]').first().click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(banner.locator('[data-test-banner-creative="1"]')).toHaveCount(1);
  await expect(page.locator('[data-ad-placement]')).toHaveCount(1);
  expect(publisherRequests).toBe(1);
});

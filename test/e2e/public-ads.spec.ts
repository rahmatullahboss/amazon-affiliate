import { expect, test } from "@playwright/test";
import {
  BOTTOM_SCRIPT_SRC,
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  POPUNDER_SCRIPT_SRC,
} from "../../app/utils/public-ads";

test("loads the supplied ads on public pages but not admin pages", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(`head script[src="${POPUNDER_SCRIPT_SRC}"]`)).toHaveCount(1);
  await expect(page.locator(`script[src="${NATIVE_BANNER_SCRIPT_SRC}"]`)).toHaveCount(1);
  await expect(page.locator(`#${NATIVE_BANNER_CONTAINER_ID}`)).toHaveCount(1);
  await expect(page.locator(`script[src="${BOTTOM_SCRIPT_SRC}"]`)).toHaveCount(1);

  await page.goto("/admin/login");

  await expect(page.locator(`script[src^="https://pl309676"]`)).toHaveCount(0);
  await expect(page.locator(`#${NATIVE_BANNER_CONTAINER_ID}`)).toHaveCount(0);
});

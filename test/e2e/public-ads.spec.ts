import { expect, test } from "@playwright/test";
import {
  REVBID_CONTAINER_ID,
  REVBID_SCRIPT_SRC,
} from "../../app/utils/public-ads";

test("loads the supplied ads on public pages but not admin pages", async ({ page }) => {
  await page.goto("/about");

  await expect(page.locator(`head script[src="${REVBID_SCRIPT_SRC}"]`)).toHaveCount(1);
  await expect(page.locator(`#${REVBID_CONTAINER_ID}[data-placement-id="revbid-mobile"]`)).toHaveCount(1);

  await page.goto("/admin/login");

  await expect(page.locator(`head script[src="${REVBID_SCRIPT_SRC}"]`)).toHaveCount(0);
  await expect(page.locator(`#${REVBID_CONTAINER_ID}`)).toHaveCount(0);
});

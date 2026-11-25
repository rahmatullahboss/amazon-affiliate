import { test, expect } from "@playwright/test";

test.skip(!process.env.DEALSRKY_QA_PERSIST, "Requires the isolated catalog browser QA runner");

test.beforeEach(async ({ page, baseURL }) => {
  // No external ad, analytics, Amazon or image traffic in synthetic QA.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL!).origin ? route.continue() : route.abort();
  });
});

test("category page limits cards to 24, preserves total and resets marketplace", async ({ page }) => {
  const result = await page.goto("/category/qa-catalog?market=US");
  expect(result?.status()).toBe(200);
  await expect(page.getByText("27 products available in US")).toBeVisible();
  await expect(page.locator("h3").filter({hasText:/^QA Product \d+$/})).toHaveCount(24);
  const nav = page.getByRole("navigation",{name:"Product pages"});
  await expect(nav.getByText("Page 1 of 2")).toBeVisible();
  await nav.getByRole("link",{name:"Next"}).click();
  await expect(page).toHaveURL(/market=US&page=2$/);
  await expect(page.locator("h3").filter({hasText:/^QA Product \d+$/})).toHaveCount(3);
  await expect(nav.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href","https://dealsrky.com/category/qa-catalog?market=US&page=2");
  await nav.getByRole("link",{name:"Previous"}).click();
  await expect(nav.getByText("Page 1 of 2")).toBeVisible();
  await nav.getByRole("link",{name:"Next"}).click();
  await page.getByRole("combobox",{name:"Showing only"}).selectOption("CA");
  await expect(page).toHaveURL(/market=CA$/);
  await expect(page.getByText("1 product available in CA")).toBeVisible();
  await expect(page.locator("h3").filter({hasText:/^QA Product \d+$/})).toHaveCount(1);
  await expect(nav).toHaveCount(0);
});

test("agent alias preserves marketplace and exact original tracked product paths", async ({ page }) => {
  const response = await page.goto("/qa-catalog-us?market=CA");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("27 products available in US")).toBeVisible();
  await expect(page.locator('a[href^="/qa-catalog-us/us/Q"]')).toHaveCount(24);
  const nav=page.getByRole("navigation",{name:"Product pages"});
  await nav.getByRole("link",{name:"Next"}).click();
  await expect(page).toHaveURL(/market=US&page=2$/);
  await expect(page.locator('a[href^="/qa-catalog-us/us/Q"]')).toHaveCount(3);
  await expect(page.getByRole("link",{name:/QA Product 01/})).toHaveAttribute("href","/qa-catalog-us/us/Q000000001");
});

test("homepage keeps header channels and hides only footer channels across client navigation", async ({page,isMobile}) => {
  await page.goto("/");
  const footer=page.locator("footer");
  await expect(footer.getByRole("link",{name:"Telegram"})).toHaveCount(0);
  // Header links must remain available on the homepage on both layouts.
  if (isMobile) {
    await page.getByRole("button",{name:"Toggle menu"}).click();
    await expect(page.locator("header").getByRole("link",{name:"Join us on Telegram"})).toHaveAttribute("href","https://t.me/qa_fixture");
    await page.getByRole("button",{name:"Toggle menu"}).click();
  } else {
    await expect(page.locator("header").getByRole("link",{name:"Telegram"})).toHaveAttribute("href","https://t.me/qa_fixture");
  }
  // Verify client navigation rather than another full document load.
  await page.evaluate(()=>{(window as Window & {qaNavigation?:boolean}).qaNavigation=true});
  await footer.getByRole("link",{name:"Blog",exact:true}).click();
  await expect(page).toHaveURL(/\/blog$/);
  expect(await page.evaluate(()=>(window as Window & {qaNavigation?:boolean}).qaNavigation)).toBe(true);
  await expect(footer.getByRole("link",{name:"Telegram"})).toHaveAttribute("href","https://t.me/qa_fixture");
  await footer.getByRole("link",{name:"Home",exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(footer.getByRole("link",{name:"Telegram"})).toHaveCount(0);
  await footer.getByRole("link",{name:"Blog",exact:true}).click();
  await expect(footer.getByRole("link",{name:"Telegram"})).toHaveAttribute("href","https://t.me/qa_fixture");
});

test("mobile floating CTA renders the fixture product's original tracking tag", async ({ page,isMobile }) => {
  test.skip(!isMobile,"Mobile floating CTA acceptance");
  const response=await page.goto("/deals/Q000000001?market=US");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading",{name:"QA Product 01",exact:true})).toBeVisible();
  const cta=page.getByRole("link",{name:"Continue to Amazon",exact:true});
  await expect(cta).toBeVisible();
  const href=await cta.getAttribute("href");
  expect(href).toBeTruthy();
  const target=new URL(href!);
  expect(target.hostname).toBe("www.amazon.com");
  expect(target.pathname).toBe("/dp/Q000000001");
  expect(target.searchParams.get("tag")).toBe("qa-fixture-us-20");
  const box=await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y+box!.height).toBeGreaterThan(page.viewportSize()!.height-50);
});

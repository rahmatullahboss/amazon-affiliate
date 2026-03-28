import { test, expect } from '@playwright/test';

test.describe('Storefront Disclosures & UI', () => {

  test('P0-004: Renders Amazon Disclosure exactly as required by TOS', async ({ page }) => {
    await page.goto('/');

    // Look for the exact phrasing required by Amazon Associates TOS in the footer
    const mainDisclosure = page.getByText('As an Amazon Associate, we earn from qualifying purchases.');
    await expect(mainDisclosure).toBeVisible();

    // Look for auxiliary disclosure indicating Amazon handles checkout & pricing
    const auxiliaryDisclosure = page.getByText('Product prices and availability are shown on Amazon');
    await expect(auxiliaryDisclosure).toBeVisible();
  });

  test('P2-001: Loads Deals/Categories UI without breaking layout on empty state', async ({ page }) => {
    // Navigate to a category or main deals page
    await page.goto('/');

    // Should load the header
    await expect(page.getByRole('banner')).toBeVisible();

    // Since our database is not seeded by Playwright (it tests against local DB state which may be empty initially)
    // we just want to assert the page doesn't crash (e.g. 500 server error)
    
    // Check if the page title renders correctly
    await expect(page).toHaveTitle(/DealsRKY/i);

    // If it's an empty state, there should ideally be some placeholder text, or at least no Application Error
    const appError = page.locator('text=Application Error').first();
    await expect(appError).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Storefront Disclosures & UI', () => {

  test('P0-004: Renders Amazon Disclosure exactly as required by TOS', async ({ page }) => {
    await page.goto('/');

    const mainDisclosure = page.getByText('As an Amazon Associate, we earn from qualifying purchases.').first();
    await expect(mainDisclosure).toBeVisible();

    const auxiliaryDisclosure = page.getByText(/pricing, inventory, and fulfillment are handled by the retailer/i).first();
    await expect(auxiliaryDisclosure).toBeVisible();
  });

  test('P2-001: Loads Deals/Categories UI without breaking layout on empty state', async ({ page }) => {
    // Navigate to a category or main deals page
    await page.goto('/');

    // Should load the header
    await expect(page.getByRole('banner')).toBeVisible();

    // Since our database is not seeded by Playwright (it tests against local DB state which may be empty initially)
    // we just want to assert the page doesn't crash (e.g. 500 server error)
    
    // Check if the page title renders correctly without Amazon-branded naming
    await expect(page).toHaveTitle(/DealsRky/i);

    // If it's an empty state, there should ideally be some placeholder text, or at least no Application Error
    const appError = page.locator('text=Application Error').first();
    await expect(appError).not.toBeVisible();
  });

  test('P1-003: Shows a mobile floating Amazon CTA on product pages', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Floating CTA is mobile-only');

    await page.goto('/deals/B0DJ3JBT19');

    const floatingCta = page.getByRole('link', { name: /view on amazon/i }).last();
    await expect(floatingCta).toBeVisible();
  });
});

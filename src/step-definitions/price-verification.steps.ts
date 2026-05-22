import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

When('I capture the first discounted product\'s prices from the listing', async function () {
  const page: Page = this.page;

  // Find first product card that has both original and discounted prices
  const productLinks = page.locator('[data-testid="listing-product-link"]');
  const count = await productLinks.count();

  for (let i = 0; i < count; i++) {
    const card = productLinks.nth(i);
    const hasPrimary = await card.locator('[data-testid="listing-product-primary-price"]').count();
    const hasDiscounted = await card.locator('[data-testid="listing-product-price"]').count();

    if (hasPrimary > 0 && hasDiscounted > 0) {
      const originalText = await card.locator('[data-testid="listing-product-primary-price"]').textContent();
      const discountedText = await card.locator('[data-testid="listing-product-price"]').textContent();

      this.listingOriginalPrice = originalText?.trim().replace(/[^0-9.]/g, '') || '';
      this.listingDiscountedPrice = discountedText?.trim().replace(/[^0-9.]/g, '') || '';
      this.discountedProductIndex = i;
      break;
    }
  }

  expect(this.listingOriginalPrice).toBeTruthy();
  expect(this.listingDiscountedPrice).toBeTruthy();
});

When('I click the first discounted product', async function () {
  const page: Page = this.page;

  const card = page.locator('[data-testid="listing-product-link"]').nth(this.discountedProductIndex);
  await Promise.all([
    page.waitForURL(/\.html/, { timeout: 15000 }),
    card.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
});

Then('the detail page prices should match the listing prices', async function () {
  const page: Page = this.page;

  // Original price on detail page (scoped to #product-detail to avoid footer duplicate)
  const detailSection = page.locator('#product-detail');
  const detailOriginal = detailSection.locator('.productPriceInfo-alternatePrice bdi');
  await expect(detailOriginal).toBeVisible({ timeout: 10000 });
  const detailOriginalText = await detailOriginal.textContent();
  const detailOriginalPrice = detailOriginalText?.trim().replace(/[^0-9.]/g, '') || '';

  // Discounted price on detail page
  const detailDiscounted = detailSection.locator('.productPriceInfo-mainPrice bdi');
  await expect(detailDiscounted).toBeVisible();
  const detailDiscountedText = await detailDiscounted.textContent();
  const detailDiscountedPrice = detailDiscountedText?.trim().replace(/[^0-9.]/g, '') || '';

  // Assert prices match
  expect(detailOriginalPrice).toBe(this.listingOriginalPrice);
  expect(detailDiscountedPrice).toBe(this.listingDiscountedPrice);
});

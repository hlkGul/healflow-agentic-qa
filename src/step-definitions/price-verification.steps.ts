import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Extract numeric price string for comparison.
 * Removes currency symbols, whitespace, and normalizes separators.
 * "$ 254.99" → "254.99", "1.999,99 TL" → "1999,99", "€ 36,99" → "36,99"
 */
function extractPrice(text: string | null | undefined): string {
  if (!text) return '';
  // Remove everything except digits, dots, commas
  let price = text.trim().replace(/[^0-9.,]/g, '');
  // Determine format: if both dot and comma exist, the last one is decimal separator
  const lastDot = price.lastIndexOf('.');
  const lastComma = price.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      // 1.999,99 format → remove dots (thousand sep), keep comma as decimal
      price = price.replace(/\./g, '');
    } else {
      // 1,999.99 format → remove commas (thousand sep), keep dot as decimal
      price = price.replace(/,/g, '');
    }
  }
  return price;
}

When('I capture the first discounted product\'s prices from the listing', async function () {
  const page: Page = this.page;

  const products = page.locator('[data-testid="listing-product"]');
  const count = await products.count();

  if (count === 0) {
    return 'pending';
  }

  for (let i = 0; i < count; i++) {
    const card = products.nth(i);
    const hasPrimary = await card.locator('[data-testid="listing-product-primary-price"]').count();
    const hasPrice = await card.locator('[data-testid="listing-product-price"]').count();

    if (hasPrimary > 0 && hasPrice > 0) {
      const originalText = await card.locator('[data-testid="listing-product-primary-price"]').textContent();
      const discountedText = await card.locator('[data-testid="listing-product-price"]').textContent();
      this.listingOriginalPrice = extractPrice(originalText);
      this.listingDiscountedPrice = extractPrice(discountedText);
      this.discountedProductIndex = i;
      break;
    }
  }

  if (!this.listingOriginalPrice || !this.listingDiscountedPrice) {
    return 'pending';
  }
});

When('I click the first discounted product', async function () {
  const page: Page = this.page;

  const card = page.locator('[data-testid="listing-product"]').nth(this.discountedProductIndex);
  const link = card.locator('[data-testid="listing-product-link"]').first();
  await Promise.all([
    page.waitForURL(/\.html/, { timeout: 15000 }),
    link.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
});

Then('the detail page prices should match the listing prices', async function () {
  const page: Page = this.page;

  const priceSection = page.locator('.productPriceInfo').first();

  const altPrice = priceSection.locator('.productPriceInfo-alternatePrice').first();
  const mainPrice = priceSection.locator('.productPriceInfo-mainPrice').first();

  const hasAlt = await altPrice.isVisible({ timeout: 10000 }).catch(() => false);

  if (!hasAlt) {
    return 'pending';
  }

  const detailOriginalPrice = extractPrice(await altPrice.textContent());
  const detailDiscountedPrice = extractPrice(await mainPrice.textContent());

  expect(detailOriginalPrice).toBe(this.listingOriginalPrice);
  expect(detailDiscountedPrice).toBe(this.listingDiscountedPrice);
});


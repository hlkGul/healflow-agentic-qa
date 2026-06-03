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

  const productLinks = page.locator('[data-testid="listing-product-link"]');
  const count = await productLinks.count();

  if (count === 0) {
    return 'pending';
  }

  for (let i = 0; i < count; i++) {
    const card = productLinks.nth(i);
    const hasPrimary = await card.locator('[data-testid="listing-product-primary-price"]').count();
    const hasSecondary = await card.locator('[data-testid="listing-product-secondary-price"]').count();

    if (hasPrimary > 0 && hasSecondary > 0) {
      const originalText = await card.locator('[data-testid="listing-product-primary-price"]').textContent();
      const discountedText = await card.locator('[data-testid="listing-product-secondary-price"]').textContent();
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

  const card = page.locator('[data-testid="listing-product-link"]').nth(this.discountedProductIndex);
  await Promise.all([
    page.waitForURL(/\.html/, { timeout: 15000 }),
    card.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
});

Then('the detail page prices should match the listing prices', async function () {
  const page: Page = this.page;

  const detailSection = page.locator('#product-detail');

  // Try EN/DE structure first (alternatePrice = original, mainPrice = discounted)
  const altPrice = detailSection.locator('.productPriceInfo-alternatePrice bdi');
  const mainPrice = detailSection.locator('.productPriceInfo-mainPrice bdi');

  const hasAlt = await altPrice.isVisible({ timeout: 10000 }).catch(() => false);

  let detailOriginalPrice: string;
  let detailDiscountedPrice: string;

  if (hasAlt) {
    detailOriginalPrice = extractPrice(await altPrice.textContent());
    detailDiscountedPrice = extractPrice(await mainPrice.textContent());
  } else {
    // TR structure: mainPrice = original, campaignText contains discounted
    const mainText = await mainPrice.textContent().catch(() => null);
    const campaignEl = detailSection.locator('.productPriceInfo-campaignText');
    const campaignText = await campaignEl.textContent().catch(() => null);
    detailOriginalPrice = extractPrice(mainText);
    // Campaign text format: "%25 İNDİRİMLİ 1.499,99 TL" — extract price portion
    const priceMatch = campaignText?.match(/[\d.,]+/g);
    detailDiscountedPrice = extractPrice(priceMatch ? priceMatch[priceMatch.length - 1] : null);
  }

  expect(detailOriginalPrice).toBe(this.listingOriginalPrice);
  expect(detailDiscountedPrice).toBe(this.listingDiscountedPrice);
});


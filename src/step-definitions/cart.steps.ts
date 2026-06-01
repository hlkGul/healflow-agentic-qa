import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { getBaseUrl } from '../support/environment.js';

When('I click the first product from results', async function () {
  const page: Page = this.page;
  const productLink = page.locator('[data-testid="listing-product-link"]').nth(1);
  const href = await productLink.getAttribute('href') ?? '';
  await Promise.all([
    page.waitForURL(/\.html/, { timeout: 15000 }),
    productLink.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');

  // Store product URL slug for basket verification
  this.productSlug = href.split('/').pop()?.replace('.html', '') ?? '';
});

When('I select an available size', async function () {
  const page: Page = this.page;
  const sizeSelect = page.locator('#product-detail').getByRole('combobox');
  await expect(sizeSelect).toBeVisible({ timeout: 10000 });

  // Pick the first real size option (skip "Choose Size")
  const options = await sizeSelect.locator('option').allTextContents();
  const availableSize = options.find(opt => opt.trim() !== '' && opt !== 'Choose Size');
  expect(availableSize).toBeTruthy();

  await sizeSelect.selectOption({ label: availableSize! });
  this.selectedSize = availableSize!.trim();
});

When('I click the {string} button', async function (buttonName: string) {
  const page: Page = this.page;
  await page.getByRole('button', { name: buttonName }).click();
  // Wait for cart update
  await page.waitForTimeout(2000);
});

When('I navigate to the basket page', async function () {
  const page: Page = this.page;
  await page.goto(`${getBaseUrl()}/en/basket/`);
  await page.waitForLoadState('domcontentloaded');
});

Then('I should see the product in the basket', async function () {
  const page: Page = this.page;

  // Verify basket has items
  const basketHeading = page.getByRole('heading', { name: /Basket \(\d+ Item/ });
  await expect(basketHeading).toBeVisible({ timeout: 10000 });

  // Verify the product exists in basket (attached to DOM)
  const productInBasket = page.locator(`a[href*="${this.productSlug}"]`);
  await expect(productInBasket.first()).toBeAttached({ timeout: 10000 });
});

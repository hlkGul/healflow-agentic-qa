import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

When('I click the favorite icon on the first product', async function () {
  const page: Page = this.page;

  const firstProduct = page.locator('[data-testid="listing-product"]').first();
  const favIcon = firstProduct.locator('[data-testid="unfavorited-icon"]');
  await expect(favIcon).toBeVisible({ timeout: 10000 });
  await favIcon.click();
});

Then('the favorite icon should change to favorited state', async function () {
  const page: Page = this.page;

  const firstProduct = page.locator('[data-testid="listing-product"]').first();
  const favoritedIcon = firstProduct.locator('[data-testid="favorited-icon"]');
  await expect(favoritedIcon).toBeAttached({ timeout: 5000 });
});

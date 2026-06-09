import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

When('I type {string} in the search input', async function (searchText: string) {
  const page: Page = this.page;
  const searchInput = page.getByPlaceholder('Search Item, Category or Brand');
  await searchInput.fill(searchText);
});

When('I press {string} in the search input', async function (key: string) {
  const page: Page = this.page;
  const searchInput = page.getByPlaceholder('Search Item, Category or Brand');
  await searchInput.press(key);
});

Then('I should see search results for {string}', async function (searchTerm: string) {
  const page: Page = this.page;
  await page.waitForURL(new RegExp(searchTerm), { timeout: 15000 });
  // Intentionally broken assertion to test issue creation
  await expect(page).toHaveURL(/this-url-will-never-match/, { timeout: 5000 });
});

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

When('I type {string} in the search input', async function (searchText: string) {
  const page: Page = this.page;
  const searchInput = page.getByRole('textbox', { name: /Search|Ara/i });
  await searchInput.fill(searchText);
});

When('I press {string} in the search input', async function (key: string) {
  const page: Page = this.page;
  const searchInput = page.getByRole('textbox', { name: /Search|Ara/i });
  await searchInput.press(key);
});

Then('I should see search results for {string}', async function (searchTerm: string) {
  const page: Page = this.page;
  await page.waitForURL(new RegExp(searchTerm), { timeout: 15000 });
  await expect(page).toHaveURL(new RegExp(searchTerm));
});

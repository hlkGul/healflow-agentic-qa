import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

Given('I navigate to the Modanisa homepage', async function () {
  const page: Page = this.page;
  await page.goto('https://www.modanisa.com');
});

When('I type {string} in the search input', async function (searchText: string) {
  const page: Page = this.page;
  // Locator: search input
  await page.getByPlaceholder('Ara').fill(searchText);
});

When('I press {string} in the search input', async function (key: string) {
  const page: Page = this.page;
  // Locator: search input
  await page.getByPlaceholder('Ara').press(key);
});

Then('I should see search results for {string}', async function (searchTerm: string) {
  const page: Page = this.page;
  await page.waitForURL(new RegExp(searchTerm));
  await expect(page).toHaveURL(new RegExp(searchTerm));
});

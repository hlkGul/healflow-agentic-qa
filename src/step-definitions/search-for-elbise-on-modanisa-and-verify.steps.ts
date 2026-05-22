import { expect, Page } from '@playwright/test';
import { Locator } from 'playwright';

export const searchSteps = () => {
  let page: Page;

  Given('I navigate to the Modanisa homepage', async () => {
    await page.goto('https://www.modanisa.com');
  });

  When('I type {string} in the search input', async (searchText: string) => {
    await page.getByPlaceholder('Ara').fill(searchText);
  });

  When('I press {string} in the search input', async (key: string) => {
    await page.getByPlaceholder('Ara').press(key);
  });

  Then('I should see search results for {string}', async (searchTerm: string) => {
    await page.waitForURL(new RegExp(searchTerm));
    await expect(page).toHaveURL(new RegExp(searchTerm));
  });

  return {
    Given,
    When,
    Then,
  };
};
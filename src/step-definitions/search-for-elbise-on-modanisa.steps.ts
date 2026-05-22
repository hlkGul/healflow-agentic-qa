import { expect, Page } from '@playwright/test';
import { Locator } from 'playwright';

export const searchSteps = () => {
  let page: Page;

  Given('I navigate to the Modanisa homepage', async () => {
    await page.goto('https://www.modanisa.com');
  });

  When('I type {string} in the search input', async (searchText: string) => {
    const searchInput = page.getByPlaceholder('Ara');
    await searchInput.type(searchText);
  });

  When('I press {string} in the search input', async (key: string) => {
    const searchInput = page.getByPlaceholder('Ara');
    await searchInput.press(key);
  });

  Then('I should see the search results page for {string}', async (searchTerm: string) => {
    await page.waitForURL(new RegExp(searchTerm));
  });

  return {
    Given,
    When,
    Then,
    setPage: (currentPage: Page) => {
      page = currentPage;
    },
  };
};
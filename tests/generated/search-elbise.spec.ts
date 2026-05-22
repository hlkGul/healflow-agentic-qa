import { test, expect, Page } from '@playwright/test';

test('Search for elbise on Modanisa', async ({ page }) => {
  // Step 1: Navigate to Modanisa homepage
  await page.goto('https://www.modanisa.com');

  // Step 2: Type "elbise" in the search input
  // Locator: Search input
  const searchInput = page.getByPlaceholder('Ara');
  await searchInput.type('elbise');

  // Step 3: Press "Enter" in the search input
  await searchInput.press('Enter');

  // Step 4: Wait for the search results page to load
  await page.waitForURL(/elbise/);

  // Expected results: Search results page for 'elbise' is displayed
});
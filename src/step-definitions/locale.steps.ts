import { Given } from '@cucumber/cucumber';
import type { Page } from '@playwright/test';
import { setLocale } from '../support/locale.js';

Given('I open the site in {string} country with {string} language', async function (country: string, language: string) {
  const page: Page = this.page;
  await setLocale(page.context(), country, language);
  await page.goto('https://www.modanisa.com');
  await page.waitForLoadState('domcontentloaded');
});

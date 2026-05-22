import { Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

setDefaultTimeout(30_000);

let browser: Browser;
let context: BrowserContext;
let page: Page;

Before(async function () {
  browser = await chromium.launch({
    headless: !!process.env['CI'],
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  page = await context.newPage();
  this.page = page;
});

After(async function () {
  await context?.close();
  await browser?.close();
});

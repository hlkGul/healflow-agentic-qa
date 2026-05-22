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

  // Force English locale via cookies (site uses IP-based detection, cookies override it)
  await context.addCookies([
    { name: 'user_shipping_data', value: '%7B%22currency%22%3A%22USD%22%2C%22country_id%22%3A38%2C%22country_code%22%3A%22US%22%2C%22ip_welcome%22%3A%22%22%2C%22ip_country_id%22%3A%2238%22%2C%22ip_country_code%22%3A%22US%22%2C%22customer_language%22%3A%22EN%22%7D', domain: '.modanisa.com', path: '/' },
    { name: 'customer-shipping-country-id-1', value: '38', domain: '.modanisa.com', path: '/' },
    { name: 'customer-language-1', value: 'EN', domain: '.modanisa.com', path: '/' },
  ]);

  page = await context.newPage();

  // Auto-dismiss popups whenever they appear during any test step
  await page.addLocatorHandler(
    page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'),
    async () => {
      await page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll').click();
    }
  );
  await page.addLocatorHandler(
    page.locator('.welcomePopupInfo-active'),
    async () => {
      await page.locator('.welcomePopupInfo-active').getByText('Continue Shopping').click();
    }
  );

  this.page = page;
});

After(async function () {
  await context?.close();
  await browser?.close();
});

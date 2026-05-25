import { Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

setDefaultTimeout(60_000);

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

  // Auto-dismiss popups whenever they appear during any test step
  await page.addLocatorHandler(
    page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'),
    async () => {
      try {
        await page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll').click({ timeout: 2000 });
      } catch {
        await page.keyboard.press('Escape');
      }
    }
  );
  await page.addLocatorHandler(
    page.locator('.welcomePopupInfo-active'),
    async () => {
      try {
        await page.locator('.welcomePopupInfo-button').click({ timeout: 2000 });
      } catch {
        // Fallback: close icon or escape
        const closeIcon = page.locator('.welcomePopupInfo-topCloseIcon');
        if (await closeIcon.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeIcon.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }
  );

  this.page = page;
});

After(async function () {
  await context?.close();
  await browser?.close();
});

import { chromium, type Browser, type Page } from '@playwright/test';
import { getAccessibilitySnapshot } from '../utils/accessibility.js';
import { setLocale } from '../support/locale.js';
import type { AccessibilitySnapshot } from '../types/index.js';
import type { ContextProvider, CaptureOptions } from './context-provider.js';

/**
 * Launches a real browser to capture accessibility snapshot.
 * Reuses browser instance across multiple calls for efficiency.
 */
export class BrowserContextProvider implements ContextProvider {
  name = 'browser';
  private browser: Browser | null = null;

  async captureSnapshot(url: string, options?: CaptureOptions): Promise<AccessibilitySnapshot> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const context = await this.browser.newContext({ viewport: { width: 1280, height: 720 } });

    try {
      if (options?.locale) {
        await setLocale(context, options.locale.country, options.locale.language);
      }

      const page = await context.newPage();
      const timeout = options?.timeout ?? 15000;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

      // Replay actions if provided
      if (options?.replayActions) {
        await this.replayActions(page, options.replayActions);
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return await getAccessibilitySnapshot(page);
    } finally {
      await context.close();
    }
  }

  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async replayActions(page: Page, actions: CaptureOptions['replayActions']): Promise<void> {
    if (!actions) return;

    for (const action of actions) {
      try {
        if (action.type === 'goto') {
          await page.goto(action.value, { timeout: 10000 });
        } else if (action.type === 'fill') {
          await page.locator(action.selector).fill(action.value, { timeout: 5000 });
        } else if (action.type === 'press') {
          await page.locator(action.selector).press(action.value, { timeout: 5000 });
        } else if (action.type === 'click') {
          await page.locator(action.selector).click({ timeout: 5000 });
        }
      } catch {
        break; // Stop at first failure — capture tree at this point
      }
    }
  }
}

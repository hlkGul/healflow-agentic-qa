import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { getAccessibilitySnapshot, truncateTree } from './accessibility.js';
import { saveHealingRecord, formatHistoryContext } from './healing-registry.js';
import { setLocale } from '../support/locale.js';
import { getBaseUrl, getDomain } from '../support/environment.js';
import { HealerEngine } from '../healing/index.js';
import type { HealingContext } from '../healing/types.js';
import type { HealingRecord, LocatorInfo } from '../types/index.js';

const STEPS_DIR = resolve(process.cwd(), 'src', 'step-definitions');

export interface HealResult {
  healed: boolean;
  file?: string;
  locator?: string;
  reasoning?: string;
}

/**
 * Attempt to heal broken locators in step definition files.
 * Uses strategy chain: rule-based first, then LLM fallback.
 */
export async function healFromError(errorOutput: string): Promise<HealResult> {
  const stepFiles = getStepFiles();
  if (stepFiles.length === 0) {
    return { healed: false };
  }

  const allStepCode = stepFiles
    .map((f) => `// File: ${f}\n${readFileSync(f, 'utf-8')}`)
    .join('\n\n');

  // Determine the correct page context from error output
  const targetUrl = extractTargetUrl(errorOutput);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    // Set English locale by default for consistent a11y tree
    await setLocale(context, 'USA', 'en');

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // If the error happened on a search results page, replay the search
    const searchTerm = extractSearchTerm(errorOutput);
    if (searchTerm && targetUrl.includes(getDomain().replace('.', '')) && !targetUrl.includes('/search')) {
      const searchInput = page.locator('#search-input');
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill(searchTerm);
        await searchInput.press('Enter');
        await page.waitForURL(/search|q=/, { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    const snapshot = await getAccessibilitySnapshot(page);
    const treeContext = truncateTree(snapshot.raw);
    const historyContext = formatHistoryContext('unknown element');

    // Use strategy chain: rule-based → LLM
    const healerEngine = new HealerEngine();
    const healingContext: HealingContext = {
      errorMessage: errorOutput.slice(0, 1000),
      code: allStepCode,
      snapshot: { ...snapshot, raw: treeContext },
      history: historyContext,
    };

    const suggestion = await healerEngine.heal(healingContext);
    if (!suggestion) return { healed: false };

    // Apply fix
    for (const file of stepFiles) {
      const code = readFileSync(file, 'utf-8');
      const fixedCode = applyLocatorFix(code, errorOutput, suggestion.locator);
      if (fixedCode !== code) {
        writeFileSync(file, fixedCode, 'utf-8');

        const record: HealingRecord = {
          id: `heal-${Date.now()}`,
          timestamp: new Date().toISOString(),
          element: suggestion.locator.description,
          originalLocator: { description: 'broken', strategy: 'getByRole', value: 'unknown', line: 0 },
          healedLocator: suggestion.locator,
          reason: suggestion.reasoning,
          success: false,
          accessibilityContext: treeContext.slice(0, 300),
        };
        saveHealingRecord(record);

        return {
          healed: true,
          file,
          locator: `${suggestion.locator.strategy}(${suggestion.locator.value})`,
          reasoning: suggestion.reasoning,
        };
      }
    }

    return { healed: false };
  } finally {
    await browser.close();
  }
}

/**
 * Extract the most relevant URL from error output for a11y tree capture.
 */
function extractTargetUrl(errorOutput: string): string {
  // Look for URLs in the error that indicate which page the test was on
  const urlPatterns = [
    /https?:\/\/(?:www\.modanisa\.com|web-dev\.modanisa\.net)[^\s"')]+/g,
    /page\.goto\(['"]([^'"]+)['"]\)/,
  ];

  for (const pattern of urlPatterns) {
    const matches = errorOutput.match(pattern);
    if (matches && matches.length > 0) {
      // Return the last URL found (most likely the failing page)
      const url = matches[matches.length - 1]!;
      // Clean up: remove trailing punctuation
      return url.replace(/['")\]]+$/, '');
    }
  }

  return getBaseUrl();
}

/**
 * Extract search term from error output if test was performing a search.
 */
function extractSearchTerm(errorOutput: string): string | null {
  const patterns = [
    /fill\(['"]([^'"]+)['"]\)/,
    /type.*["']([^"']+)["'].*search/i,
    /search.*["']([^"']+)["']/i,
    /q=([^&\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(errorOutput);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function getStepFiles(): string[] {
  if (!existsSync(STEPS_DIR)) return [];
  return readdirSync(STEPS_DIR)
    .filter((f) => f.endsWith('.steps.ts'))
    .map((f) => join(STEPS_DIR, f));
}

export function applyLocatorFix(code: string, errorMessage: string, newLocator: LocatorInfo): string {
  const patterns = [
    /Locator:\s*(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
    /waiting for (getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
    /locator\('([^']+)'\)/,
  ];

  const newPattern = `.${newLocator.strategy}(${newLocator.value})`;

  for (const pattern of patterns) {
    const match = pattern.exec(errorMessage);
    if (match) {
      const oldStrategy = match[1];
      const oldValue = match[2];

      if (oldStrategy && oldValue) {
        const oldPattern = `.${oldStrategy}(${oldValue})`;
        if (code.includes(oldPattern)) {
          return code.replaceAll(oldPattern, newPattern);
        }

        // Try with quotes normalized
        const oldPatternAlt = `.${oldStrategy}('${oldValue.replace(/'/g, '')}')`;
        if (code.includes(oldPatternAlt)) {
          return code.replaceAll(oldPatternAlt, newPattern);
        }
      }
    }
  }

  return code;
}

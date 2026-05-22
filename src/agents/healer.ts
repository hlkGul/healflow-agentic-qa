import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { callGeminiWithJson } from '../utils/gemini-client.js';
import { getAccessibilitySnapshot, truncateTree } from '../utils/accessibility.js';
import { saveHealingRecord, formatHistoryContext } from '../utils/healing-registry.js';
import type { HealingAttempt, HealingRecord, LocatorInfo } from '../types/index.js';
import type { GraphStateType } from '../graph/state.js';

const HEALER_SYSTEM_PROMPT = `You are a Playwright Locator Healer agent. A test failed because a locator could not find an element. Your job is to suggest a new locator based on the accessibility tree.

STRICT RULES:
1. ONLY suggest Playwright user-facing locators:
   - page.getByRole('role', { name: 'text' })
   - page.getByText('text')
   - page.getByLabel('label')
   - page.getByPlaceholder('placeholder')
   - page.getByTestId('testid')

2. NEVER suggest XPath or CSS selectors

3. Analyze the accessibility tree to find the correct element

4. Consider the healing history — avoid suggesting locators that failed before

5. The "value" field must contain ONLY the arguments inside the parentheses.
   Examples:
   - strategy: "getByRole", value: "'link', { name: 'Elbise' }"
   - strategy: "getByText", value: "'Sonuçlar'"
   - strategy: "getByPlaceholder", value: "'Ara'"
   DO NOT repeat the strategy name in the value field.

OUTPUT SCHEMA:
{
  "suggestedLocator": {
    "description": "human-readable description of the element",
    "strategy": "getByRole|getByText|getByLabel|getByPlaceholder|getByTestId",
    "value": "ONLY the arguments — e.g. 'link', { name: 'Elbise' }",
    "line": 0
  },
  "reasoning": "why this locator should work based on the accessibility tree"
}`;

export async function healerAgent(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const { generatedCode, executionResult, healingAttempts, currentRetry, maxRetries } = state;

  if (!generatedCode || !executionResult?.error) {
    return {
      phase: 'failed',
      errorLog: ['[Healer] No code or error to heal'],
    };
  }

  if (currentRetry >= maxRetries) {
    return {
      phase: 'failed',
      errorLog: [`[Healer] Max retries (${maxRetries}) reached. Test cannot be healed.`],
    };
  }

  // Get fresh accessibility tree from the target page
  const a11ySnapshot = await captureAccessibilityTree(state.intent.targetUrl, generatedCode.code);
  const treeContext = truncateTree(a11ySnapshot.raw);

  // Get healing history for context
  const errorElement = executionResult.error.locatorInfo?.description ?? 'unknown element';
  const historyContext = formatHistoryContext(errorElement);

  // Ask Gemini for a healing suggestion
  const userPrompt = buildHealerPrompt(
    executionResult.error.message,
    generatedCode.code,
    treeContext,
    historyContext
  );

  const suggestion = await callGeminiWithJson<{ suggestedLocator: LocatorInfo; reasoning: string }>(
    HEALER_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 1024, temperature: 0.1 }
  );

  const attempt: HealingAttempt = {
    attemptNumber: currentRetry + 1,
    suggestedLocator: suggestion.suggestedLocator,
    reasoning: suggestion.reasoning,
  };

  // Apply the fix to the test code
  const fixedCode = applyLocatorFix(
    generatedCode.code,
    executionResult.error.message,
    suggestion.suggestedLocator
  );

  // Write updated code
  writeFileSync(generatedCode.filePath, fixedCode, 'utf-8');

  // Save healing record
  const record: HealingRecord = {
    id: `heal-${Date.now()}`,
    timestamp: new Date().toISOString(),
    element: errorElement,
    originalLocator: executionResult.error.locatorInfo ?? {
      description: errorElement,
      strategy: 'getByRole',
      value: 'unknown',
      line: 0,
    },
    healedLocator: suggestion.suggestedLocator,
    reason: suggestion.reasoning,
    success: false, // Will be updated after re-run
    accessibilityContext: treeContext.slice(0, 500),
  };
  saveHealingRecord(record);

  return {
    phase: 'running',
    generatedCode: {
      ...generatedCode,
      code: fixedCode,
    },
    healingAttempts: [...healingAttempts, attempt],
    accessibilitySnapshot: a11ySnapshot,
    currentRetry: currentRetry + 1,
    errorLog: [
      `[Healer] Attempt ${currentRetry + 1}/${maxRetries}: ${suggestion.reasoning}`,
      `[Healer] New locator: ${suggestion.suggestedLocator.strategy}('${suggestion.suggestedLocator.value}')`,
    ],
  };
}

async function captureAccessibilityTree(url: string, testCode: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Replay test actions up to the failure point using Playwright API
    const actions = extractActionsFromCode(testCode);
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
        // Stop at first failure — capture tree at this point
        break;
      }
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    const snapshot = await getAccessibilitySnapshot(page);
    return snapshot;
  } finally {
    await browser.close();
  }
}

interface ParsedAction {
  type: 'goto' | 'fill' | 'press' | 'click';
  selector: string;
  value: string;
}

function extractActionsFromCode(code: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // page.goto('url')
    const gotoMatch = /await\s+page\.goto\(['"]([^'"]+)['"]\)/.exec(trimmed);
    if (gotoMatch) {
      actions.push({ type: 'goto', selector: '', value: gotoMatch[1]! });
      continue;
    }

    // page.getByXxx('...').fill('value') or variable.fill('value')
    const fillMatch = /(?:page\.(getBy\w+)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)|(\w+))\.fill\(['"]([^'"]+)['"]\)/.exec(trimmed);
    if (fillMatch) {
      const strategy = fillMatch[1];
      const args = fillMatch[2];
      if (strategy && args) {
        actions.push({ type: 'fill', selector: `${strategy}(${args})`, value: fillMatch[4]! });
      }
      continue;
    }

    // page.getByXxx('...').press('key')
    const pressMatch = /(?:page\.(getBy\w+)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)|(\w+))\.press\(['"]([^'"]+)['"]\)/.exec(trimmed);
    if (pressMatch) {
      const strategy = pressMatch[1];
      const args = pressMatch[2];
      if (strategy && args) {
        actions.push({ type: 'press', selector: `${strategy}(${args})`, value: pressMatch[4]! });
      }
      continue;
    }

    // page.getByXxx('...').click()
    const clickMatch = /(?:page\.(getBy\w+)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)|(\w+))\.click\(\)/.exec(trimmed);
    if (clickMatch) {
      const strategy = clickMatch[1];
      const args = clickMatch[2];
      if (strategy && args) {
        actions.push({ type: 'click', selector: `${strategy}(${args})`, value: '' });
      }
      continue;
    }
  }

  return actions;
}

function buildHealerPrompt(
  errorMessage: string,
  testCode: string,
  treeContext: string,
  historyContext: string
): string {
  return `A Playwright test failed with a locator error. Suggest a fix.

ERROR (first 500 chars):
${errorMessage.slice(0, 500)}

CURRENT TEST CODE:
${testCode}

ACCESSIBILITY TREE OF THE PAGE (after navigation/actions completed):
${treeContext}

HEALING HISTORY:
${historyContext}

IMPORTANT: Look at what the test is trying to verify. Find an element in the accessibility tree that satisfies the test's intent. The element might have a different role/name than expected.

Suggest a new locator that will find the correct element. Remember: value field = ONLY the arguments inside parentheses.`;
}

function applyLocatorFix(
  code: string,
  errorMessage: string,
  newLocator: LocatorInfo
): string {
  // Extract the failing locator from Playwright's error output
  const patterns = [
    /Locator:\s*(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
    /waiting for (getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
  ];

  const newPattern = `.${newLocator.strategy}(${newLocator.value})`;

  for (const pattern of patterns) {
    const match = pattern.exec(errorMessage);
    if (match) {
      const oldStrategy = match[1];
      const oldValue = match[2];
      const oldPattern = `.${oldStrategy}(${oldValue})`;

      // Replace ALL occurrences of the broken locator
      if (code.includes(oldPattern)) {
        return code.replaceAll(oldPattern, newPattern);
      }

      // Try with quotes normalized
      const oldPatternAlt = `.${oldStrategy}('${oldValue?.replace(/'/g, '')}')`;
      if (code.includes(oldPatternAlt)) {
        return code.replaceAll(oldPatternAlt, newPattern);
      }
    }
  }

  // Fallback: find the failing line from error output and fix it
  const lineRegex = />\s*(\d+)\s*\|/;
  const lineMatch = lineRegex.exec(errorMessage);
  if (lineMatch) {
    const errorLine = parseInt(lineMatch[1]!, 10) - 1;
    const lines = code.split('\n');
    if (lines[errorLine]) {
      const locatorInLine = /\.(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\([^)]*(?:\{[^}]*\}[^)]*)??\)/;
      const m = locatorInLine.exec(lines[errorLine]!);
      if (m) {
        lines[errorLine] = lines[errorLine]!.replace(m[0], newPattern);
        return lines.join('\n');
      }
    }
  }

  return code;
}

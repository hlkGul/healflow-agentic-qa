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
   - getByRole('role', { name: 'text' })
   - getByText('text')
   - getByLabel('label')
   - getByPlaceholder('placeholder')
   - getByTestId('testid')

2. NEVER suggest XPath or CSS selectors

3. Analyze the accessibility tree to find the correct element

4. Consider the healing history — avoid suggesting locators that failed before

OUTPUT SCHEMA:
{
  "suggestedLocator": {
    "description": "human-readable description of the element",
    "strategy": "getByRole|getByText|getByLabel|getByPlaceholder|getByTestId",
    "value": "the locator argument string, e.g. role('searchbox', { name: 'Ara' })",
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
  const a11ySnapshot = await captureAccessibilityTree(state.intent.targetUrl);
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

async function captureAccessibilityTree(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const snapshot = await getAccessibilitySnapshot(page);
    return snapshot;
  } finally {
    await browser.close();
  }
}

function buildHealerPrompt(
  errorMessage: string,
  testCode: string,
  treeContext: string,
  historyContext: string
): string {
  return `A Playwright test failed with a locator error. Suggest a fix.

ERROR:
${errorMessage}

CURRENT TEST CODE:
${testCode}

ACCESSIBILITY TREE OF THE PAGE:
${treeContext}

HEALING HISTORY:
${historyContext}

Suggest a new locator that will find the correct element.`;
}

function applyLocatorFix(
  code: string,
  errorMessage: string,
  newLocator: LocatorInfo
): string {
  // Find the failing locator pattern in the error message
  const locatorRegex = /\.(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]+)\)/;
  const errorMatch = locatorRegex.exec(errorMessage);

  if (errorMatch) {
    const oldPattern = errorMatch[0];
    const newPattern = `.${newLocator.strategy}(${newLocator.value})`;
    return code.replace(oldPattern, newPattern);
  }

  // Fallback: if we can't find exact match, try replacing by line number
  if (newLocator.line > 0) {
    const lines = code.split('\n');
    const targetLine = lines[newLocator.line - 1];
    if (targetLine) {
      const lineMatch = locatorRegex.exec(targetLine);
      if (lineMatch) {
        const newPattern = `.${newLocator.strategy}(${newLocator.value})`;
        lines[newLocator.line - 1] = targetLine.replace(lineMatch[0], newPattern);
        return lines.join('\n');
      }
    }
  }

  return code;
}

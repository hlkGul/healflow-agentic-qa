import { writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { callGemini } from '../utils/gemini-client.js';
import type { AcceptanceCriteria, GeneratedTestCode, LocatorInfo } from '../types/index.js';
import type { GraphStateType } from '../graph/state.js';

const GENERATOR_SYSTEM_PROMPT = `You are a Playwright Test Generator agent. You generate TypeScript test code from acceptance criteria.

STRICT RULES:
1. ONLY use Playwright user-facing locators:
   - page.getByRole('role', { name: 'text' })
   - page.getByText('text')
   - page.getByLabel('label')
   - page.getByPlaceholder('placeholder')
   - page.getByTestId('testid')
   NEVER use: page.locator('css'), page.$('xpath'), complex selectors

2. NEVER use page.waitForTimeout() — use web-first assertions:
   - await expect(locator).toBeVisible()
   - await expect(locator).toHaveText('text')
   - await expect(page).toHaveURL(/pattern/)

3. Use strict TypeScript — no 'any' type

4. Import from '@playwright/test': test, expect, Page

5. Structure:
   - import { test, expect } from '@playwright/test';
   - test('descriptive name', async ({ page }) => { ... });

6. Add a comment above each locator line: // Locator: <description>

7. For search flows:
   - After typing in a search input, use keyboard.press('Enter') to submit
   - Do NOT look for a search button unless explicitly mentioned
   - After submitting search, ALWAYS wait for navigation: await page.waitForURL(/pattern/)
   - Then verify results on the NEW page (listing page), not the homepage

8. After any action that triggers navigation, wait for the new page:
   - await page.waitForURL(/expected-pattern/) or await page.waitForLoadState('networkidle')
   - Then perform assertions on the loaded page

OUTPUT: Only the TypeScript test code, no markdown fences, no explanation.`;

export async function generatorAgent(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const { criteria, intent } = state;

  if (!criteria) {
    return {
      phase: 'failed',
      errorLog: ['[Generator] No criteria available to generate code from'],
    };
  }

  const userPrompt = buildGeneratorPrompt(criteria, intent.targetUrl);
  const response = await callGemini(GENERATOR_SYSTEM_PROMPT, userPrompt, {
    maxTokens: 4096,
    temperature: 0.1,
  });

  let code = response.text.trim();
  // Strip markdown fences if LLM wraps them anyway
  code = code.replace(/^```typescript?\n?/m, '').replace(/\n?```$/m, '');

  const locators = extractLocators(code);
  const fileName = `test-${Date.now()}.spec.ts`;
  const generatedDir = resolve(process.cwd(), 'tests', 'generated');

  // Clean old generated tests
  if (!existsSync(generatedDir)) mkdirSync(generatedDir, { recursive: true });
  const oldFiles = readdirSync(generatedDir).filter((f) => f.endsWith('.spec.ts'));
  for (const f of oldFiles) unlinkSync(join(generatedDir, f));

  const filePath = join(generatedDir, fileName);
  writeFileSync(filePath, code, 'utf-8');

  const generatedCode: GeneratedTestCode = {
    code,
    filePath,
    locators,
  };

  return {
    phase: 'running',
    generatedCode,
    errorLog: [`[Generator] Generated test with ${locators.length} locators → ${fileName}`],
  };
}

function buildGeneratorPrompt(criteria: AcceptanceCriteria, targetUrl: string): string {
  const stepsText = criteria.steps
    .map((s) => `${s.order}. ${s.action}: ${s.target}${s.value ? ` → "${s.value}"` : ''}`)
    .join('\n');

  const expectedText = criteria.expectedResults.map((r) => `- ${r}`).join('\n');

  return `Generate a Playwright test for:

TITLE: ${criteria.title}
BASE URL: ${targetUrl}

PRECONDITIONS:
${criteria.preconditions.map((p) => `- ${p}`).join('\n')}

STEPS:
${stepsText}

EXPECTED RESULTS:
${expectedText}

Generate the complete TypeScript test file.`;
}

function extractLocators(code: string): LocatorInfo[] {
  const locators: LocatorInfo[] = [];
  const lines = code.split('\n');

  const locatorRegex = /\.(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]+)\)/;
  const commentRegex = /\/\/\s*Locator:\s*(.+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const match = locatorRegex.exec(line);
    if (match) {
      const strategy = match[1] as LocatorInfo['strategy'];
      const value = match[2]?.replace(/['"]/g, '') ?? '';

      // Check previous line for description comment
      const prevLine = lines[i - 1] ?? '';
      const commentMatch = commentRegex.exec(prevLine);
      const description = commentMatch?.[1]?.trim() ?? `${strategy} element`;

      locators.push({
        description,
        strategy,
        value,
        line: i + 1,
      });
    }
  }

  return locators;
}

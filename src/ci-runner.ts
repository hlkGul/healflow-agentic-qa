import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { callGeminiWithJson } from './utils/gemini-client.js';
import { getAccessibilitySnapshot, truncateTree } from './utils/accessibility.js';
import { classifyError } from './utils/error-classifier.js';
import { saveHealingRecord, formatHistoryContext } from './utils/healing-registry.js';
import type { HealingRecord, LocatorInfo } from './types/index.js';

const MAX_HEAL_RETRIES = 3;
const TEST_DIR = resolve(process.cwd(), 'tests', 'generated');

interface TestResult {
  file: string;
  passed: boolean;
  healed: boolean;
  healAttempts: number;
  error?: string;
}

const HEALER_PROMPT = `You are a Playwright Locator Healer. A test failed because a locator could not find an element. Suggest a fix.

RULES:
1. ONLY suggest user-facing locators: getByRole, getByText, getByLabel, getByPlaceholder, getByTestId
2. The "value" field = ONLY the arguments inside parentheses
   Examples: "'link', { name: 'Elbise' }" or "'Ara'" or "'searchbox', { name: 'Search' }"
3. Analyze the accessibility tree to find the correct element

OUTPUT JSON:
{
  "suggestedLocator": {
    "description": "element description",
    "strategy": "getByRole|getByText|getByLabel|getByPlaceholder|getByTestId",
    "value": "arguments only",
    "line": 0
  },
  "reasoning": "why this works"
}`;

async function main() {
  console.log('🔄 CI Pipeline: Run existing tests + self-heal');
  console.log('═'.repeat(60));

  const testFiles = getTestFiles();
  if (testFiles.length === 0) {
    console.log('⚠️  No test files found in tests/generated/');
    process.exit(0);
  }

  console.log(`📂 Found ${testFiles.length} test file(s)`);
  const results: TestResult[] = [];
  let anyHealed = false;

  for (const file of testFiles) {
    console.log(`\n▶️  Running: ${file}`);
    const result = await runAndHeal(file);
    results.push(result);
    if (result.healed) anyHealed = true;
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 PIPELINE RESULTS');
  console.log('═'.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const healed = results.filter((r) => r.healed).length;

  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  🔧 Healed: ${healed}`);

  if (anyHealed) {
    console.log('\n🔧 Tests were healed. Changes committed.');
  }

  // Exit with failure if any test still fails
  if (failed > 0) {
    process.exit(1);
  }
}

function getTestFiles(): string[] {
  if (!existsSync(TEST_DIR)) return [];
  return readdirSync(TEST_DIR)
    .filter((f) => f.endsWith('.spec.ts'))
    .map((f) => join(TEST_DIR, f));
}

async function runAndHeal(filePath: string): Promise<TestResult> {
  for (let attempt = 0; attempt <= MAX_HEAL_RETRIES; attempt++) {
    const { success, stdout, stderr } = runTest(filePath);

    if (success) {
      return {
        file: filePath,
        passed: true,
        healed: attempt > 0,
        healAttempts: attempt,
      };
    }

    const errorOutput = stderr || stdout;
    const classification = classifyError(errorOutput, stderr);

    if (!classification.shouldHeal) {
      console.log(`  ❌ Non-healable error: ${classification.type}`);
      return {
        file: filePath,
        passed: false,
        healed: false,
        healAttempts: attempt,
        error: classification.message,
      };
    }

    if (attempt >= MAX_HEAL_RETRIES) {
      console.log(`  ❌ Max heal retries reached`);
      return {
        file: filePath,
        passed: false,
        healed: false,
        healAttempts: attempt,
        error: classification.message,
      };
    }

    console.log(`  🔧 Heal attempt ${attempt + 1}/${MAX_HEAL_RETRIES}...`);
    const healed = await healTest(filePath, errorOutput);
    if (!healed) {
      return {
        file: filePath,
        passed: false,
        healed: false,
        healAttempts: attempt + 1,
        error: 'Healer could not fix the locator',
      };
    }
  }

  return { file: filePath, passed: false, healed: false, healAttempts: MAX_HEAL_RETRIES };
}

function runTest(filePath: string): { success: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(
      `npx playwright test "${filePath}" --reporter=line`,
      {
        cwd: process.cwd(),
        timeout: 60_000,
        encoding: 'utf-8',
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );
    return { success: true, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return {
      success: false,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
}

async function healTest(filePath: string, errorOutput: string): Promise<boolean> {
  const code = readFileSync(filePath, 'utf-8');

  // Get a11y tree from the target page
  const urlMatch = /page\.goto\(['"]([^'"]+)['"]\)/.exec(code);
  const url = urlMatch?.[1] ?? 'https://www.modanisa.com';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const snapshot = await getAccessibilitySnapshot(page);
    const treeContext = truncateTree(snapshot.raw);

    const historyContext = formatHistoryContext('unknown element');

    const userPrompt = `ERROR:\n${errorOutput.slice(0, 500)}\n\nTEST CODE:\n${code}\n\nACCESSIBILITY TREE:\n${treeContext}\n\nHEALING HISTORY:\n${historyContext}`;

    const suggestion = await callGeminiWithJson<{ suggestedLocator: LocatorInfo; reasoning: string }>(
      HEALER_PROMPT,
      userPrompt,
      { maxTokens: 1024, temperature: 0.1 }
    );

    // Apply fix
    const fixedCode = applyFix(code, errorOutput, suggestion.suggestedLocator);
    if (fixedCode === code) {
      console.log(`    ⚠️ Could not apply fix`);
      return false;
    }

    writeFileSync(filePath, fixedCode, 'utf-8');
    console.log(`    ✅ Applied: ${suggestion.suggestedLocator.strategy}(${suggestion.suggestedLocator.value})`);
    console.log(`    💡 ${suggestion.reasoning}`);

    // Save to healing history
    const record: HealingRecord = {
      id: `heal-ci-${Date.now()}`,
      timestamp: new Date().toISOString(),
      element: suggestion.suggestedLocator.description,
      originalLocator: { description: 'broken', strategy: 'getByRole', value: 'unknown', line: 0 },
      healedLocator: suggestion.suggestedLocator,
      reason: suggestion.reasoning,
      success: false,
      accessibilityContext: treeContext.slice(0, 300),
    };
    saveHealingRecord(record);

    return true;
  } finally {
    await browser.close();
  }
}

function applyFix(code: string, errorMessage: string, newLocator: LocatorInfo): string {
  const patterns = [
    /Locator:\s*(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
    /waiting for (getByRole|getByText|getByLabel|getByPlaceholder|getByTestId)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
  ];

  const newPattern = `.${newLocator.strategy}(${newLocator.value})`;

  for (const pattern of patterns) {
    const match = pattern.exec(errorMessage);
    if (match) {
      const oldPattern = `.${match[1]}(${match[2]})`;
      if (code.includes(oldPattern)) {
        return code.replaceAll(oldPattern, newPattern);
      }
    }
  }

  return code;
}

main().catch((err) => {
  console.error('💥 Pipeline failed:', err);
  process.exit(1);
});

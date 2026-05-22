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
const STEPS_DIR = resolve(process.cwd(), 'src', 'step-definitions');

const HEALER_PROMPT = `You are a Playwright Locator Healer. A Cucumber step definition test failed because a locator could not find an element. Suggest a fix.

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
  console.log('🔄 CI Pipeline: Run Cucumber tests + self-heal');
  console.log('═'.repeat(60));

  for (let attempt = 0; attempt <= MAX_HEAL_RETRIES; attempt++) {
    const { success, output } = runCucumber();

    if (success) {
      if (attempt > 0) {
        console.log(`\n✅ Tests healed and passing (after ${attempt} heal attempt(s))`);
      } else {
        console.log('\n✅ All Cucumber tests passing');
      }
      return;
    }

    const classification = classifyError(output, output);

    if (!classification.shouldHeal) {
      console.log(`\n❌ Non-healable error: ${classification.type}`);
      console.log(classification.message);
      process.exit(1);
    }

    if (attempt >= MAX_HEAL_RETRIES) {
      console.log(`\n❌ Max heal retries (${MAX_HEAL_RETRIES}) reached`);
      process.exit(1);
    }

    console.log(`\n🔧 Heal attempt ${attempt + 1}/${MAX_HEAL_RETRIES}...`);
    const healed = await healStepDefinitions(output);
    if (!healed) {
      console.log('❌ Healer could not fix the issue');
      process.exit(1);
    }
  }
}

function runCucumber(): { success: boolean; output: string } {
  try {
    const stdout = execSync(
      `node --import tsx node_modules/.bin/cucumber-js --import 'src/support/**/*.ts' --import 'src/step-definitions/**/*.ts' features/`,
      {
        cwd: process.cwd(),
        timeout: 60_000,
        encoding: 'utf-8',
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );
    console.log(stdout);
    return { success: true, output: stdout };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = (e.stdout ?? '') + '\n' + (e.stderr ?? '');
    console.log(output);
    return { success: false, output };
  }
}

async function healStepDefinitions(errorOutput: string): Promise<boolean> {
  // Find which step definition file has the broken locator
  const stepFiles = getStepFiles();
  if (stepFiles.length === 0) {
    console.log('  ⚠️ No step definition files found');
    return false;
  }

  // Combine all step code for context
  const allStepCode = stepFiles
    .map((f) => `// File: ${f}\n${readFileSync(f, 'utf-8')}`)
    .join('\n\n');

  // Get a11y tree
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.modanisa.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const snapshot = await getAccessibilitySnapshot(page);
    const treeContext = truncateTree(snapshot.raw);
    const historyContext = formatHistoryContext('unknown element');

    const userPrompt = `ERROR:\n${errorOutput.slice(0, 800)}\n\nSTEP DEFINITION CODE:\n${allStepCode}\n\nACCESSIBILITY TREE:\n${treeContext}\n\nHEALING HISTORY:\n${historyContext}`;

    const suggestion = await callGeminiWithJson<{ suggestedLocator: LocatorInfo; reasoning: string }>(
      HEALER_PROMPT,
      userPrompt,
      { maxTokens: 1024, temperature: 0.1 }
    );

    // Apply fix to step definitions
    let fixed = false;
    for (const file of stepFiles) {
      const code = readFileSync(file, 'utf-8');
      const fixedCode = applyFix(code, errorOutput, suggestion.suggestedLocator);
      if (fixedCode !== code) {
        writeFileSync(file, fixedCode, 'utf-8');
        console.log(`  ✅ Fixed: ${file}`);
        console.log(`  📝 ${suggestion.suggestedLocator.strategy}(${suggestion.suggestedLocator.value})`);
        console.log(`  💡 ${suggestion.reasoning}`);
        fixed = true;

        // Save healing record
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
        break;
      }
    }

    return fixed;
  } finally {
    await browser.close();
  }
}

function getStepFiles(): string[] {
  if (!existsSync(STEPS_DIR)) return [];
  return readdirSync(STEPS_DIR)
    .filter((f) => f.endsWith('.steps.ts'))
    .map((f) => join(STEPS_DIR, f));
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

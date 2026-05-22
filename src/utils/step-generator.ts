import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { callGemini } from '../utils/gemini-client.js';
import type { AcceptanceCriteria, GeneratedTestCode } from '../types/index.js';

const STEP_GEN_PROMPT = `You are a Cucumber/Gherkin step definition generator. Given acceptance criteria and working Playwright test code, generate:
1. A .feature file in Gherkin syntax
2. Step definitions in TypeScript that use Playwright

RULES:
- Use Given/When/Then syntax
- Step definitions must use the EXACT working locator code from the test
- Keep steps reusable and parameterized where possible
- Use Playwright's user-facing locators only

OUTPUT FORMAT:
---FEATURE---
<feature file content>
---STEPS---
<step definitions TypeScript content>`;

export async function generateStepDefinitions(
  criteria: AcceptanceCriteria,
  testCode: GeneratedTestCode
): Promise<{ featurePath: string; stepsPath: string }> {
  const userPrompt = `Generate Gherkin feature and step definitions for:

TITLE: ${criteria.title}

WORKING TEST CODE:
${testCode.code}

ACCEPTANCE CRITERIA:
Steps: ${criteria.steps.map((s) => `${s.order}. ${s.action} → ${s.target}`).join('\n')}
Expected: ${criteria.expectedResults.join(', ')}`;

  const response = await callGemini(STEP_GEN_PROMPT, userPrompt, {
    maxTokens: 4096,
    temperature: 0.1,
  });

  const { feature, steps } = parseResponse(response.text);

  // Write feature file
  const featureDir = resolve(process.cwd(), 'features');
  const stepsDir = resolve(process.cwd(), 'src', 'step-definitions');

  if (!existsSync(featureDir)) mkdirSync(featureDir, { recursive: true });
  if (!existsSync(stepsDir)) mkdirSync(stepsDir, { recursive: true });

  const slug = criteria.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const featurePath = resolve(featureDir, `${slug}.feature`);
  const stepsPath = resolve(stepsDir, `${slug}.steps.ts`);

  writeFileSync(featurePath, feature, 'utf-8');
  writeFileSync(stepsPath, steps, 'utf-8');

  console.log(`📄 Feature file: ${featurePath}`);
  console.log(`📄 Step definitions: ${stepsPath}`);

  return { featurePath, stepsPath };
}

function parseResponse(text: string): { feature: string; steps: string } {
  const featureMatch = text.match(/---FEATURE---\n([\s\S]*?)---STEPS---/);
  const stepsMatch = text.match(/---STEPS---\n([\s\S]*?)$/);

  let feature = featureMatch?.[1]?.trim() ?? generateFallbackFeature();
  let steps = stepsMatch?.[1]?.trim() ?? generateFallbackSteps();

  // Clean markdown fences from both outputs
  feature = cleanMarkdownFences(feature);
  steps = cleanMarkdownFences(steps);

  return { feature, steps };
}

function cleanMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:typescript|gherkin|ts)?\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .trim();
}

function generateFallbackFeature(): string {
  return `Feature: Generated Test\n\n  Scenario: Auto-generated\n    Given the user is on the target page\n    When the test actions are performed\n    Then the expected results are verified`;
}

function generateFallbackSteps(): string {
  return `import { Given, When, Then } from '@cucumber/cucumber';\nimport { chromium, Page } from '@playwright/test';\n\n// Auto-generated step definitions\n`;
}

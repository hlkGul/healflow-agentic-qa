import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWorkflow } from './graph/workflow.js';
import { generateStepDefinitions } from './utils/step-generator.js';
import { parseCriteriaFile } from './utils/criteria-parser.js';
import type { TestIntent } from './types/index.js';

export async function runAgenticTest(userMessage: string, targetUrl: string) {
  const intent: TestIntent = { userMessage, targetUrl };

  const workflow = buildWorkflow();

  console.log('🚀 Starting agentic test workflow...');
  console.log(`📝 Intent: "${userMessage}"`);
  console.log(`🌐 Target: ${targetUrl}`);
  console.log('─'.repeat(50));

  const result = await workflow.invoke({
    intent,
    maxRetries: 3,
  });

  console.log('─'.repeat(50));
  console.log(`\n📊 Final Status: ${result.phase}`);

  if (result.errorLog.length > 0) {
    console.log('\n📋 Execution Log:');
    for (const log of result.errorLog) {
      console.log(`  ${log}`);
    }
  }

  if (result.healingAttempts.length > 0) {
    console.log(`\n🔧 Healing Attempts: ${result.healingAttempts.length}`);
    for (const attempt of result.healingAttempts) {
      console.log(`  #${attempt.attemptNumber}: ${attempt.suggestedLocator.strategy}('${attempt.suggestedLocator.value}') — ${attempt.reasoning}`);
    }
  }

  // Generate step definitions on success
  if (result.phase === 'success' && result.criteria && result.generatedCode) {
    console.log('\n📝 Generating Gherkin step definitions...');
    try {
      const { featurePath, stepsPath } = await generateStepDefinitions(
        result.criteria,
        result.generatedCode
      );
      console.log(`✅ Feature: ${featurePath}`);
      console.log(`✅ Steps: ${stepsPath}`);
    } catch (err) {
      console.warn('⚠️ Step definition generation failed:', err);
    }
  }

  return result;
}

export async function runFromCriteriaFile(filePath: string) {
  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📄 Loading criteria from: ${resolvedPath}`);
  const { criteria, targetUrl } = parseCriteriaFile(resolvedPath);

  console.log(`🚀 Starting agentic test workflow (from file)...`);
  console.log(`📝 Title: "${criteria.title}"`);
  console.log(`🌐 Target: ${targetUrl}`);
  console.log(`📋 Steps: ${criteria.steps.length}`);
  console.log('─'.repeat(50));

  const workflow = buildWorkflow();

  const result = await workflow.invoke({
    intent: { userMessage: criteria.title, targetUrl },
    criteria,
    phase: 'generating', // Skip planner, go directly to generator
    maxRetries: 3,
  });

  console.log('─'.repeat(50));
  console.log(`\n📊 Final Status: ${result.phase}`);

  if (result.errorLog.length > 0) {
    console.log('\n📋 Execution Log:');
    for (const log of result.errorLog) {
      console.log(`  ${log}`);
    }
  }

  if (result.healingAttempts.length > 0) {
    console.log(`\n🔧 Healing Attempts: ${result.healingAttempts.length}`);
    for (const attempt of result.healingAttempts) {
      console.log(`  #${attempt.attemptNumber}: ${attempt.suggestedLocator.strategy}('${attempt.suggestedLocator.value}') — ${attempt.reasoning}`);
    }
  }

  if (result.phase === 'success' && result.criteria && result.generatedCode) {
    console.log('\n📝 Generating Gherkin step definitions...');
    try {
      const { featurePath, stepsPath } = await generateStepDefinitions(
        result.criteria,
        result.generatedCode
      );
      console.log(`✅ Feature: ${featurePath}`);
      console.log(`✅ Steps: ${stepsPath}`);
    } catch (err) {
      console.warn('⚠️ Step definition generation failed:', err);
    }
  }

  return result;
}

// CLI entry point
const input = process.argv[2];
const targetUrl = process.argv[3] ?? 'https://www.modanisa.com';

if (!input) {
  console.error('Usage:');
  console.error('  npx tsx src/index.ts "<test intent>" [target-url]     # Natural language');
  console.error('  npx tsx src/index.ts --file criteria/my-test.md       # From criteria file');
  console.error('');
  console.error('Examples:');
  console.error('  npx tsx src/index.ts "Search for elbise and verify results"');
  console.error('  npx tsx src/index.ts --file criteria/search-test.md');
  process.exit(1);
}

if (input === '--file') {
  const filePath = process.argv[3];
  if (!filePath) {
    console.error('❌ --file requires a path argument');
    process.exit(1);
  }
  runFromCriteriaFile(filePath).catch((err) => {
    console.error('💥 Workflow failed:', err);
    process.exit(1);
  });
} else {
  runAgenticTest(input, targetUrl).catch((err) => {
    console.error('💥 Workflow failed:', err);
    process.exit(1);
  });
}

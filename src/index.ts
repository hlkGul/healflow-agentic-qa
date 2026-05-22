import 'dotenv/config';
import { buildWorkflow } from './graph/workflow.js';
import { generateStepDefinitions } from './utils/step-generator.js';
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

// CLI entry point
const userMessage = process.argv[2];
const targetUrl = process.argv[3] ?? 'https://www.modanisa.com';

if (!userMessage) {
  console.error('Usage: npx ts-node src/index.ts "<test intent>" [target-url]');
  console.error('Example: npx ts-node src/index.ts "Search for elbise and verify results"');
  process.exit(1);
}

runAgenticTest(userMessage, targetUrl).catch((err) => {
  console.error('💥 Workflow failed:', err);
  process.exit(1);
});

import 'dotenv/config';
import { runnerAgent } from './agents/runner.js';
import { healerAgent } from './agents/healer.js';
import { getBaseUrl } from './support/environment.js';
import type { GeneratedTestCode } from './types/index.js';
import type { GraphStateType } from './graph/state.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Demonstrates the self-healing loop with a broken locator.
 * Bypasses planner/generator, runs directly: Runner → Healer → Runner...
 */
async function testHealer() {
  const testFilePath = resolve(process.cwd(), 'tests/generated/test-broken.spec.ts');
  const code = readFileSync(testFilePath, 'utf-8');

  const generatedCode: GeneratedTestCode = {
    code,
    filePath: testFilePath,
    locators: [
      {
        description: 'Search input (BROKEN)',
        strategy: 'getByPlaceholder',
        value: "'Ürün ara burada'",
        line: 7,
      },
    ],
  };

  console.log('🧪 HEALER DEMO: Self-healing with broken locator');
  console.log(`❌ Broken: page.getByPlaceholder('Ürün ara burada')`);
  console.log(`🎯 Expected fix: page.getByPlaceholder('<correct placeholder>')`);
  console.log('─'.repeat(60));

  let state: GraphStateType = {
    phase: 'running',
    intent: {
      userMessage: 'Search for elbise on Modanisa',
      targetUrl: getBaseUrl(),
    },
    generatedCode,
    criteria: {
      title: 'Search for elbise',
      preconditions: ['User is on modanisa.com'],
      steps: [
        { order: 1, action: 'type', target: 'search input', value: 'elbise' },
        { order: 2, action: 'press_key', target: 'search input', value: 'Enter' },
        { order: 3, action: 'wait_for', target: 'search results page', value: '/elbise' },
      ],
      expectedResults: ['Search results for elbise are displayed'],
    },
    maxRetries: 3,
    currentRetry: 0,
    healingAttempts: [],
    healingHistory: [],
    accessibilitySnapshot: null,
    executionResult: null,
    errorLog: [],
  };

  // Manual runner → healer loop
  for (let i = 0; i < 4; i++) {
    console.log(`\n🔄 Loop iteration ${i + 1}`);
    console.log('─'.repeat(40));

    // Run the test
    console.log('▶️  Running test...');
    const runResult = await runnerAgent(state);
    state = { ...state, ...runResult };

    for (const log of runResult.errorLog ?? []) {
      console.log(`   ${log}`);
    }

    if (state.phase === 'success') {
      console.log('\n✅ TEST HEALED AND PASSED!');
      break;
    }

    if (state.phase === 'failed') {
      console.log('\n💀 TEST FAILED (unrecoverable)');
      break;
    }

    if (state.phase === 'healing') {
      console.log('🔧 Calling Healer...');
      const healResult = await healerAgent(state);
      state = { ...state, ...healResult };

      for (const log of healResult.errorLog ?? []) {
        console.log(`   ${log}`);
      }

      if (state.phase === 'failed') {
        console.log('\n💀 HEALER GAVE UP (max retries)');
        break;
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULT');
  console.log('═'.repeat(60));
  console.log(`Status: ${state.phase}`);
  console.log(`Healing attempts: ${state.healingAttempts.length}`);

  if (state.generatedCode) {
    console.log('\n📄 Final test code:');
    console.log(state.generatedCode.code);
  }
}

testHealer().catch((err) => {
  console.error('💥 Healer test failed:', err);
  process.exit(1);
});

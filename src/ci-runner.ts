import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { classifyError } from './utils/error-classifier.js';
import { healFromError } from './utils/heal-logic.js';
import { CucumberRunner } from './healing/cucumber-runner.js';
import type { TestRunner } from './healing/test-runner.js';

const MAX_HEAL_RETRIES = 3;
const MAX_NAVIGATION_RETRIES = 2;
const FAILURE_REPORT_PATH = 'ci-failure-report.json';

interface FailureReport {
  timestamp: string;
  errorType: string;
  message: string;
  healAttempts: number;
  healable: boolean;
  scenario: string;
  step: string;
}

function extractFailedScenarioInfo(output: string): { scenario: string; step: string } {
  const scenarioMatch = /Scenario:.*#\s*(.+)/.exec(output);
  const stepMatch = /✖\s+(.+?)\s*#/.exec(output);
  return {
    scenario: scenarioMatch?.[1]?.trim() || 'Unknown scenario',
    step: stepMatch?.[1]?.trim() || 'Unknown step',
  };
}

function writeFailureReport(report: FailureReport): void {
  writeFileSync(FAILURE_REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📋 Failure report written to ${FAILURE_REPORT_PATH}`);
}

async function main() {
  console.log('🔄 CI Pipeline: Run Cucumber tests + self-heal');
  console.log('═'.repeat(60));

  const runner: TestRunner = new CucumberRunner();
  let navigationRetries = 0;
  let lastOutput = '';

  for (let attempt = 0; attempt <= MAX_HEAL_RETRIES; attempt++) {
    const result = runner.run();
    lastOutput = `${result.stdout}\n${result.stderr}`;
    console.log(lastOutput);

    if (result.success) {
      if (attempt > 0) {
        console.log(`\n✅ Tests healed and passing (after ${attempt} heal attempt(s))`);
      } else {
        console.log('\n✅ All Cucumber tests passing');
      }
      return;
    }

    const classification = classifyError(lastOutput, lastOutput);
    const { scenario, step } = extractFailedScenarioInfo(lastOutput);

    // Retry navigation timeouts (site may be temporarily slow)
    if (classification.type === 'navigation_timeout' && navigationRetries < MAX_NAVIGATION_RETRIES) {
      navigationRetries++;
      console.log(`\n⏳ Navigation timeout — retrying (${navigationRetries}/${MAX_NAVIGATION_RETRIES})...`);
      attempt--; // Don't count as heal attempt
      continue;
    }

    if (!classification.shouldHeal) {
      console.log(`\n❌ Non-healable error: ${classification.type}`);
      console.log(classification.message);
      writeFailureReport({
        timestamp: new Date().toISOString(),
        errorType: classification.type,
        message: classification.message,
        healAttempts: attempt,
        healable: false,
        scenario,
        step,
      });
      process.exit(1);
    }

    if (attempt >= MAX_HEAL_RETRIES) {
      console.log(`\n❌ Max heal retries (${MAX_HEAL_RETRIES}) reached`);
      writeFailureReport({
        timestamp: new Date().toISOString(),
        errorType: classification.type,
        message: classification.message,
        healAttempts: attempt,
        healable: true,
        scenario,
        step,
      });
      process.exit(1);
    }

    console.log(`\n🔧 Heal attempt ${attempt + 1}/${MAX_HEAL_RETRIES}...`);
    const healResult = await healFromError(lastOutput);
    if (!healResult.healed) {
      console.log('❌ Healer could not fix the issue');
      writeFailureReport({
        timestamp: new Date().toISOString(),
        errorType: classification.type,
        message: `Healer failed: ${classification.message}`,
        healAttempts: attempt + 1,
        healable: true,
        scenario,
        step,
      });
      process.exit(1);
    }
    console.log(`  ✅ Fixed: ${healResult.file}`);
    console.log(`  📝 ${healResult.locator}`);
    console.log(`  💡 ${healResult.reasoning}`);
  }
}

main().catch((err) => {
  console.error('💥 Pipeline failed:', err);
  process.exit(1);
});

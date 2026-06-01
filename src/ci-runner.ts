import 'dotenv/config';
import { classifyError } from './utils/error-classifier.js';
import { healFromError } from './utils/heal-logic.js';
import { CucumberRunner } from './healing/cucumber-runner.js';
import type { TestRunner } from './healing/test-runner.js';

const MAX_HEAL_RETRIES = 3;
const MAX_NAVIGATION_RETRIES = 2;

async function main() {
  console.log('🔄 CI Pipeline: Run Cucumber tests + self-heal');
  console.log('═'.repeat(60));

  const runner: TestRunner = new CucumberRunner();
  let navigationRetries = 0;

  for (let attempt = 0; attempt <= MAX_HEAL_RETRIES; attempt++) {
    const result = runner.run();
    const output = `${result.stdout}\n${result.stderr}`;
    console.log(output);

    if (result.success) {
      if (attempt > 0) {
        console.log(`\n✅ Tests healed and passing (after ${attempt} heal attempt(s))`);
      } else {
        console.log('\n✅ All Cucumber tests passing');
      }
      return;
    }

    const classification = classifyError(output, output);

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
      process.exit(1);
    }

    if (attempt >= MAX_HEAL_RETRIES) {
      console.log(`\n❌ Max heal retries (${MAX_HEAL_RETRIES}) reached`);
      process.exit(1);
    }

    console.log(`\n🔧 Heal attempt ${attempt + 1}/${MAX_HEAL_RETRIES}...`);
    const healResult = await healFromError(output);
    if (!healResult.healed) {
      console.log('❌ Healer could not fix the issue');
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

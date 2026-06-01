import 'dotenv/config';
import { execSync } from 'node:child_process';
import { classifyError } from './utils/error-classifier.js';
import { healFromError } from './utils/heal-logic.js';

const MAX_HEAL_RETRIES = 3;
const MAX_NAVIGATION_RETRIES = 2;

async function main() {
  console.log('🔄 CI Pipeline: Run Cucumber tests + self-heal');
  console.log('═'.repeat(60));

  let navigationRetries = 0;

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
    const result = await healFromError(output);
    if (!result.healed) {
      console.log('❌ Healer could not fix the issue');
      process.exit(1);
    }
    console.log(`  ✅ Fixed: ${result.file}`);
    console.log(`  📝 ${result.locator}`);
    console.log(`  💡 ${result.reasoning}`);
  }
}

function runCucumber(): { success: boolean; output: string } {
  try {
    const stdout = execSync(
      `node --import tsx node_modules/.bin/cucumber-js --import 'src/support/**/*.ts' --import 'src/step-definitions/**/*.ts' features/`,
      {
        cwd: process.cwd(),
        timeout: 300_000,
        encoding: 'utf-8',
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );
    console.log(stdout);
    return { success: true, output: stdout };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; killed?: boolean; signal?: string };
    if (e.killed || e.signal === 'SIGTERM') {
      console.log('⏱️  execSync timeout exceeded');
    }
    const output = (e.stdout ?? '') + '\n' + (e.stderr ?? '');
    console.log(output);
    return { success: false, output };
  }
}

main().catch((err) => {
  console.error('💥 Pipeline failed:', err);
  process.exit(1);
});

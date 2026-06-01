import { execSync } from 'node:child_process';
import { classifyError } from '../utils/error-classifier.js';
import type { ExecutionResult } from '../types/index.js';
import type { TestRunner, RunConfig } from './test-runner.js';

/**
 * Runs Cucumber tests via CLI.
 */
export class CucumberRunner implements TestRunner {
  name = 'cucumber';

  run(config?: RunConfig): ExecutionResult {
    const features = config?.features ?? 'features/';
    const timeout = config?.timeout ?? 300_000;
    const startTime = Date.now();

    try {
      const stdout = execSync(
        `node --import tsx node_modules/.bin/cucumber-js --import 'src/support/**/*.ts' --import 'src/step-definitions/**/*.ts' ${features}`,
        {
          cwd: process.cwd(),
          timeout,
          encoding: 'utf-8',
          env: { ...process.env, FORCE_COLOR: '0' },
        }
      );

      return {
        success: true,
        duration: Date.now() - startTime,
        stdout,
        stderr: '',
      };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; killed?: boolean; signal?: string };
      const stdout = e.stdout ?? '';
      const stderr = e.stderr ?? '';
      const combined = `${stdout}\n${stderr}`;

      const classification = classifyError(combined, stderr);

      return {
        success: false,
        duration: Date.now() - startTime,
        stdout,
        stderr,
        error: {
          message: classification.message,
          type: classification.type,
          stackTrace: stderr.slice(0, 500),
        },
      };
    }
  }
}

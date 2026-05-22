import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { classifyError } from '../utils/error-classifier.js';
import type { ExecutionResult } from '../types/index.js';
import type { GraphStateType } from '../graph/state.js';

const RUNNER_TIMEOUT = 60_000; // 60 seconds max for a test run

export async function runnerAgent(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const { generatedCode } = state;

  if (!generatedCode) {
    return {
      phase: 'failed',
      errorLog: ['[Runner] No test code available to run'],
    };
  }

  const result = executePlaywrightTest(generatedCode.filePath);

  if (result.success) {
    return {
      phase: 'success',
      executionResult: result,
      errorLog: [`[Runner] ✅ Test passed in ${result.duration}ms`],
    };
  }

  // Classify the error
  const errorMessage = result.error?.message ?? result.stderr;
  const classification = classifyError(errorMessage, result.stderr);

  if (classification.shouldHeal) {
    return {
      phase: 'healing',
      executionResult: {
        ...result,
        error: {
          message: classification.message,
          type: classification.type,
          stackTrace: result.stderr,
        },
      },
      errorLog: [`[Runner] ❌ Locator error detected → routing to Healer: ${classification.message}`],
    };
  }

  if (classification.shouldRetry && state.currentRetry < 2) {
    return {
      phase: 'running',
      executionResult: result,
      currentRetry: state.currentRetry + 1,
      errorLog: [`[Runner] ⚠️ Retryable error (attempt ${state.currentRetry + 1}/2): ${classification.message}`],
    };
  }

  return {
    phase: 'failed',
    executionResult: result,
    errorLog: [`[Runner] ❌ Test failed (non-healable): ${classification.type} — ${classification.message}`],
  };
}

function executePlaywrightTest(testFilePath: string): ExecutionResult {
  const startTime = Date.now();
  const projectRoot = resolve(process.cwd());

  try {
    const stdout = execSync(
      `npx playwright test "${testFilePath}" --reporter=line`,
      {
        cwd: projectRoot,
        timeout: RUNNER_TIMEOUT,
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
    const execError = err as { stdout?: string; stderr?: string; message?: string };

    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? execError.message ?? 'Unknown error',
      error: {
        message: execError.stderr ?? execError.message ?? 'Test execution failed',
        type: 'unknown',
        stackTrace: execError.stderr ?? '',
      },
    };
  }
}

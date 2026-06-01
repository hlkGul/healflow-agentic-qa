import type { ExecutionResult } from '../types/index.js';

export interface RunConfig {
  features?: string;
  timeout?: number;
}

/**
 * Abstraction for test execution.
 * Enables different runners (Cucumber, Playwright Test, etc.)
 */
export interface TestRunner {
  name: string;
  run(config?: RunConfig): ExecutionResult;
}

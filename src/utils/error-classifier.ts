import type { ErrorType, TestError } from '../types/index.js';

interface ClassificationResult {
  type: ErrorType;
  shouldHeal: boolean;
  shouldRetry: boolean;
  message: string;
}

const LOCATOR_PATTERNS = [
  /locator\..*strict mode violation/i,
  /waiting for locator/i,
  /locator resolved to.*element/i,
  /no element matches locator/i,
  /element not found/i,
  /element\(s\) not found/i,
  /getByRole|getByText|getByLabel|getByPlaceholder|getByTestId/,
  /Timeout.*waiting for/i,
  /expect\(locator\)\.toBeVisible\(\) failed/i,
];

const NAVIGATION_PATTERNS = [
  /navigation timeout/i,
  /ERR_CONNECTION_REFUSED/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /net::ERR_/i,
  /page\.goto.*timeout/i,
];

const ASSERTION_PATTERNS = [
  /expect\(.*\)\.to/i,
  /AssertionError/i,
  /Expected.*Received/i,
  /toBeVisible.*but/i,
  /toHaveText.*but/i,
  /toContainText.*but/i,
];

const DIALOG_PATTERNS = [
  /unexpected.*dialog/i,
  /page\.on\('dialog'\)/i,
];

export function classifyError(errorMessage: string, stderr: string): ClassificationResult {
  const combined = `${errorMessage}\n${stderr}`;

  if (LOCATOR_PATTERNS.some((p) => p.test(combined))) {
    return {
      type: 'locator_not_found',
      shouldHeal: true,
      shouldRetry: false,
      message: extractRelevantMessage(combined, 'locator'),
    };
  }

  if (combined.includes('Timeout') && LOCATOR_PATTERNS.some((p) => p.test(combined))) {
    return {
      type: 'locator_timeout',
      shouldHeal: true,
      shouldRetry: false,
      message: extractRelevantMessage(combined, 'timeout'),
    };
  }

  if (NAVIGATION_PATTERNS.some((p) => p.test(combined))) {
    return {
      type: 'navigation_timeout',
      shouldHeal: false,
      shouldRetry: true,
      message: extractRelevantMessage(combined, 'navigation'),
    };
  }

  if (ASSERTION_PATTERNS.some((p) => p.test(combined))) {
    return {
      type: 'assertion_failed',
      shouldHeal: false,
      shouldRetry: false,
      message: extractRelevantMessage(combined, 'assertion'),
    };
  }

  if (DIALOG_PATTERNS.some((p) => p.test(combined))) {
    return {
      type: 'unexpected_dialog',
      shouldHeal: false,
      shouldRetry: true,
      message: extractRelevantMessage(combined, 'dialog'),
    };
  }

  return {
    type: 'unknown',
    shouldHeal: false,
    shouldRetry: false,
    message: errorMessage.slice(0, 200),
  };
}

function extractRelevantMessage(text: string, context: string): string {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const relevant = lines.find((l) =>
    context === 'locator'
      ? LOCATOR_PATTERNS.some((p) => p.test(l))
      : context === 'navigation'
        ? NAVIGATION_PATTERNS.some((p) => p.test(l))
        : context === 'assertion'
          ? ASSERTION_PATTERNS.some((p) => p.test(l))
          : DIALOG_PATTERNS.some((p) => p.test(l))
  );
  return relevant?.trim() ?? lines[0]?.trim() ?? 'Unknown error';
}

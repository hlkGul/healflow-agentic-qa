// --- Core Domain Types ---

export interface TestIntent {
  userMessage: string;
  targetUrl: string;
}

export interface AcceptanceCriteria {
  title: string;
  preconditions: string[];
  steps: TestStep[];
  expectedResults: string[];
}

export interface TestStep {
  order: number;
  action: string;
  target: string;
  value?: string;
}

export interface GeneratedTestCode {
  code: string;
  filePath: string;
  locators: LocatorInfo[];
}

export interface LocatorInfo {
  description: string;
  strategy: LocatorStrategy;
  value: string;
  line: number;
}

export type LocatorStrategy =
  | 'getByRole'
  | 'getByText'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByTestId';

// --- Execution Types ---

export interface ExecutionResult {
  success: boolean;
  duration: number;
  error?: TestError;
  stdout: string;
  stderr: string;
}

export interface TestError {
  message: string;
  type: ErrorType;
  locatorInfo?: LocatorInfo;
  stackTrace: string;
  line?: number;
}

export type ErrorType =
  | 'locator_not_found'
  | 'locator_timeout'
  | 'navigation_timeout'
  | 'network_error'
  | 'assertion_failed'
  | 'unexpected_dialog'
  | 'unknown';

// --- Healing Types ---

export interface HealingRecord {
  id: string;
  timestamp: string;
  element: string;
  originalLocator: LocatorInfo;
  healedLocator: LocatorInfo;
  reason: string;
  success: boolean;
  accessibilityContext?: string;
}

export interface HealingAttempt {
  attemptNumber: number;
  suggestedLocator: LocatorInfo;
  reasoning: string;
}

// --- Accessibility Types ---

export interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
}

export interface AccessibilitySnapshot {
  tree: AccessibilityNode | null;
  raw: string;
  method: 'snapshot' | 'aria-snapshot';
}

// --- Step Definition Types ---

export interface StepDefinition {
  pattern: string;
  code: string;
  feature: string;
  generatedFrom: string;
}

// --- Agent Communication (LangGraph State) ---

export type AgentPhase =
  | 'planning'
  | 'generating'
  | 'running'
  | 'healing'
  | 'success'
  | 'failed';

export interface AgentState {
  phase: AgentPhase;
  intent: TestIntent;
  criteria: AcceptanceCriteria | null;
  generatedCode: GeneratedTestCode | null;
  executionResult: ExecutionResult | null;
  healingAttempts: HealingAttempt[];
  healingHistory: HealingRecord[];
  accessibilitySnapshot: AccessibilitySnapshot | null;
  currentRetry: number;
  maxRetries: number;
  errorLog: string[];
}

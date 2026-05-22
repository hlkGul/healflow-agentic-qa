import { Annotation } from '@langchain/langgraph';
import type {
  AgentPhase,
  TestIntent,
  AcceptanceCriteria,
  GeneratedTestCode,
  ExecutionResult,
  HealingAttempt,
  HealingRecord,
  AccessibilitySnapshot,
} from '../types/index.js';

export const GraphState = Annotation.Root({
  phase: Annotation<AgentPhase>({
    reducer: (_prev, next) => next,
    default: () => 'planning',
  }),
  intent: Annotation<TestIntent>({
    reducer: (_prev, next) => next,
    default: () => ({ userMessage: '', targetUrl: '' }),
  }),
  criteria: Annotation<AcceptanceCriteria | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  generatedCode: Annotation<GeneratedTestCode | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  executionResult: Annotation<ExecutionResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  healingAttempts: Annotation<HealingAttempt[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  healingHistory: Annotation<HealingRecord[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  accessibilitySnapshot: Annotation<AccessibilitySnapshot | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  currentRetry: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 3,
  }),
  errorLog: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type GraphStateType = typeof GraphState.State;

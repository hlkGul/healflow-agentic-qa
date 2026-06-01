import type { AccessibilitySnapshot, LocatorInfo } from '../types/index.js';

export interface HealingSuggestion {
  locator: LocatorInfo;
  reasoning: string;
  confidence: number; // 0-1
}

export interface HealingContext {
  errorMessage: string;
  code: string;
  snapshot: AccessibilitySnapshot;
  history: string;
}

/**
 * A strategy that can attempt to fix a broken locator.
 * Strategies are tried in order — first one to return a suggestion wins.
 */
export interface HealingStrategy {
  name: string;
  canHeal(context: HealingContext): boolean;
  suggestFix(context: HealingContext): Promise<HealingSuggestion | null>;
}

import type { HealingStrategy, HealingContext, HealingSuggestion } from './types.js';
import { RuleBasedStrategy } from './rule-based-strategy.js';
import { LLMStrategy } from './llm-strategy.js';

export { type HealingStrategy, type HealingContext, type HealingSuggestion } from './types.js';
export { type ContextProvider, type CaptureOptions } from './context-provider.js';
export { RuleBasedStrategy } from './rule-based-strategy.js';
export { LLMStrategy } from './llm-strategy.js';
export { BrowserContextProvider } from './browser-context-provider.js';

/**
 * Tries strategies in order. First successful suggestion wins.
 * Default chain: rule-based (fast/free) → LLM (slow/costly).
 */
export class HealerEngine {
  private strategies: HealingStrategy[];

  constructor(strategies?: HealingStrategy[]) {
    this.strategies = strategies ?? [new RuleBasedStrategy(), new LLMStrategy()];
  }

  async heal(context: HealingContext): Promise<HealingSuggestion | null> {
    for (const strategy of this.strategies) {
      if (!strategy.canHeal(context)) continue;

      const suggestion = await strategy.suggestFix(context);
      if (suggestion && suggestion.confidence >= 0.5) {
        console.log(`  🎯 Strategy "${strategy.name}" suggested fix (confidence: ${suggestion.confidence})`);
        return suggestion;
      }
    }
    return null;
  }
}

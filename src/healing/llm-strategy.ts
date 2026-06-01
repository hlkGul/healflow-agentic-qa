import type { HealingStrategy, HealingContext, HealingSuggestion } from './types.js';
import { callLLMWithJson } from '../utils/llm-client.js';
import type { LocatorInfo } from '../types/index.js';

const LLM_HEALER_PROMPT = `You are a Playwright Locator Healer. A Cucumber step definition test failed because a locator could not find an element. Suggest a fix.

RULES:
1. ONLY suggest user-facing locators: getByRole, getByText, getByLabel, getByPlaceholder, getByTestId
2. The "value" field = ONLY the arguments inside parentheses
   Examples: "'link', { name: 'Elbise' }" or "'Ara'" or "'searchbox', { name: 'Search' }"
3. Analyze the accessibility tree to find the correct element
4. Consider the healing history — avoid suggesting locators that failed before
5. NEVER suggest XPath or CSS selectors

OUTPUT JSON:
{
  "suggestedLocator": {
    "description": "element description",
    "strategy": "getByRole|getByText|getByLabel|getByPlaceholder|getByTestId",
    "value": "arguments only",
    "line": 0
  },
  "reasoning": "why this works",
  "confidence": 0.9
}`;

/**
 * LLM-based healing: sends context to LLM and gets locator suggestion.
 * Higher quality but slower and costs tokens.
 */
export class LLMStrategy implements HealingStrategy {
  name = 'llm';

  canHeal(context: HealingContext): boolean {
    return context.snapshot.raw.length > 50;
  }

  async suggestFix(context: HealingContext): Promise<HealingSuggestion | null> {
    const userPrompt = `ERROR:\n${context.errorMessage.slice(0, 1000)}\n\nSTEP DEFINITION CODE:\n${context.code}\n\nACCESSIBILITY TREE:\n${context.snapshot.raw.slice(0, 4000)}\n\nHEALING HISTORY:\n${context.history}`;

    try {
      const result = await callLLMWithJson<{
        suggestedLocator: LocatorInfo;
        reasoning: string;
        confidence?: number;
      }>(LLM_HEALER_PROMPT, userPrompt, { maxTokens: 1024, temperature: 0.1 });

      return {
        locator: result.suggestedLocator,
        reasoning: result.reasoning,
        confidence: result.confidence ?? 0.7,
      };
    } catch {
      return null;
    }
  }
}

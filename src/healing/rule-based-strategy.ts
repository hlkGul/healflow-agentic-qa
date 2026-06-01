import type { HealingStrategy, HealingContext, HealingSuggestion } from './types.js';
import type { LocatorStrategy } from '../types/index.js';

/**
 * Rule-based healing: extracts locator directly from ariaSnapshot without LLM.
 * Fast, free, high-confidence for common patterns.
 */
export class RuleBasedStrategy implements HealingStrategy {
  name = 'rule-based';

  canHeal(context: HealingContext): boolean {
    // Can heal if we have a valid snapshot with content
    return context.snapshot.raw.length > 50;
  }

  async suggestFix(context: HealingContext): Promise<HealingSuggestion | null> {
    const brokenLocator = this.extractBrokenLocator(context.errorMessage);
    if (!brokenLocator) return null;

    const suggestion = this.findInSnapshot(context.snapshot.raw, brokenLocator);
    return suggestion;
  }

  private extractBrokenLocator(error: string): { strategy: string; value: string } | null {
    const patterns = [
      /waiting for (getBy\w+)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
      /Locator:\s*(getBy\w+)\(([^)]*(?:\{[^}]*\}[^)]*)?)\)/,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(error);
      if (match) {
        return { strategy: match[1]!, value: match[2]! };
      }
    }
    return null;
  }

  private findInSnapshot(snapshot: string, broken: { strategy: string; value: string }): HealingSuggestion | null {
    const lines = snapshot.split('\n');

    // If broken is a textbox/searchbox, find textbox in snapshot
    if (broken.strategy === 'getByRole' || broken.strategy === 'getByLabel' || broken.strategy === 'getByPlaceholder') {
      // Look for textbox with a placeholder
      for (const line of lines) {
        const textboxMatch = /- textbox "([^"]+)"/.exec(line);
        if (textboxMatch) {
          const placeholder = textboxMatch[1]!;
          return {
            locator: {
              description: `textbox with placeholder "${placeholder}"`,
              strategy: 'getByPlaceholder' as LocatorStrategy,
              value: `'${placeholder}'`,
              line: 0,
            },
            reasoning: `Found textbox with placeholder "${placeholder}" in accessibility snapshot`,
            confidence: 0.8,
          };
        }
      }

      // Look for combobox/searchbox
      for (const line of lines) {
        const comboMatch = /- (?:combobox|searchbox) "([^"]+)"/.exec(line);
        if (comboMatch) {
          return {
            locator: {
              description: `searchbox "${comboMatch[1]}"`,
              strategy: 'getByRole' as LocatorStrategy,
              value: `'searchbox', { name: '${comboMatch[1]}' }`,
              line: 0,
            },
            reasoning: `Found searchbox with name "${comboMatch[1]}" in accessibility snapshot`,
            confidence: 0.7,
          };
        }
      }
    }

    // If broken is a button, find matching button
    if (broken.strategy === 'getByRole' && broken.value.includes('button')) {
      for (const line of lines) {
        const buttonMatch = /- button "([^"]+)"/.exec(line);
        if (buttonMatch) {
          const name = buttonMatch[1]!;
          // Skip generic/utility buttons
          if (name.length > 2 && !name.startsWith('close')) {
            return {
              locator: {
                description: `button "${name}"`,
                strategy: 'getByRole' as LocatorStrategy,
                value: `'button', { name: '${name}' }`,
                line: 0,
              },
              reasoning: `Found button "${name}" in accessibility snapshot`,
              confidence: 0.6,
            };
          }
        }
      }
    }

    // If broken is a link, find matching link
    if (broken.strategy === 'getByRole' && broken.value.includes('link')) {
      for (const line of lines) {
        const linkMatch = /- link "([^"]+)"/.exec(line);
        if (linkMatch) {
          const name = linkMatch[1]!;
          if (name.length > 2) {
            return {
              locator: {
                description: `link "${name}"`,
                strategy: 'getByRole' as LocatorStrategy,
                value: `'link', { name: '${name}' }`,
                line: 0,
              },
              reasoning: `Found link "${name}" in accessibility snapshot`,
              confidence: 0.5,
            };
          }
        }
      }
    }

    return null;
  }
}

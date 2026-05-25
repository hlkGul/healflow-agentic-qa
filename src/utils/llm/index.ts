import type { LLMProvider } from './types.js';
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';

export type { LLMProvider, LLMResponse, LLMOptions } from './types.js';

let cachedProvider: LLMProvider | null = null;

/**
 * Auto-detect and return the LLM provider based on environment variables.
 *
 * Resolution order:
 * 1. LLM_PROVIDER env explicitly set ("gemini" | "openai")
 * 2. First available API key (GEMINI_API_KEY > OPENAI_API_KEY)
 */
export function getProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const explicit = process.env['LLM_PROVIDER']?.toLowerCase();
  const geminiKey = process.env['GEMINI_API_KEY'];
  const openaiKey = process.env['OPENAI_API_KEY'];

  if (explicit === 'openai' && openaiKey) {
    cachedProvider = new OpenAIProvider(openaiKey);
  } else if (explicit === 'gemini' && geminiKey) {
    cachedProvider = new GeminiProvider(geminiKey);
  } else if (geminiKey) {
    cachedProvider = new GeminiProvider(geminiKey);
  } else if (openaiKey) {
    cachedProvider = new OpenAIProvider(openaiKey);
  } else {
    throw new Error(
      'No LLM API key found. Set one of: GEMINI_API_KEY, OPENAI_API_KEY\n' +
      'Optionally set LLM_PROVIDER=gemini|openai to choose explicitly.'
    );
  }

  console.log(`🤖 LLM Provider: ${cachedProvider.name}`);
  return cachedProvider;
}

/**
 * LLM Provider abstraction.
 * Auto-detects which provider to use based on environment variables.
 *
 * Priority: LLM_PROVIDER env > first available key
 * Keys: GEMINI_API_KEY, OPENAI_API_KEY
 */

export interface LLMResponse {
  text: string;
  tokensUsed: number;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface LLMProvider {
  name: string;
  call(systemPrompt: string, userPrompt: string, options: LLMOptions): Promise<LLMResponse>;
}

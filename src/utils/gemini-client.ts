import { getProvider } from './llm/index.js';
import type { LLMResponse } from './llm/index.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff (ms)

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e.status === 429 || e.status === 503 || e.status === 500) return true;
  if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) return true;
  if (e.message?.includes('503') || e.message?.includes('UNAVAILABLE')) return true;
  if (e.message?.includes('rate') && e.message?.includes('limit')) return true;
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = RETRY_DELAYS[attempt] ?? 4000;
      console.warn(`⚠️ LLM API retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

export interface GeminiResponse {
  text: string;
  tokensUsed: number;
}

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<GeminiResponse> {
  const { maxTokens = 4096, temperature = 0.2 } = options;
  const provider = getProvider();

  return withRetry(async (): Promise<LLMResponse> => {
    return provider.call(systemPrompt, userPrompt, { maxTokens, temperature });
  });
}

export async function callGeminiWithJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const { maxTokens = 4096, temperature = 0.1 } = options;
  const provider = getProvider();

  return withRetry(async () => {
    const response = await provider.call(systemPrompt, userPrompt, {
      maxTokens,
      temperature,
      jsonMode: true,
    });
    return JSON.parse(response.text) as T;
  });
}

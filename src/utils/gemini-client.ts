import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff (ms)

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e.status === 429 || e.status === 503 || e.status === 500) return true;
  if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) return true;
  if (e.message?.includes('503') || e.message?.includes('UNAVAILABLE')) return true;
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = RETRY_DELAYS[attempt] ?? 4000;
      console.warn(`⚠️ Gemini API retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms...`);
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

  const client = getClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  });

  return withRetry(async () => {
    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const text = response.text();
    const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;
    return { text, tokensUsed };
  });
}

export async function callGeminiWithJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const { maxTokens = 4096, temperature = 0.1 } = options;

  const client = getClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      responseMimeType: 'application/json',
    },
  });

  return withRetry(async () => {
    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    return JSON.parse(text) as T;
  });
}

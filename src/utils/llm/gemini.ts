import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMOptions, LLMResponse } from './types.js';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async call(systemPrompt: string, userPrompt: string, options: LLMOptions = {}): Promise<LLMResponse> {
    const { maxTokens = 4096, temperature = 0.2, jsonMode = false } = options;

    const model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        ...(jsonMode && { responseMimeType: 'application/json' }),
      },
    });

    const result = await model.generateContent(userPrompt);
    const response = result.response;

    return {
      text: response.text(),
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
    };
  }
}

import OpenAI from 'openai';
import type { LLMProvider, LLMOptions, LLMResponse } from './types.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async call(systemPrompt: string, userPrompt: string, options: LLMOptions = {}): Promise<LLMResponse> {
    const { maxTokens = 4096, temperature = 0.2, jsonMode = false } = options;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
      ...(jsonMode && { response_format: { type: 'json_object' as const } }),
    });

    const text = response.choices[0]?.message?.content ?? '';
    const tokensUsed = response.usage?.total_tokens ?? 0;

    return { text, tokensUsed };
  }
}

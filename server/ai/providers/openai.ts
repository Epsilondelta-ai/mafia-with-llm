import OpenAI from 'openai';
import type { LLMRequest, LLMResponse } from '../../../shared/types.js';
import type { AIProvider, AIProviderConfig } from '../types.js';

export class OpenAIProvider implements AIProvider {
  readonly provider = 'openai' as const;
  private client: OpenAI;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = config.model;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      max_tokens: request.maxTokens || 300,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      provider: 'openai',
    };
  }
}

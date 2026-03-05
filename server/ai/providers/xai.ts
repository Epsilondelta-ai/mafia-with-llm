import OpenAI from 'openai';
import type { LLMRequest, LLMResponse } from '../../../shared/types.js';
import type { AIProvider, AIProviderConfig } from '../types.js';

// X AI (Grok) uses OpenAI-compatible API
export class XAIProvider implements AIProvider {
  readonly provider = 'xai' as const;
  private client: OpenAI;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.XAI_API_KEY,
      baseURL: config.baseUrl || process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
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
      provider: 'xai',
    };
  }
}

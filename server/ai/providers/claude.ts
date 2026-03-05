import Anthropic from '@anthropic-ai/sdk';
import type { LLMRequest, LLMResponse } from '../../../shared/types.js';
import type { AIProvider, AIProviderConfig } from '../types.js';

export class ClaudeProvider implements AIProvider {
  readonly provider = 'claude' as const;
  private client: Anthropic;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 300,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return {
      content: textBlock ? textBlock.text : '',
      provider: 'claude',
    };
  }
}

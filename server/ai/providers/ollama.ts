import type { LLMRequest, LLMResponse } from '../../../shared/types.js';
import type { AIProvider, AIProviderConfig } from '../types.js';

export class OllamaProvider implements AIProvider {
  readonly provider = 'ollama' as const;
  private baseUrl: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = config.model;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        stream: false,
        options: {
          num_predict: request.maxTokens || 300,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { message: { content: string } };
    return { content: data.message.content, provider: 'ollama' };
  }
}

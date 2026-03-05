import { GoogleGenAI } from '@google/genai';
import type { LLMRequest, LLMResponse } from '../../../shared/types.js';
import type { AIProvider, AIProviderConfig } from '../types.js';

export class GeminiProvider implements AIProvider {
  readonly provider = 'gemini' as const;
  private ai: GoogleGenAI;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.GEMINI_API_KEY || '' });
    this.model = config.model;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const result = await this.ai.models.generateContent({
      model: this.model,
      contents: request.userPrompt,
      config: {
        systemInstruction: request.systemPrompt,
        maxOutputTokens: request.maxTokens || 300,
      },
    });

    return {
      content: result.text || '',
      provider: 'gemini',
    };
  }
}

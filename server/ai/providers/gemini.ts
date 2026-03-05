import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMRequest, LLMResponse } from '../../../shared/types.js';
import type { AIProvider, AIProviderConfig } from '../types.js';

export class GeminiProvider implements AIProvider {
  readonly provider = 'gemini' as const;
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey || process.env.GEMINI_API_KEY || '');
    this.model = config.model;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: request.systemPrompt,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
      generationConfig: {
        maxOutputTokens: request.maxTokens || 300,
      },
    });

    return {
      content: result.response.text(),
      provider: 'gemini',
    };
  }
}

import type { LLMProvider, LLMRequest, LLMResponse } from '../../shared/types.js';

export interface AIProvider {
  readonly provider: LLMProvider;
  chat(request: LLMRequest): Promise<LLMResponse>;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  ollama: 'llama3.1',
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  xai: 'grok-3-mini',
};

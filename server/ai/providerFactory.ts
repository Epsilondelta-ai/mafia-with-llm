import type { LLMProvider } from '../../shared/types.js';
import type { AIProvider, AIProviderConfig } from './types.js';
import { DEFAULT_MODELS } from './types.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';
import { GeminiProvider } from './providers/gemini.js';
import { XAIProvider } from './providers/xai.js';

export function createProvider(provider: LLMProvider, model?: string): AIProvider {
  const config: AIProviderConfig = {
    model: model || DEFAULT_MODELS[provider],
  };

  switch (provider) {
    case 'ollama': return new OllamaProvider(config);
    case 'openai': return new OpenAIProvider(config);
    case 'claude': return new ClaudeProvider(config);
    case 'gemini': return new GeminiProvider(config);
    case 'xai': return new XAIProvider(config);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

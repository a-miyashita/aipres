import type { ResolvedConfig } from '../model/types.js';
import type { LLMProvider } from './provider.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  copilot: 'https://api.githubcopilot.com',
  local: 'http://localhost:11434/v1',
};

export function createProvider(config: ResolvedConfig): LLMProvider {
  const { provider, model, apiKey, baseUrl } = config.llm;

  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);

    case 'openai':
      return new OpenAICompatibleProvider(apiKey, model, baseUrl ?? DEFAULT_BASE_URLS.openai);

    case 'copilot':
      return new OpenAICompatibleProvider(apiKey, model, DEFAULT_BASE_URLS.copilot);

    case 'local':
      return new OpenAICompatibleProvider('', model, baseUrl ?? DEFAULT_BASE_URLS.local);

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown LLM provider: ${String(_exhaustive)}`);
    }
  }
}

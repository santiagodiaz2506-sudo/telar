import type { LlmProviderKind } from '@/types/api'

export const PROVIDER_LABEL: Record<LlmProviderKind, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (local)',
}

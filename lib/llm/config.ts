export type LLMProvider = "ollama" | "anthropic" | "openai"

export interface LLMConfig {
  provider: LLMProvider
  model: string
  baseUrl?: string
  apiKey?: string
}

export function getLLMConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  return {
    provider: (overrides?.provider ?? process.env.LLM_PROVIDER ?? "ollama") as LLMProvider,
    model: overrides?.model ?? process.env.OLLAMA_MODEL ?? "qwen2.5:14b",
    baseUrl: overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    apiKey: overrides?.apiKey,
    ...overrides,
  }
}
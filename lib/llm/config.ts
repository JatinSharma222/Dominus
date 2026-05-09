export type LLMProvider = "ollama" | "anthropic" | "openai" | "groq"

export interface LLMConfig {
  provider: LLMProvider
  model: string
  baseUrl?: string
  apiKey?: string
}

export function getLLMConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  const provider = (overrides?.provider ?? process.env.LLM_PROVIDER ?? "ollama") as LLMProvider

  // Pick the right API key based on provider
  const apiKey =
    overrides?.apiKey ??
    (provider === "groq"      ? process.env.GROQ_API_KEY      : undefined) ??
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined) ??
    (provider === "openai"    ? process.env.OPENAI_API_KEY    : undefined)

  return {
    provider,
    model: overrides?.model ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b",
    baseUrl: overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    apiKey,
    ...overrides,
  }
}
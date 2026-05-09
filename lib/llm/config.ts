export type LLMProvider = "ollama" | "anthropic" | "openai" | "groq"

export interface LLMConfig {
  provider: LLMProvider
  model: string
  baseUrl?: string
  apiKey?: string
}

export function getLLMConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  const envProvider = process.env.LLM_PROVIDER as LLMProvider | undefined

  // Server env var wins when it's set to a hosted provider (groq/anthropic/openai).
  // This prevents the client's localStorage default { provider:"ollama" } from
  // overriding GROQ_API_KEY / ANTHROPIC_API_KEY on Vercel.
  // Locally, LLM_PROVIDER=ollama so the client settings panel still works.
  const provider: LLMProvider =
    envProvider && envProvider !== "ollama"
      ? envProvider                                          // Vercel → always use server provider
      : (overrides?.provider ?? envProvider ?? "ollama")    // local → client can override

  const apiKey =
    overrides?.apiKey ??
    (provider === "groq"      ? process.env.GROQ_API_KEY      : undefined) ??
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined) ??
    (provider === "openai"    ? process.env.OPENAI_API_KEY    : undefined)

  return {
    provider,
    model:   overrides?.model   ?? process.env.OLLAMA_MODEL   ?? "llama3.1:8b",
    baseUrl: overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    apiKey,
  }
}
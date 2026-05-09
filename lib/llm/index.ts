import { createOllama } from "ollama-ai-provider"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { getLLMConfig, LLMConfig } from "./config"

export function getLLMModel(config?: Partial<LLMConfig>) {
  const { provider, model, baseUrl, apiKey } = getLLMConfig(config)

  switch (provider) {
    case "ollama": {
      const ollama = createOllama({ baseURL: `${baseUrl}/api` })
      return ollama(model)
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(model || "claude-sonnet-4-20250514")
    }
    case "openai": {
      const openai = createOpenAI({ apiKey })
      return openai(model || "gpt-4o")
    }
    case "groq": {
      // Groq uses OpenAI-compatible API — no new package needed
      const groq = createOpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      })
      return groq(model || "llama-3.1-8b-instant")
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}
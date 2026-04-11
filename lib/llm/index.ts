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
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}
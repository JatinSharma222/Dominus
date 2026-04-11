import { NextRequest } from "next/server"
import { Ollama } from "ollama"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { getLLMConfig } from "@/lib/llm/config"
import { allTools } from "@/lib/tools"
import { executePortfolioRead } from "@/lib/tools/portfolio"

export const maxDuration = 30

const toolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_portfolio: (args) => executePortfolioRead(args as { walletAddress: string }),
}

export async function POST(req: NextRequest) {
  try {
    const { messages, walletAddress, llmConfig } = await req.json()
    const config = getLLMConfig(llmConfig)

    // Use Anthropic/OpenAI via Vercel AI SDK (proper tool support)
    if (config.provider === "anthropic" || config.provider === "openai") {
      const model = config.provider === "anthropic"
        ? createAnthropic({ apiKey: config.apiKey })(config.model || "claude-sonnet-4-20250514")
        : createOpenAI({ apiKey: config.apiKey })(config.model || "gpt-4o")

      const result = streamText({
        model,
        system: buildSystemPrompt(walletAddress),
        messages,
        tools: allTools,
        maxSteps: 5,
      })
      return result.toDataStreamResponse()
    }

    // Ollama — use native ollama package with manual tool loop
    const ollama = new Ollama({ host: config.baseUrl || "http://localhost:11434" })

    const ollamaMessages = [
      { role: "system" as const, content: buildSystemPrompt(walletAddress) },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    const ollamaTools = [
      {
        type: "function" as const,
        function: {
          name: "get_portfolio",
          description: allTools.get_portfolio.description,
          parameters: {
            type: "object",
            properties: {
              walletAddress: {
                type: "string",
                description: "The user's Solana wallet public key",
              },
            },
            required: ["walletAddress"],
          },
        },
      },
    ]

    // Step 1: initial model call
    const response = await ollama.chat({
      model: config.model || "llama3.1:8b",
      messages: ollamaMessages,
      tools: ollamaTools,
      stream: false,
    })

    let finalText = response.message.content || ""

    // Step 2: if model called a tool, execute it and get final response
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      const toolMessages = [...ollamaMessages, response.message]

      for (const toolCall of response.message.tool_calls) {
        const toolName = toolCall.function.name
        const toolArgs = toolCall.function.arguments as Record<string, unknown>
        const executor = toolExecutors[toolName]

        let toolResult: unknown
        try {
          toolResult = executor ? await executor(toolArgs) : { error: "Tool not found" }
        } catch (err) {
          toolResult = { error: String(err) }
        }

        toolMessages.push({
          role: "tool" as const,
          content: JSON.stringify(toolResult),
        })
      }

      // Step 3: get final summary from model
      const finalResponse = await ollama.chat({
        model: config.model || "llama3.1:8b",
        messages: toolMessages,
        stream: false,
      })

      finalText = finalResponse.message.content || ""
    }

    // Stream the final text back manually
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Format as Vercel AI SDK data stream
        const formatted = `0:${JSON.stringify(finalText)}\n`
        controller.enqueue(encoder.encode(formatted))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    })

  } catch (error) {
    console.error("[chat/route] error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

function buildSystemPrompt(walletAddress?: string): string {
  const walletLine = walletAddress
    ? `The user's wallet address is: ${walletAddress}`
    : `The user's wallet is not connected. Ask them to connect their wallet before executing any transactions.`

  return `You are Dominus. You only speak English. Every word must be in English.

You are an AI assistant that helps users interact with Solana DeFi protocols using natural language.

You have access to tools for: swapping tokens (Jupiter), earning yield (Kamino), recurring payments (Streamflow), staking SOL (Jito), and reading portfolio balances (Helius).

${walletLine}

Rules:
- After EVERY tool call, you MUST write a text summary of the results in English
- Always explain what you are about to do before calling a tool
- Always show amounts, fees, and APYs clearly
- NEVER execute transactions — only build them and return for user confirmation
- Be concise. This is a financial tool, not a general chatbot.
- Format numbers clearly: SOL amounts to 4 decimal places`
}
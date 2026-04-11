import { streamText } from "ai"
import { getLLMModel } from "@/lib/llm"
import { allTools } from "@/lib/tools"
import { LLMConfig } from "@/lib/llm/config"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, walletAddress, llmConfig } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[]
      walletAddress?: string
      llmConfig?: Partial<LLMConfig>
    }

    // llmConfig comes from user's LLMSettings in localStorage
    // undefined in dev = uses Ollama default from .env.local
    const model = getLLMModel(llmConfig)

    const result = streamText({
      model,
      system: buildSystemPrompt(walletAddress),
      messages,
      tools: allTools,
      maxSteps: 3,
      onError: ({ error }) => {
        console.error("[chat/route] streamText error:", error)
      },
    })

    return result.toDataStreamResponse()

  } catch (error) {
    console.error("[chat/route] POST error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

function buildSystemPrompt(walletAddress?: string): string {
  const walletLine = walletAddress
    ? `The user's wallet address is: ${walletAddress}`
    : `The user's wallet is not connected. Ask them to connect their wallet before executing any transactions.`

  return `You are Dominus, an AI assistant that helps users interact with Solana DeFi protocols using natural language.

You have access to tools for: swapping tokens (Jupiter), earning yield (Kamino), recurring payments (Streamflow), staking SOL (Jito), and reading portfolio balances (Helius).

${walletLine}

Rules:
- Always explain what you are about to do before calling a tool
- After getting tool results, summarize them in plain English
- Always show amounts, fees, and APYs clearly
- NEVER execute transactions — only build them and return for user confirmation
- If the user's intent is unclear, ask a clarifying question before calling a tool
- Proactively suggest related actions (e.g. after a swap, suggest depositing for yield)
- Be concise. This is a financial tool, not a general chatbot.
- If the wallet is not connected, do not attempt to build any transaction
- Always respond with raw JSON for tool calls. Never wrap output in markdown code fences.
- Format numbers clearly: SOL amounts to 4 decimal places, USD amounts to 2 decimal places`
}
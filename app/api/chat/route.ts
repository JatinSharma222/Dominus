// app/api/chat/route.ts

import { NextRequest } from "next/server"
import { Ollama } from "ollama"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { getLLMConfig } from "@/lib/llm/config"
import { allTools } from "@/lib/tools"
import { executePortfolioRead } from "@/lib/tools/portfolio"
import { executeJupiterSwap } from "@/lib/tools/jupiter"
import { executeKaminoDeposit } from "@/lib/tools/kamino"

export const maxDuration = 60

// ─── Tool executors ───────────────────────────────────────────────────────────

const toolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_portfolio: (args) =>
    executePortfolioRead(args as { walletAddress: string }),
  swap_tokens: (args) =>
    executeJupiterSwap(
      args as { fromToken: string; toToken: string; amount: number; slippage: number }
    ),
  deposit_for_yield: (args) =>
    executeKaminoDeposit(args as { token: string; amount: number }),
}

// ─── Fallback: extract tool call from plain-text model output ─────────────────

interface ParsedToolCall {
  name: string
  parameters: Record<string, unknown>
}

function extractToolCallFromText(text: string): ParsedToolCall | null {
  const pattern1 = /\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?"parameters"\s*:\s*(\{[\s\S]*?\})\s*\}/
  const m1 = text.match(pattern1)
  if (m1) {
    try {
      const full = JSON.parse(m1[0])
      if (full.name && full.parameters) return { name: full.name, parameters: full.parameters }
    } catch { /* fall through */ }
  }

  const pattern2 = /\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/
  const m2 = text.match(pattern2)
  if (m2) {
    try {
      const full = JSON.parse(m2[0])
      if (full.name && full.arguments) return { name: full.name, parameters: full.arguments }
    } catch { /* fall through */ }
  }

  return null
}

function cleanModelText(text: string): string {
  return text
    .replace(/\{[\s\S]*?"name"\s*:\s*"\w+"[\s\S]*?"(?:parameters|arguments)"\s*:\s*\{[\s\S]*?\}\s*\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTextStream(text: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  })
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, walletAddress, llmConfig } = await req.json()
    const config = getLLMConfig(llmConfig)

    // ── Pre-flight: intercept messages that should never trigger tools ────────
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user") as
      | { role: string; content: string }
      | undefined

    if (lastUserMessage) {
      const text = lastUserMessage.content.trim().toLowerCase()

      // Greeting → reply directly, never touch tools
      const greetingPatterns = [
        /^(hello|hi|hey|sup|yo|howdy|greetings|good\s+(morning|afternoon|evening))[\s!?.]*$/,
        /^what['']?s\s+up[\s!?.]*$/,
        /^how\s+are\s+you[\s!?.]*$/,
      ]
      if (greetingPatterns.some((p) => p.test(text))) {
        return makeTextStream(
          "Hello! I'm Dominus, your Solana DeFi agent. I can check your portfolio, get swap quotes, deposit tokens to earn yield on Kamino, and more. What would you like to do?"
        )
      }

      // Confirmation after a quote → tell user to click the button
      const confirmPatterns = [
        /^(yes|yeah|yep|ok|okay|sure|confirm|do it|go ahead|initiate|execute|proceed|looks good|do the swap|make it happen|deposit it|do the deposit)[\s!?.]*$/,
      ]
      if (confirmPatterns.some((p) => p.test(text))) {
        return makeTextStream(
          "To execute, click the CONFIRM button in the card above. Dominus never executes without your explicit on-screen confirmation."
        )
      }
    }

    // ── Hosted providers: Vercel AI SDK handles everything ────────────────────
    if (config.provider === "anthropic" || config.provider === "openai") {
      const model =
        config.provider === "anthropic"
          ? createAnthropic({ apiKey: config.apiKey })(
              config.model || "claude-sonnet-4-20250514"
            )
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

    // ── Ollama: manual tool loop with text-fallback ───────────────────────────
    const ollama = new Ollama({ host: config.baseUrl || "http://localhost:11434" })

    const ollamaMessages = [
      { role: "system" as const, content: buildSystemPrompt(walletAddress) },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ]

    const ollamaTools: import("ollama").Tool[] = [
      {
        type: "function",
        function: {
          name: "get_portfolio",
          description: allTools.get_portfolio.description,
          parameters: {
            type: "object",
            properties: {
              walletAddress: { type: "string", description: "The user's Solana wallet public key" },
            } as Record<string, { type?: string; description?: string }>,
            required: ["walletAddress"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "swap_tokens",
          description: allTools.swap_tokens.description,
          parameters: {
            type: "object",
            properties: {
              fromToken: { type: "string", description: "Token to swap FROM (e.g. SOL, USDC)" },
              toToken:   { type: "string", description: "Token to swap TO (e.g. USDC, SOL)" },
              amount:    { type: "number", description: "Human-readable amount of fromToken" },
              slippage:  { type: "number", description: "Slippage tolerance % (default 0.5)" },
            } as Record<string, { type?: string; description?: string }>,
            required: ["fromToken", "toToken", "amount"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "deposit_for_yield",
          description: allTools.deposit_for_yield.description,
          parameters: {
            type: "object",
            properties: {
              token:  { type: "string", description: "Token symbol to deposit (USDC, USDT, SOL, MSOL, JITOSOL). Uppercase." },
              amount: { type: "number", description: "Amount of tokens to deposit" },
            } as Record<string, { type?: string; description?: string }>,
            required: ["token", "amount"],
          },
        },
      },
    ]

    // Step 1: initial model call
    const response = await ollama.chat({
      model: config.model,
      messages: ollamaMessages,
      tools: ollamaTools,
      stream: false,
    })

    let finalText = response.message.content || ""
    const toolResults: Array<{ toolName: string; result: unknown }> = []

    // Step 2: resolve tool calls — structured OR text-fallback
    const structuredCalls = response.message.tool_calls ?? []
    const textFallback =
      structuredCalls.length === 0 ? extractToolCallFromText(finalText) : null

    const hasCalls = structuredCalls.length > 0 || textFallback !== null

    if (hasCalls) {
      const toolMessages = [...ollamaMessages, response.message]

      const callsToRun: Array<{ name: string; args: Record<string, unknown> }> =
        structuredCalls.length > 0
          ? structuredCalls.map((tc) => ({
              name: tc.function.name,
              args: tc.function.arguments as Record<string, unknown>,
            }))
          : [{ name: textFallback!.name, args: textFallback!.parameters }]

      for (const call of callsToRun) {
        const executor = toolExecutors[call.name]
        let toolResult: unknown

        try {
          toolResult = executor
            ? await executor(call.args)
            : { error: `Tool "${call.name}" not found` }
        } catch (err) {
          console.error(`[tool:${call.name}] execution error:`, err)
          toolResult = { error: String(err) }
        }

        toolResults.push({ toolName: call.name, result: toolResult })
        toolMessages.push({
          role: "tool" as const,
          content: JSON.stringify(toolResult),
        })
      }

      // Step 3: final human-readable summary
      const finalResponse = await ollama.chat({
        model: config.model,
        messages: [
          ...toolMessages,
          {
            role: "user" as const,
            content:
              "Write a single plain-English sentence summarising the tool result for the user. " +
              "Do NOT include JSON, tool names, or parameter objects. " +
              "Do NOT say a transaction was executed, initiated, sent, or confirmed — it was not. " +
              "Do NOT add any parenthetical notes about your own reasoning or rule-following. " +
              "If the result contains an 'error' field, explain what went wrong in one sentence. " +
              "If the result is a swap_intent, say only: 'Here is your swap quote for [amount] [fromToken] → [toToken].' " +
              "If the result is a kamino_deposit_intent, say only: 'Here is your Kamino deposit preview for [amount] [token].' " +
              "If the result is a portfolio, say only: 'Your wallet holds [X] SOL and [N] token type(s).'",
          },
        ],
        stream: false,
      })

      finalText = finalResponse.message.content || ""
    }

    finalText = cleanModelText(finalText)

    // Stream text + tool result annotations
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(finalText)}\n`))

        if (toolResults.length > 0) {
          controller.enqueue(encoder.encode(`8:${JSON.stringify(toolResults)}\n`))
        }

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
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(walletAddress?: string): string {
  const walletLine = walletAddress
    ? `The user's wallet address is: ${walletAddress}`
    : `The user's wallet is not connected. Ask them to connect their wallet first.`

  return `You are Dominus, an AI assistant for Solana DeFi. You speak only English.

${walletLine}

You have three tools:
- get_portfolio: reads wallet balances and token holdings
- swap_tokens: prepares a Jupiter swap quote (does NOT execute any transaction)
- deposit_for_yield: prepares a Kamino lending deposit preview (does NOT execute any transaction)

CRITICAL — NEVER DO THESE:
- NEVER say a swap or deposit was "initiated", "executed", "sent", "completed", or "confirmed"
- NEVER claim to have performed any on-chain action
- NEVER add parenthetical self-commentary like "(I corrected..." or "(Note: I didn't..."
- NEVER print JSON, tool names, or parameter objects in your response

TOOL CALL RULES:
- ONLY call get_portfolio if the user explicitly asks about balance, portfolio, holdings, or tokens
- ONLY call swap_tokens if the user explicitly asks to swap/trade/convert with a specific amount and tokens
- ONLY call deposit_for_yield if the user explicitly asks to deposit/earn yield/lend tokens
- For greetings — respond with a short greeting, NO tools
- For vague messages — ask a clarifying question, NO tools
- If user says "yes", "confirm", "do it" after seeing a card — tell them to click the Confirm button

CHAINING GUIDANCE:
- If user says "swap X then deposit it" — call swap_tokens first; tell them to confirm the swap, then you can prepare the deposit
- If user says "what's the best yield?" — ask what token they want to deposit, then call deposit_for_yield

RESPONSE FORMAT:
- After get_portfolio: one sentence — SOL balance and token count only
- After swap_tokens: one sentence — "Here is your swap quote for [X] [TOKEN] → [TOKEN]."
- After deposit_for_yield: one sentence — "Here is your Kamino deposit preview for [X] [TOKEN]."
- After an error: one sentence explaining what went wrong`
}
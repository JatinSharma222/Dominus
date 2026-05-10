// app/api/chat/route.ts

import { NextRequest } from "next/server";
import { Ollama } from "ollama";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getLLMConfig } from "@/lib/llm/config";
import { allTools } from "@/lib/tools";
import { executePortfolioRead } from "@/lib/tools/portfolio";
import { executeJupiterSwap } from "@/lib/tools/jupiter";
import { executeKaminoDeposit } from "@/lib/tools/kamino";
import { executeJitoStake } from "@/lib/tools/jito";
import { executeStreamflowPayment } from "@/lib/tools/streamflow";

export const maxDuration = 60;

// ─── Tool executors ───────────────────────────────────────────────────────────

const toolExecutors: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {
  get_portfolio: (args) =>
    executePortfolioRead(args as { walletAddress: string }),
  swap_tokens: (args) =>
    executeJupiterSwap(
      args as {
        fromToken: string;
        toToken: string;
        amount: number;
        slippage: number;
      },
    ),
  deposit_for_yield: (args) =>
    executeKaminoDeposit(args as { token: string; amount: number }),
  stake_sol: (args) => executeJitoStake(args as { amount: number }),
  create_payment_stream: (args) =>
    executeStreamflowPayment(
      args as {
        recipient: string;
        token: string;
        amountPerPeriod: number;
        frequency: "daily" | "weekly" | "monthly";
        totalPeriods?: number;
      },
    ),
};

// ─── Fallback: extract tool call from plain-text model output ─────────────────

interface ParsedToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

function extractToolCallFromText(text: string): ParsedToolCall | null {
  const pattern1 =
    /\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?"parameters"\s*:\s*(\{[\s\S]*?\})\s*\}/;
  const m1 = text.match(pattern1);
  if (m1) {
    try {
      const full = JSON.parse(m1[0]);
      if (full.name && full.parameters)
        return { name: full.name, parameters: full.parameters };
    } catch {
      /* fall through */
    }
  }

  const pattern2 =
    /\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/;
  const m2 = text.match(pattern2);
  if (m2) {
    try {
      const full = JSON.parse(m2[0]);
      if (full.name && full.arguments)
        return { name: full.name, parameters: full.arguments };
    } catch {
      /* fall through */
    }
  }

  return null;
}

function cleanModelText(text: string): string {
  return text
    .replace(
      /\{[\s\S]*?"name"\s*:\s*"\w+"[\s\S]*?"(?:parameters|arguments)"\s*:\s*\{[\s\S]*?\}\s*\}/g,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Proactive suggestion engine ──────────────────────────────────────────────

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

const MIN_SOL_FOR_STAKE_SUGGESTION = 0.5;
const MIN_STABLE_FOR_YIELD_SUGGESTION = 10;

interface PortfolioResult {
  solBalance?: number;
  tokens?: Array<{ mint: string; amount: number }>;
}

function buildProactiveSuggestion(portfolio: PortfolioResult): string | null {
  const solBalance = portfolio.solBalance ?? 0;
  const tokens = portfolio.tokens ?? [];

  const usdcAmount = tokens.find((t) => t.mint === USDC_MINT)?.amount ?? 0;
  const usdtAmount = tokens.find((t) => t.mint === USDT_MINT)?.amount ?? 0;

  const stableToken = usdcAmount >= usdtAmount ? "USDC" : "USDT";
  const stableAmount = Math.max(usdcAmount, usdtAmount);

  if (solBalance >= MIN_SOL_FOR_STAKE_SUGGESTION) {
    return (
      `💡 You have ${solBalance.toFixed(2)} SOL sitting idle — ` +
      `want me to stake it with Jito for ~8% APY? Just say "stake my SOL".`
    );
  }

  if (stableAmount >= MIN_STABLE_FOR_YIELD_SUGGESTION) {
    return (
      `💡 You have ${stableAmount.toFixed(2)} ${stableToken} sitting idle — ` +
      `want me to deposit it to Kamino to earn yield? Just say "deposit my ${stableToken}".`
    );
  }

  return null;
}

// ─── Summary prompt builder ───────────────────────────────────────────────────

function buildSummaryPrompt(
  toolResults: Array<{ toolName: string; result: unknown }>,
): string {
  const instructions = toolResults.map(({ toolName, result }) => {
    const r = result as Record<string, unknown>;
    if (r?.error)
      return `For the ${toolName} error: explain what went wrong in one sentence.`;

    switch (toolName) {
      case "get_portfolio": {
        // If prices were fetched successfully, direct the model to use the
        // pre-built summary string which contains all USD values.
        const hasPrices = r?.hasPrices === true;
        return hasPrices
          ? `For the portfolio: read the "summary" field from the result — it contains the exact SOL balance with USD value, token balances with USD values, and total portfolio value. Report these numbers accurately in 1-2 natural English sentences. Include the USD values.`
          : `For the portfolio: say exactly 'Your wallet holds [X] SOL and [N] token type(s).' filling in real values.`;
      }
      case "swap_tokens":
        return "For the swap: say exactly 'Here is your swap quote for [amount] [fromToken] → [toToken].' filling in real values.";
      case "deposit_for_yield":
        return "For the deposit: say exactly 'Here is your Kamino deposit preview for [amount] [token].' filling in real values.";
      case "stake_sol":
        return "For the stake: say exactly 'Here is your Jito liquid stake preview for [amount] SOL.' filling in real values.";
      case "create_payment_stream":
        return "For the payment stream: say exactly 'Here is your Streamflow payment stream for [amountPerPeriod] [token] [frequency] to [recipient shortened to first 4 + last 4 chars].' filling in real values.";
      default:
        return `For ${toolName}: summarise the result in one plain-English sentence.`;
    }
  });

  const multiStep = toolResults.length > 1;

  return [
    multiStep
      ? "Write a short summary (one sentence per action) covering each of the following results in order:"
      : "Write a single plain-English sentence covering the following result:",
    ...instructions,
    "",
    "RULES — violating any of these is wrong:",
    "- Do NOT include JSON, code, tool names, or parameter objects",
    "- Do NOT say any transaction was executed, initiated, sent, completed, or confirmed — none were",
    "- Do NOT add parenthetical self-commentary or reasoning notes",
    "- Do NOT use markdown formatting",
    "- Respond only in English",
  ].join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTextStream(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, walletAddress, llmOverride } = await req.json();

    // If GROQ_API_KEY is set on the server, always use Groq — ignore client override
    const config = process.env.GROQ_API_KEY
      ? getLLMConfig({ provider: "groq", apiKey: process.env.GROQ_API_KEY })
      : getLLMConfig(
          llmOverride
            ? {
                provider: llmOverride.provider,
                model: llmOverride.model || undefined,
                baseUrl: llmOverride.baseUrl || undefined,
                apiKey: llmOverride.apiKey || undefined,
              }
            : undefined,
        );

    // ── Pre-flight: intercept messages that should never trigger tools ────────
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user") as
      | { role: string; content: string }
      | undefined;

    if (lastUserMessage) {
      const text = lastUserMessage.content.trim().toLowerCase();

      const greetingPatterns = [
        /^(hello|hi|hey|sup|yo|howdy|greetings|good\s+(morning|afternoon|evening))[\s!?.]*$/,
        /^what['']?s\s+up[\s!?.]*$/,
        /^how\s+are\s+you[\s!?.]*$/,
      ];
      if (greetingPatterns.some((p) => p.test(text))) {
        return makeTextStream(
          "Hello! I'm Dominus, your Solana DeFi agent. I can check your portfolio, get swap quotes, deposit tokens to earn yield on Kamino, liquid stake SOL with Jito, and set up recurring payment streams with Streamflow. What would you like to do?",
        );
      }

      const confirmPatterns = [
        /^(yes|yeah|yep|ok|okay|sure|confirm|do it|go ahead|initiate|execute|proceed|looks good|do the swap|make it happen|deposit it|do the deposit|stake it|do the stake|create it|send it)[\s!?.]*$/,
      ];
      if (confirmPatterns.some((p) => p.test(text))) {
        return makeTextStream(
          "To execute, click the CONFIRM button in the card above. Dominus never executes without your explicit on-screen confirmation.",
        );
      }
    }

    // ── Hosted providers: Vercel AI SDK handles everything ────────────────────
    if (
      config.provider === "anthropic" ||
      config.provider === "openai" ||
      config.provider === "groq"
    ) {
      const groqOrOpenAI = createOpenAI({
        apiKey: config.apiKey,
        ...(config.provider === "groq"
          ? { baseURL: "https://api.groq.com/openai/v1" }
          : {}),
      });
      const model =
        config.provider === "anthropic"
          ? createAnthropic({ apiKey: config.apiKey })(
              config.model || "claude-sonnet-4-20250514",
            )
          : groqOrOpenAI(
              config.provider === "groq"
                ? "llama-3.3-70b-versatile"
                : config.model || "gpt-4o",
            );

      const result = streamText({
        model,
        system: buildSystemPrompt(walletAddress),
        messages,
        tools: allTools,
        maxSteps: 5,
      });
      return result.toDataStreamResponse();
    }

    // ── Ollama: agentic tool loop with text-fallback ──────────────────────────

    const ollama = new Ollama({
      host: config.baseUrl || "http://localhost:11434",
    });

    const ollamaMessages = [
      { role: "system" as const, content: buildSystemPrompt(walletAddress) },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const ollamaTools: import("ollama").Tool[] = [
      {
        type: "function",
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
              fromToken: {
                type: "string",
                description: "Token to swap FROM (e.g. SOL, USDC)",
              },
              toToken: {
                type: "string",
                description: "Token to swap TO (e.g. USDC, SOL)",
              },
              amount: {
                type: "number",
                description: "Human-readable amount of fromToken",
              },
              slippage: {
                type: "number",
                description: "Slippage tolerance % (default 0.5)",
              },
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
              token: {
                type: "string",
                description:
                  "Token symbol to deposit (USDC, USDT, SOL, MSOL, JITOSOL). Uppercase.",
              },
              amount: {
                type: "number",
                description: "Amount of tokens to deposit",
              },
            } as Record<string, { type?: string; description?: string }>,
            required: ["token", "amount"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "stake_sol",
          description: allTools.stake_sol.description,
          parameters: {
            type: "object",
            properties: {
              amount: {
                type: "number",
                description: "Amount of SOL to liquid stake with Jito",
              },
            } as Record<string, { type?: string; description?: string }>,
            required: ["amount"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_payment_stream",
          description: allTools.create_payment_stream.description,
          parameters: {
            type: "object",
            properties: {
              recipient: {
                type: "string",
                description:
                  "Recipient's Solana wallet public key (base58). Required.",
              },
              token: {
                type: "string",
                description:
                  "Token symbol to stream: USDC, USDT, or SOL. Default: USDC.",
              },
              amountPerPeriod: {
                type: "number",
                description: "Amount of tokens to release per period.",
              },
              frequency: {
                type: "string",
                description:
                  "Release frequency: 'daily', 'weekly', or 'monthly'.",
              },
              totalPeriods: {
                type: "number",
                description:
                  "Total number of periods. Optional — defaults to 30/12/6 for daily/weekly/monthly.",
              },
            } as Record<string, { type?: string; description?: string }>,
            required: ["recipient", "amountPerPeriod", "frequency"],
          },
        },
      },
    ];

    const MAX_TOOL_ROUNDS = 3;
    let finalText = "";
    const toolResults: Array<{ toolName: string; result: unknown }> = [];
    const toolMessages = [...ollamaMessages];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await ollama.chat({
        model: config.model,
        messages: toolMessages,
        tools: ollamaTools,
        stream: false,
      });

      const structuredCalls = response.message.tool_calls ?? [];
      const responseText = response.message.content || "";
      const textFallback =
        structuredCalls.length === 0
          ? extractToolCallFromText(responseText)
          : null;
      const hasCalls = structuredCalls.length > 0 || textFallback !== null;

      if (!hasCalls) {
        finalText = responseText;
        break;
      }

      toolMessages.push(response.message);

      const callsToRun: Array<{ name: string; args: Record<string, unknown> }> =
        structuredCalls.length > 0
          ? structuredCalls.map((tc) => ({
              name: tc.function.name,
              args: tc.function.arguments as Record<string, unknown>,
            }))
          : [{ name: textFallback!.name, args: textFallback!.parameters }];

      for (const call of callsToRun) {
        const executor = toolExecutors[call.name];
        let toolResult: unknown;

        try {
          toolResult = executor
            ? await executor(call.args)
            : { error: `Tool "${call.name}" not found` };
        } catch (err) {
          console.error(`[tool:${call.name}] execution error:`, err);
          toolResult = { error: String(err) };
        }

        console.log(
          `[tool:${call.name}] round=${round}`,
          JSON.stringify(toolResult).slice(0, 200),
        );
        toolResults.push({ toolName: call.name, result: toolResult });
        toolMessages.push({
          role: "tool" as const,
          content: JSON.stringify(toolResult),
        });
      }
    }

    if (toolResults.length > 0) {
      const summaryResponse = await ollama.chat({
        model: config.model,
        messages: [
          ...toolMessages,
          {
            role: "user" as const,
            content: buildSummaryPrompt(toolResults),
          },
        ],
        stream: false,
      });
      finalText = summaryResponse.message.content || "";
    }

    finalText = cleanModelText(finalText);

    // ── Proactive suggestion (Ollama path) ────────────────────────────────────
    const portfolioToolResult = toolResults.find(
      (r) => r.toolName === "get_portfolio",
    );
    if (
      portfolioToolResult &&
      !(portfolioToolResult.result as Record<string, unknown>)?.error
    ) {
      const suggestion = buildProactiveSuggestion(
        portfolioToolResult.result as PortfolioResult,
      );
      if (suggestion) {
        finalText = finalText ? `${finalText}\n\n${suggestion}` : suggestion;
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(finalText)}\n`));
        if (toolResults.length > 0) {
          controller.enqueue(
            encoder.encode(`8:${JSON.stringify(toolResults)}\n`),
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  } catch (error) {
    console.error("[chat/route] error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(walletAddress?: string): string {
  const walletLine = walletAddress
    ? `The user's wallet address is: ${walletAddress}`
    : `The user's wallet is not connected. Ask them to connect their wallet first.`;

  return `You are Dominus, an AI assistant for Solana DeFi. You speak only English.

${walletLine}

You have five tools:
- get_portfolio: reads wallet balances and token holdings including live USD prices
- swap_tokens: prepares a Jupiter swap quote (does NOT execute any transaction)
- deposit_for_yield: prepares a Kamino lending deposit preview (does NOT execute any transaction)
- stake_sol: prepares a Jito liquid stake preview — stake SOL, receive jitoSOL, earn ~8% APY (does NOT execute any transaction)
- create_payment_stream: prepares a Streamflow recurring payment stream preview (does NOT execute any transaction)

CRITICAL — NEVER DO THESE:
- NEVER say a swap, deposit, stake, or stream was "initiated", "executed", "sent", "completed", or "confirmed"
- NEVER claim to have performed any on-chain action
- NEVER add parenthetical self-commentary like "(I corrected..." or "(Note: I didn't..."
- NEVER print JSON, tool names, or parameter objects in your response

TOOL CALL RULES:
- ONLY call get_portfolio if the user explicitly asks about balance, portfolio, holdings, or tokens
- ONLY call swap_tokens if the user explicitly asks to swap/trade/convert with a specific amount and tokens
- ONLY call deposit_for_yield if the user explicitly asks to deposit/earn yield/lend tokens with Kamino
- ONLY call stake_sol if the user explicitly asks to stake SOL, get jitoSOL, or earn staking yield on SOL
- ONLY call create_payment_stream if the user explicitly asks to send recurring/scheduled/streaming payments
- For greetings — respond with a short greeting, NO tools
- For vague messages — ask a clarifying question, NO tools
- If user says "yes", "confirm", "do it", "stake it", "create it" after seeing a card — tell them to click the Confirm button
- When the user says "stream it" or "stream weekly/monthly" after a swap, ONLY call create_payment_stream. NEVER call deposit_for_yield in the same request unless the user explicitly says "deposit to Kamino".

CHOOSING BETWEEN KAMINO AND JITO:
- stake_sol is ONLY for SOL → jitoSOL liquid staking (validator rewards + MEV tips)
- deposit_for_yield is for USDC, USDT, SOL, mSOL, BSOL, BONK into Kamino lending markets
- If the user says "earn yield on SOL" without specifying Jito/Kamino — prefer stake_sol (higher APY, simpler)
- If the user says "lend SOL" or "deposit SOL to Kamino" — use deposit_for_yield with token=SOL

PAYMENT STREAM RULES:
- create_payment_stream requires a recipient wallet address — if the user hasn't provided one, ask for it before calling the tool
- If the user says "send $50 USDC weekly to [address]" — call create_payment_stream with recipient, token=USDC, amountPerPeriod=50, frequency=weekly
- If no token is specified, default to USDC
- If no frequency is specified, ask the user — do not guess

MULTI-STEP CHAINING RULES:
- If the user message contains BOTH a swap intent AND a deposit intent (e.g. "swap 1 SOL to USDC then deposit it"):
  call swap_tokens FIRST with the correct tokens and amount.
  Then immediately call deposit_for_yield using the swap's OUTPUT token as the deposit token.
  Example: "swap 1 SOL to USDC then deposit it" → swap_tokens(SOL→USDC, 1) then deposit_for_yield(token=USDC, amount=1).
  NEVER call deposit_for_yield without an explicit token — always infer it from the swap output token.
  Do NOT wait for confirmation between them — both intents are explicit in the message.
- If the user says "swap X to USDC and put it in Kamino" — same as above, deposit token = USDC.
- If the user says "check my portfolio then swap" — call get_portfolio first, then swap_tokens.
- Always resolve ALL explicit intents from a single user message before writing your response.

PROACTIVE SUGGESTIONS (hosted providers only):
After calling get_portfolio, inspect the returned data and add ONE suggestion if applicable:
- If solBalance >= 0.5: add "💡 You have [X] SOL sitting idle — want me to stake it with Jito for ~8% APY? Just say 'stake my SOL'."
- Else if USDC or USDT balance >= 10: add "💡 You have [X] [TOKEN] sitting idle — want me to deposit it to Kamino to earn yield? Just say 'deposit my [TOKEN]'."
- Only suggest one thing. Do not suggest if balances are below the thresholds. Do not suggest if the user already has an active action card.

RESPONSE FORMAT:
- After get_portfolio: report the SOL balance with USD value (e.g. "0.2425 SOL worth $20.37"), total portfolio value in USD if available, and token count — then one proactive suggestion line if applicable
- After swap_tokens: one sentence — "Here is your swap quote for [X] [TOKEN] → [TOKEN]."
- After deposit_for_yield: one sentence — "Here is your Kamino deposit preview for [X] [TOKEN]."
- After stake_sol: one sentence — "Here is your Jito liquid stake preview for [X] SOL."
- After create_payment_stream: one sentence — "Here is your Streamflow payment stream for [X] [TOKEN] [frequency] to [shortened address]."
- After multiple tools in one message: one sentence per action, in order called
- After an error: one sentence explaining what went wrong`;
}

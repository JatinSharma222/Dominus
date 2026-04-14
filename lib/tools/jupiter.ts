// lib/tools/jupiter.ts

import { z } from "zod"
import { VersionedTransaction, PublicKey } from "@solana/web3.js"

const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote"
const JUPITER_SWAP_API  = "https://lite-api.jup.ag/swap/v1/swap"

const KNOWN_MINTS: Record<string, string> = {
  SOL:     "So11111111111111111111111111111111111111112",
  USDC:    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT:    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK:    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP:     "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  WIF:     "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  PYTH:    "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  RAY:     "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  ORCA:    "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  MSOL:    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  JITOSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  BSOL:    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
  STSOL:   "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JupiterQuote {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFee: { amount: string; feeBps: number } | null
  priceImpactPct: string
  routePlan: RoutePlan[]
  contextSlot: number
  timeTaken: number
}

interface RoutePlan {
  swapInfo: {
    ammKey: string
    label: string
    inputMint: string
    outputMint: string
    inAmount: string
    outAmount: string
    feeAmount: string
    feeMint: string
  }
  percent: number
}

// Returned by the server-side AI tool — no Jupiter API call needed
export interface JupiterSwapIntent {
  type: "swap_intent"
  action: "swap"
  protocol: "Jupiter"
  fromToken: string
  toToken: string
  fromMint: string
  toMint: string
  inputAmount: number
  slippageBps: number
}

// Built client-side after fetching a live quote
export interface JupiterSwapPreview {
  type: "tx_preview"
  action: "swap"
  protocol: "Jupiter"
  fromToken: string
  toToken: string
  fromMint: string
  toMint: string
  inputAmount: number
  outputAmount: number
  outputAmountRaw: string
  fee: number | null
  priceImpact: string
  slippageBps: number
  route: RoutePlan[]
  routeLabel: string
  quoteResponse: JupiterQuote
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const jupiterSwapTool = {
  description:
    "Swap one token for another at the best available price on Solana using Jupiter aggregator. " +
    "Use this when the user wants to exchange, swap, convert, buy, sell, or trade tokens. " +
    "Examples: 'swap 1 SOL to USDC', 'convert 50 USDC to BONK', 'trade my JUP for SOL'.",
  parameters: z.object({
    fromToken: z.string().describe("Token symbol to swap FROM (e.g. SOL, USDC, BONK). Uppercase."),
    toToken:   z.string().describe("Token symbol to swap TO (e.g. USDC, SOL, JUP). Uppercase."),
    amount:    z.number().positive().describe("Human-readable amount of fromToken to swap."),
    slippage:  z.number().min(0.1).max(50).default(0.5).describe("Slippage tolerance % (default 0.5)."),
  }),
}

// ─── Token decimals ───────────────────────────────────────────────────────────

export const TOKEN_DECIMALS: Record<string, number> = {
  SOL:     9,
  USDC:    6,
  USDT:    6,
  BONK:    5,
  JUP:     6,
  WIF:     6,
  PYTH:    6,
  RAY:     6,
  ORCA:    6,
  MSOL:    9,
  JITOSOL: 9,
  BSOL:    9,
  STSOL:   9,
}

export function toRawAmount(amount: number, symbol: string): string {
  const decimals = TOKEN_DECIMALS[symbol.toUpperCase()] ?? 6
  return Math.floor(amount * Math.pow(10, decimals)).toString()
}

export function fromRawAmount(rawAmount: string, symbol: string): number {
  const decimals = TOKEN_DECIMALS[symbol.toUpperCase()] ?? 6
  return parseInt(rawAmount, 10) / Math.pow(10, decimals)
}

// ─── Mint resolution (server-safe — only calls Jupiter token list if unknown) ─

async function resolveMint(symbol: string): Promise<string> {
  const upper = symbol.toUpperCase()
  if (KNOWN_MINTS[upper]) return KNOWN_MINTS[upper]

  if (symbol.length >= 32 && symbol.length <= 44) {
    try { new PublicKey(symbol); return symbol } catch { /* fall through */ }
  }

  const res = await fetch("https://token.jup.ag/strict")
  if (!res.ok) throw new Error(`Jupiter token list fetch failed: ${res.status}`)
  const tokens = (await res.json()) as Array<{ symbol: string; address: string }>
  const match = tokens.find((t) => t.symbol.toUpperCase() === upper)
  if (!match) throw new Error(`Unknown token "${symbol}". Check the symbol or use the mint address.`)
  return match.address
}

// ─── SERVER-SIDE tool execute ─────────────────────────────────────────────────
// Only resolves mint addresses. No call to quote-api.jup.ag.
// The actual quote is fetched client-side in TxConfirmCard.

export async function executeJupiterSwap({
  fromToken,
  toToken,
  amount,
  slippage,
}: {
  fromToken: string
  toToken: string
  amount: number
  slippage: number
}): Promise<JupiterSwapIntent> {
  const fromUpper = fromToken.toUpperCase()
  const toUpper   = toToken.toUpperCase()

  const [fromMint, toMint] = await Promise.all([
    resolveMint(fromUpper),
    resolveMint(toUpper),
  ])

  return {
    type:        "swap_intent",
    action:      "swap",
    protocol:    "Jupiter",
    fromToken:   fromUpper,
    toToken:     toUpper,
    fromMint,
    toMint,
    inputAmount: amount,
    slippageBps: Math.round((slippage ?? 0.5) * 100),

  }
}

// ─── CLIENT-SIDE quote fetch ──────────────────────────────────────────────────
// Called from TxConfirmCard in the browser — never from route.ts.

export async function fetchJupiterQuote(intent: JupiterSwapIntent): Promise<JupiterSwapPreview> {
  const rawAmount = toRawAmount(intent.inputAmount, intent.fromToken)

  const params = new URLSearchParams({
    inputMint:        intent.fromMint,
    outputMint:       intent.toMint,
    amount:           rawAmount,
    slippageBps:      (intent.slippageBps ?? 50).toString(),
    onlyDirectRoutes: "false",
  })

  // Try proxy first, fall back to direct Jupiter call
  let res: Response | null = null
  let lastError = ""

  // Attempt 1: our Next.js proxy
  try {
    const proxyUrl = new URL("/api/jupiter/quote", window.location.origin)
    params.forEach((v, k) => proxyUrl.searchParams.set(k, v))
    res = await fetch(proxyUrl.toString(), { headers: { "Accept": "application/json" } })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res!.statusText }))
      lastError = body.error ?? `Proxy returned ${res.status}`
      res = null
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    res = null
  }

  // Attempt 2: direct browser fetch (Jupiter supports CORS)
  if (!res) {
    try {
      const directUrl = new URL("https://lite-api.jup.ag/swap/v1/quote")
      params.forEach((v, k) => directUrl.searchParams.set(k, v))
      res = await fetch(directUrl.toString(), {
        headers: {
          "Accept":  "application/json",
          "Origin":  window.location.origin,
          "Referer": window.location.origin + "/",
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res!.statusText }))
        throw new Error(body.error ?? `Quote failed (${res.status})`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Quote unavailable. Proxy: ${lastError}. Direct: ${msg}`)
    }
  }

  const quote = await res.json() as JupiterQuote
  const outputAmount = fromRawAmount(quote.outAmount, intent.toToken)

  const hops = quote.routePlan.length
  const dexes = [...new Set(quote.routePlan.map((r) => r.swapInfo.label))].join(", ")
  const routeLabel = hops <= 1
    ? `${intent.fromToken} → ${intent.toToken}${hops === 1 ? ` via ${dexes}` : ""}`
    : `${intent.fromToken} → ${intent.toToken} (${hops} hops via ${dexes})`

  return {
    type:            "tx_preview",
    action:          "swap",
    protocol:        "Jupiter",
    fromToken:       intent.fromToken,
    toToken:         intent.toToken,
    fromMint:        intent.fromMint,
    toMint:          intent.toMint,
    inputAmount:     intent.inputAmount,
    outputAmount,
    outputAmountRaw: quote.outAmount,
    fee:             quote.platformFee?.feeBps ?? null,
    priceImpact:     quote.priceImpactPct,
    slippageBps:     intent.slippageBps,
    route:           quote.routePlan,
    routeLabel,
    quoteResponse:   quote,
  }
}
// ─── CLIENT-SIDE transaction builder ─────────────────────────────────────────
// Called from TxConfirmCard after user clicks Confirm. Never from route.ts.

export async function buildJupiterSwapTransaction(
  preview: JupiterSwapPreview,
  userPublicKey: string
): Promise<VersionedTransaction> {
  const res = await fetch(JUPITER_SWAP_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse:             preview.quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol:          true,
      dynamicComputeUnitLimit:   true,
      prioritizationFeeLamports: "auto",
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Jupiter swap build failed (${res.status}): ${body}`)
  }

  const { swapTransaction } = await res.json() as { swapTransaction: string }
  const txBytes = Buffer.from(swapTransaction, "base64")
  return VersionedTransaction.deserialize(txBytes)
}
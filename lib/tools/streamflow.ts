// lib/tools/streamflow.ts
//
// Streamflow Finance — on-chain recurring payment streams.
// Unlike Kamino and Jito, Streamflow has devnet support.
// Tx creation happens client-side in StreamflowPaymentCard
// using the wallet adapter for signing — no server route needed.

import { z } from "zod"
import { isValidPublicKey } from "@/lib/solana"

// ─── Token config ─────────────────────────────────────────────────────────────

const STREAMFLOW_TOKENS: Record<
  string,
  { devnetMint: string; mainnetMint: string; decimals: number }
> = {
  USDC: {
    devnetMint:  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Circle devnet USDC
    mainnetMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  USDT: {
    devnetMint:  "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",
    mainnetMint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
  SOL: {
    devnetMint:  "So11111111111111111111111111111111111111112",
    mainnetMint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
}

export const FREQUENCY_SECONDS: Record<string, number> = {
  daily:   86400,
  weekly:  604800,
  monthly: 2592000, // 30 × 24 × 3600
}

// Default number of periods if the user doesn't specify a total duration
const DEFAULT_PERIODS: Record<string, number> = {
  daily:   30,
  weekly:  12,
  monthly: 6,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamflowPaymentIntent {
  type:            "streamflow_payment_intent"
  action:          "create_stream"
  protocol:        "Streamflow"
  token:           string
  devnetMint:      string
  mainnetMint:     string
  decimals:        number
  recipient:       string
  amountPerPeriod: number
  frequency:       "daily" | "weekly" | "monthly"
  periodSeconds:   number
  totalPeriods:    number
  totalAmount:     number // amountPerPeriod × totalPeriods
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const streamflowPaymentTool = {
  description:
    "Create a recurring on-chain payment stream using Streamflow Finance. " +
    "Use when the user wants to send tokens to someone repeatedly on a schedule: " +
    "'send $50 USDC to [address] every week', 'pay 100 USDC monthly to [wallet]', " +
    "'stream 10 USDC daily to [address]', 'set up a recurring payment for my team'. " +
    "The recipient can withdraw their earned portion at any time. " +
    "The sender can cancel the stream and reclaim unsent funds whenever they want. " +
    "REQUIRES a recipient Solana wallet address — ask for it if not provided.",
  parameters: z.object({
    recipient: z.string().describe(
      "Recipient's Solana wallet public key (base58). Required — do not guess."
    ),
    token: z.string().default("USDC").describe(
      "Token symbol to stream. Supported: USDC, USDT, SOL. Defaults to USDC if not specified."
    ),
    amountPerPeriod: z.number().positive().describe(
      "Amount of tokens to release per period. E.g. 50 means $50 USDC per week."
    ),
    frequency: z.enum(["daily", "weekly", "monthly"]).describe(
      "How often to release funds to the recipient: 'daily', 'weekly', or 'monthly'."
    ),
    totalPeriods: z.number().int().positive().optional().describe(
      "Total number of payment periods. If omitted: 30 (daily), 12 (weekly), 6 (monthly)."
    ),
  }),
}

// ─── Server-side executor ─────────────────────────────────────────────────────
// Validates inputs and returns a StreamflowPaymentIntent.
// Actual tx creation happens client-side via Streamflow SDK + wallet adapter.

export async function executeStreamflowPayment({
  recipient,
  token,
  amountPerPeriod,
  frequency,
  totalPeriods,
}: {
  recipient:       string
  token:           string
  amountPerPeriod: number
  frequency:       "daily" | "weekly" | "monthly"
  totalPeriods?:   number
}): Promise<StreamflowPaymentIntent> {
  if (!isValidPublicKey(recipient)) {
    throw new Error(
      `Invalid recipient wallet address: "${recipient}". Please provide a valid Solana public key.`
    )
  }

  const upperToken  = (token || "USDC").toUpperCase()
  const tokenConfig = STREAMFLOW_TOKENS[upperToken] ?? STREAMFLOW_TOKENS.USDC
  const periodSecs  = FREQUENCY_SECONDS[frequency]  ?? FREQUENCY_SECONDS.weekly
  const periods     = totalPeriods && totalPeriods > 0 ? totalPeriods : DEFAULT_PERIODS[frequency] ?? 12

  return {
    type:            "streamflow_payment_intent",
    action:          "create_stream",
    protocol:        "Streamflow",
    token:           upperToken,
    devnetMint:      tokenConfig.devnetMint,
    mainnetMint:     tokenConfig.mainnetMint,
    decimals:        tokenConfig.decimals,
    recipient,
    amountPerPeriod,
    frequency,
    periodSeconds:   periodSecs,
    totalPeriods:    periods,
    totalAmount:     amountPerPeriod * periods,
  }
}
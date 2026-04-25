// lib/tools/kamino.ts

import { z } from "zod"

// ─── Supported tokens on Kamino main lending market ──────────────────────────
// Market: 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF (mainnet)

const KAMINO_TOKENS: Record<string, { mint: string; decimals: number }> = {
  USDC:    { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT:    { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  SOL:     { mint: "So11111111111111111111111111111111111111112",   decimals: 9 },
  MSOL:    { mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  decimals: 9 },
  JITOSOL: { mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9 },
  BSOL:    { mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",  decimals: 9 },
  BONK:    { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
}

export const KAMINO_MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"

// ─── Types ────────────────────────────────────────────────────────────────────

// Returned by server-side tool — no Kamino API call here
export interface KaminoDepositIntent {
  type: "kamino_deposit_intent"
  action: "deposit"
  protocol: "Kamino"
  token: string
  mint: string
  decimals: number
  amount: number
  marketAddress: string
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const kaminoDepositTool = {
  description:
    "Deposit tokens into Kamino Finance lending protocol to earn yield and interest. " +
    "Use this when the user wants to earn yield, supply tokens for interest, deposit into lending, " +
    "or asks for 'best yield', 'earn on my USDC', 'put my tokens to work'. " +
    "Also use after a swap when the user says 'now deposit it' or 'earn yield with that'. " +
    "Supported tokens: USDC, USDT, SOL, mSOL, JitoSOL, BSOL, BONK. " +
    "Examples: 'deposit 100 USDC to Kamino', 'earn yield on my USDC', 'put 50 USDT into lending'.",
  parameters: z.object({
    token:  z.string().describe("Token symbol to deposit (USDC, USDT, SOL, MSOL, JITOSOL, BSOL, BONK). Always uppercase."),
    amount: z.number().positive().describe("Amount of tokens to deposit. Human-readable number."),
  }),
}

// ─── Server-side executor ─────────────────────────────────────────────────────
// Only resolves token info and returns intent.
// APY fetch + tx build happens client-side in KaminoDepositCard.

export async function executeKaminoDeposit({
  token,
  amount,
}: {
  token: string
  amount: number
}): Promise<KaminoDepositIntent> {
  // Guard: model sometimes omits token when chaining ("deposit it").
  // Default to USDC — the most common swap output and Kamino deposit token.
  if (!token || typeof token !== "string" || token.trim() === "") {
    token = "USDC"
  }

  const upper = token.toUpperCase()
  const tokenInfo = KAMINO_TOKENS[upper]

  if (!tokenInfo) {
    const supported = Object.keys(KAMINO_TOKENS).join(", ")
    throw new Error(
      `Kamino lending does not support "${token}". Supported tokens: ${supported}.`
    )
  }

  return {
    type:          "kamino_deposit_intent",
    action:        "deposit",
    protocol:      "Kamino",
    token:         upper,
    mint:          tokenInfo.mint,
    decimals:      tokenInfo.decimals,
    amount,
    marketAddress: KAMINO_MAIN_MARKET,
  }
}
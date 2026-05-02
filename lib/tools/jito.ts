// lib/tools/jito.ts
//
// Jito liquid staking — stake SOL, receive jitoSOL, earn ~8% APY
// from validator rewards + MEV tips.
//
// Jito is a MAINNET protocol — no devnet deployment exists.
// Tx execution is blocked on devnet (same pattern as Kamino).

import { z } from "zod"

// ─── Constants ────────────────────────────────────────────────────────────────

export const JITO_STAKE_POOL_ADDRESS = "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"
export const JITOSOL_MINT            = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JitoStakeIntent {
  type:            "jito_stake_intent"
  action:          "stake"
  protocol:        "Jito"
  token:           "SOL"
  receiveToken:    "jitoSOL"
  receiveMint:     string
  amount:          number       // SOL amount to stake
  stakePoolAddress: string
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const jitoStakeTool = {
  description:
    "Liquid-stake SOL with Jito Finance to earn staking rewards (validator APY + MEV tips, ~8% APY). " +
    "The user receives jitoSOL in return — a liquid token that can be used in DeFi while still earning yield. " +
    "Use this when the user wants to stake SOL, earn staking yield, stake for MEV rewards, " +
    "or asks to 'put idle SOL to work', 'stake my SOL', 'get jitoSOL', or 'earn on SOL'. " +
    "Only SOL can be staked via this tool. " +
    "Examples: 'stake 1 SOL with Jito', 'liquid stake 2 SOL', 'earn yield on my SOL'.",
  parameters: z.object({
    amount: z.number().positive().describe(
      "Amount of SOL to stake. Human-readable number. Must be greater than 0."
    ),
  }),
}

// ─── Server-side executor ─────────────────────────────────────────────────────
// Only builds the intent — no Jito API call here.
// APY fetch + tx build happens client-side in JitoStakeCard.

export async function executeJitoStake({
  amount,
}: {
  amount: number
}): Promise<JitoStakeIntent> {
  if (!amount || amount <= 0) {
    throw new Error("Stake amount must be greater than 0 SOL.")
  }

  return {
    type:             "jito_stake_intent",
    action:           "stake",
    protocol:         "Jito",
    token:            "SOL",
    receiveToken:     "jitoSOL",
    receiveMint:      JITOSOL_MINT,
    amount,
    stakePoolAddress: JITO_STAKE_POOL_ADDRESS,
  }
}
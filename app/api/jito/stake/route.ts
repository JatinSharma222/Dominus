// app/api/jito/stake/route.ts
//
// Builds an unsigned Jito liquid-stake transaction on mainnet.
// Returns base64-serialised unsigned VersionedTransaction for the wallet to sign.
//
// DEVNET GUARD: Returns 503 with a clear explanation during Weeks 2-3.
// Week 4: remove the devnet guard and uncomment the mainnet tx builder below.
//
// NEVER signs — signing is always done by the user's wallet (Phantom/Solflare).

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  // ── Devnet guard ───────────────────────────────────────────────────────────
  // Jito staking operates on mainnet only.
  // Full tx building is enabled in Week 4 when NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta.
  if (process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet-beta") {
    return NextResponse.json(
      {
        error:
          "Jito liquid staking is a mainnet protocol. " +
          "Transaction execution will be enabled in Week 4 when the app switches to mainnet. " +
          "The preview above shows accurate APY and projected earnings.",
      },
      { status: 503 }
    )
  }

  // ── Week 4: Mainnet transaction builder ─────────────────────────────────────
  // Uncomment below when switching to mainnet and install:
  //   npm install @jito-foundation/stake-pool-sdk
  //
  // const { amount, walletAddress } = await req.json()
  //
  // import { PublicKey, Connection } from "@solana/web3.js"
  // import { getStakePoolAccount, depositSol } from "@jito-foundation/stake-pool-sdk"
  // import { JITO_STAKE_POOL_ADDRESS } from "@/lib/tools/jito"
  //
  // const connection = new Connection(
  //   process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com",
  //   "confirmed"
  // )
  // const stakePoolAddress = new PublicKey(JITO_STAKE_POOL_ADDRESS)
  // const walletPublicKey  = new PublicKey(walletAddress)
  // const lamports         = Math.floor(amount * 1e9)
  //
  // const { instructions, signers } = await depositSol(
  //   connection,
  //   stakePoolAddress,
  //   walletPublicKey,
  //   lamports
  // )
  //
  // Build VersionedTransaction from instructions + signers
  // Serialize, return base64 for client to sign
  //
  // return NextResponse.json({ transaction: txBase64, isVersioned: true })

  return NextResponse.json({ error: "Mainnet tx builder not yet enabled." }, { status: 503 })
}
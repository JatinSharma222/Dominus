// app/api/kamino/deposit/route.ts
//
// Builds a Kamino lending deposit transaction server-side.
// Client sends the intent; this route returns a base64-serialized transaction
// for the user's wallet to sign.
//
// WEEK 2-3: Returns a "mainnet only" error for devnet environments.
// WEEK 4: Uncomment the klend-sdk section when switching to mainnet.
//
// The klend-sdk connection issue (Rpc<KaminoMarketRpcApi> vs Connection) is
// solved here by using @solana/rpc from the web3.js v2 monorepo.
// Install when ready: npm install @solana/rpc

import { NextRequest, NextResponse } from "next/server"

// ─── Week 4: uncomment these when switching to mainnet ───────────────────────
//
// import { createSolanaRpc } from "@solana/rpc"
// import { address } from "@solana/addresses"
// import {
//   KaminoMarket,
//   KaminoAction,
//   VanillaObligation,
//   PROGRAM_ID,
// } from "@kamino-finance/klend-sdk"
// import { Transaction, PublicKey } from "@solana/web3.js"

// ─── Request shape ────────────────────────────────────────────────────────────

interface DepositRequest {
  token: string
  mint: string
  amount: number
  decimals: number
  marketAddress: string
  walletAddress: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as DepositRequest
    const { token, mint, amount, decimals, marketAddress, walletAddress } = body

    if (!token || !mint || !amount || !walletAddress || !marketAddress) {
      return NextResponse.json(
        { error: "Missing required fields: token, mint, amount, walletAddress, marketAddress" },
        { status: 400 }
      )
    }

    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet"

    // ── Devnet guard (Weeks 2–3) ─────────────────────────────────────────────
    if (network === "devnet") {
      return NextResponse.json(
        {
          error:
            "Kamino Finance operates on Solana mainnet only. " +
            "Deposit execution will be enabled in Week 4 when this app switches to mainnet. " +
            "The preview above shows live mainnet APY data.",
        },
        { status: 503 }
      )
    }

    // ── Mainnet path (Week 4+) ───────────────────────────────────────────────
    //
    // Uncomment this block when you run `npm install @solana/rpc` and switch
    // NEXT_PUBLIC_SOLANA_NETWORK to "mainnet-beta"
    //
    // const rpcUrl = process.env.HELIUS_MAINNET_RPC_URL ||
    //   `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    //
    // const rpc = createSolanaRpc(rpcUrl)
    //
    // const market = await KaminoMarket.load(
    //   rpc,
    //   address(marketAddress),
    //   400,
    //   address(PROGRAM_ID.toString()),
    //   true,
    // )
    //
    // if (!market) {
    //   return NextResponse.json({ error: "Failed to load Kamino market" }, { status: 500 })
    // }
    //
    // const rawAmount = Math.floor(amount * Math.pow(10, decimals)).toString()
    //
    // const kaminoAction = await KaminoAction.buildDepositTxns(
    //   market,
    //   rawAmount,
    //   address(mint),
    //   address(walletAddress),
    //   new VanillaObligation(PROGRAM_ID),
    //   1_400_000,  // computeBudget
    //   undefined,  // referrer
    //   undefined,  // isClosingPosition
    //   true,       // useV2Ixs  ← required in klend-sdk v6
    // )
    //
    // const allIxs = [
    //   ...kaminoAction.setupIxs,
    //   ...kaminoAction.lendingIxs,
    //   ...kaminoAction.cleanupIxs,
    // ]
    //
    // if (allIxs.length === 0) {
    //   return NextResponse.json(
    //     { error: "No instructions generated. Check your balance and token configuration." },
    //     { status: 400 }
    //   )
    // }
    //
    // // Build legacy Transaction for Phantom compatibility
    // const connection = new Connection(rpcUrl, "confirmed")
    // const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    //
    // const tx = new Transaction()
    // tx.add(...allIxs)
    // tx.recentBlockhash = blockhash
    // tx.feePayer = new PublicKey(walletAddress)
    //
    // // Serialize WITHOUT signing (client will sign)
    // const txBase64 = tx.serialize({ requireAllSignatures: false }).toString("base64")
    //
    // return NextResponse.json({
    //   transaction: txBase64,
    //   isVersioned: false,
    //   blockhash,
    //   lastValidBlockHeight,
    // })

    // Fallback — should not reach here if guard above works
    return NextResponse.json(
      { error: "Deposit not yet implemented for this network." },
      { status: 501 }
    )

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[kamino/deposit] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
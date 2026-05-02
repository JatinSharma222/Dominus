// app/api/jito/stake/route.ts
//
// Builds an unsigned Jito liquid-stake transaction on mainnet.
// Uses @solana/spl-stake-pool (already installed) — no new deps required.
// depositSol() returns { instructions, signers } — we build the Transaction manually.
// Returns base64-serialised unsigned legacy Transaction for the wallet to sign.
//
// Flow:
//   1. Client POSTs { amount, walletAddress }
//   2. Server calls depositSol() from @solana/spl-stake-pool
//   3. Sets blockhash + feePayer, serializes WITHOUT signing
//   4. Client (JitoStakeCard) deserializes, signs with Phantom, broadcasts to mainnet
//
// NEVER signs — signing is always done by the user's wallet.

import { NextRequest, NextResponse } from "next/server"
import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import { depositSol } from "@solana/spl-stake-pool"

// ─── Constants ────────────────────────────────────────────────────────────────

const JITO_STAKE_POOL_ADDRESS = "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"
const MIN_STAKE_LAMPORTS      = 1_000_000 // 0.001 SOL minimum (covers rent + fees)

// ─── Request shape ────────────────────────────────────────────────────────────

interface StakeRequest {
  amount:        number  // in SOL (e.g. 1.5)
  walletAddress: string  // base58 public key
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ── Network guard ──────────────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet-beta") {
    return NextResponse.json(
      {
        error:
          "Jito liquid staking is a mainnet protocol. " +
          "Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta to enable transaction execution. " +
          "The preview above shows accurate APY and projected earnings.",
      },
      { status: 503 }
    )
  }

  // ── Parse + validate body ──────────────────────────────────────────────────
  let body: StakeRequest
  try {
    body = await req.json() as StakeRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { amount, walletAddress } = body

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number (in SOL)" },
      { status: 400 }
    )
  }
  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 }
    )
  }

  // ── Build transaction ──────────────────────────────────────────────────────
  try {
    const rpcUrl = process.env.HELIUS_RPC_URL ||
      `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

    const connection     = new Connection(rpcUrl, "confirmed")
    const stakePool      = new PublicKey(JITO_STAKE_POOL_ADDRESS)
    const walletPubkey   = new PublicKey(walletAddress)
    const lamports       = Math.floor(amount * 1_000_000_000)

    if (lamports < MIN_STAKE_LAMPORTS) {
      return NextResponse.json(
        { error: `Minimum stake is 0.001 SOL (${MIN_STAKE_LAMPORTS} lamports)` },
        { status: 400 }
      )
    }

    // depositSol returns { instructions, signers } — NOT a Transaction.
    // We build the Transaction manually and attach blockhash + feePayer.
    //
    // instructions: all required ix for the deposit (create ATA, deposit SOL)
    // signers:      pre-authorized pool accounts (PDAs) — partialSign them
    //              so the only missing sig is the user's wallet
    const { instructions, signers } = await depositSol(
      connection,
      stakePool,
      walletPubkey,
      lamports
    )

    // Attach a fresh blockhash so the client can sign immediately
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed")

    const tx        = new Transaction()
    tx.recentBlockhash = blockhash
    tx.feePayer        = walletPubkey
    tx.add(...instructions)

    // Sign with any pool-authority accounts returned (they have keypairs).
    // The user's wallet signature is still required — added client-side.
    if (signers.length > 0) {
      tx.partialSign(...signers)
    }

    // Serialize — requireAllSignatures: false because user hasn't signed yet
    const txBase64 = tx.serialize({ requireAllSignatures: false }).toString("base64")

    return NextResponse.json({
      transaction:        txBase64,
      isVersioned:        false,       // legacy Transaction, not VersionedTransaction
      blockhash,
      lastValidBlockHeight,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[jito/stake] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
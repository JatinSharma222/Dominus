"use client"

// components/JitoStakeCard.tsx
//
// Jito liquid staking preview card.
// Fetches live APY via /api/jito/apy proxy (server-side to avoid CORS).
// Tx execution is mainnet-only — devnet shows clear explanation.

import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { VersionedTransaction, Transaction } from "@solana/web3.js"
import { JitoStakeIntent } from "@/lib/tools/jito"

// ─── Types ────────────────────────────────────────────────────────────────────

interface JitoStakeCardProps {
  intent:    JitoStakeIntent
  onSuccess?: (txid: string) => void
  onCancel?:  () => void
}

type CardStatus =
  | "loading_apy"
  | "ready"
  | "apy_error"
  | "building"
  | "signing"
  | "sending"
  | "confirmed"
  | "failed"

interface APYData {
  apy:    number              // e.g. 8.23 — already as %
  source: "live" | "estimated"
}

// ─── Proxy fetch ──────────────────────────────────────────────────────────────

async function fetchJitoAPY(): Promise<APYData> {
  const res = await fetch("/api/jito/apy", {
    headers: { Accept: "application/json" },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Jito APY fetch failed (${res.status})`)
  return body as APYData
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JitoStakeCard({
  intent,
  onSuccess,
  onCancel,
}: JitoStakeCardProps) {
  const { publicKey, signTransaction } = useWallet()

  const [status, setStatus]     = useState<CardStatus>("loading_apy")
  const [apyData, setApyData]   = useState<APYData | null>(null)
  const [apyError, setApyError] = useState<string | null>(null)
  const [txid, setTxid]         = useState<string | null>(null)
  const [txError, setTxError]   = useState<string | null>(null)

  // Projected earnings (on SOL amount at current APY)
  const dailyEarnings   = apyData ? (intent.amount * apyData.apy) / 100 / 365 : null
  const monthlyEarnings = dailyEarnings ? dailyEarnings * 30 : null
  const yearlyEarnings  = apyData ? (intent.amount * apyData.apy) / 100 : null

  // ── Load APY ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function loadAPY() {
      setStatus("loading_apy")
      setApyError(null)
      try {
        const data = await fetchJitoAPY()
        if (!cancelled) {
          setApyData(data)
          setStatus("ready")
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error("[JitoStakeCard] APY load error:", msg)
          setApyError(msg)
          setStatus("apy_error")
        }
      }
    }

    loadAPY()
    return () => { cancelled = true }
  }, [])   // Jito APY is pool-global — no per-token dependency

  // ── Confirm stake ──────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!publicKey || !signTransaction || !apyData) return
    setTxError(null)

    // Mainnet-only guard during devnet development
    if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet") {
      setTxError(
        "Jito is a mainnet protocol. Stake execution is enabled in Week 4 when the app switches to mainnet."
      )
      setStatus("failed")
      return
    }

    try {
      setStatus("building")

      const res = await fetch("/api/jito/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:          intent.amount,
          walletAddress:   publicKey.toString(),
          stakePoolAddress: intent.stakePoolAddress,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error ?? `Stake build failed (${res.status})`)
      }

      const { transaction: txBase64, isVersioned } = await res.json() as {
        transaction: string
        isVersioned: boolean
      }

      const txBytes = Buffer.from(txBase64, "base64")
      const tx = isVersioned
        ? VersionedTransaction.deserialize(txBytes)
        : Transaction.from(txBytes)

      setStatus("signing")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signed = await signTransaction(tx as any)

      setStatus("sending")
      const mainnetRpc = process.env.NEXT_PUBLIC_KAMINO_RPC_URL || "https://api.mainnet-beta.solana.com"
      const { Connection } = await import("@solana/web3.js")
      const mainnetConnection = new Connection(mainnetRpc, "confirmed")

      const rawTx = signed.serialize()
      const sig = await mainnetConnection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      })
      await mainnetConnection.confirmTransaction(sig, "confirmed")

      setTxid(sig)
      setStatus("confirmed")
      onSuccess?.(sig)
    } catch (err) {
      setStatus("failed")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(
        msg.includes("User rejected") || msg.includes("Plugin Closed")
          ? "Transaction cancelled in wallet."
          : msg
      )
    }
  }

  const isSubmitting =
    status === "building" || status === "signing" || status === "sending"

  const confirmLabel: Partial<Record<CardStatus, string>> = {
    ready:     "CONFIRM STAKE",
    building:  "BUILDING TX...",
    signing:   "SIGN IN WALLET...",
    sending:   "BROADCASTING...",
    confirmed: "STAKED ✓",
    failed:    "RETRY",
  }

  // ── Loading APY ────────────────────────────────────────────────────────────
  if (status === "loading_apy") {
    return (
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-4">
        <CardHeader status="loading" />
        <div className="flex items-center gap-3 py-3">
          <span className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
          <span className="font-label text-[10px] text-neutral-400 tracking-widest uppercase">
            Loading jitoSOL yield rate...
          </span>
        </div>
      </div>
    )
  }

  // ── APY error ──────────────────────────────────────────────────────────────
  if (status === "apy_error") {
    return (
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-3">
        <CardHeader status="error" />
        <p className="font-label text-[10px] text-error tracking-wide leading-relaxed">
          {apyError}
        </p>
        <button
          onClick={() => { setApyError(null); setStatus("loading_apy") }}
          className="font-label text-[10px] text-primary tracking-widest uppercase border-b border-primary/40 pb-0.5"
        >
          RETRY
        </button>
      </div>
    )
  }

  // ── Full preview ───────────────────────────────────────────────────────────
  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-4">

      <CardHeader status="live" isEstimated={apyData?.source === "estimated"} />

      {/* Hero: stake amount + APY */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="space-y-1">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">STAKE</p>
          <p className="font-headline text-3xl text-on-surface">{intent.amount}</p>
          <p className="font-label text-xs text-primary tracking-widest">SOL</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">RECEIVE</p>
          <p className="font-headline text-3xl text-on-surface">≈ {intent.amount.toFixed(4)}</p>
          <p className="font-label text-xs text-primary tracking-widest">jitoSOL</p>
        </div>
      </div>

      {/* APY highlight */}
      <div className="flex items-center justify-between py-3 px-4 bg-surface-container-highest/50 rounded">
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">STAKING APY</p>
          <p className="font-headline text-2xl text-primary mt-0.5">
            {apyData!.apy.toFixed(2)}%
          </p>
        </div>
        <div className="text-right">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">SOURCE</p>
          <p className="font-label text-[10px] text-neutral-400 tracking-widest uppercase mt-0.5">
            Validator rewards
          </p>
          <p className="font-label text-[10px] text-neutral-400 tracking-widest uppercase">
            + MEV tips
          </p>
        </div>
      </div>

      {/* Projected earnings */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/10">
        {[
          { label: "DAILY",   value: (dailyEarnings ?? 0).toFixed(6) },
          { label: "MONTHLY", value: (monthlyEarnings ?? 0).toFixed(4) },
          { label: "YEARLY",  value: (yearlyEarnings ?? 0).toFixed(4) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">{label}</p>
            <p className="font-body text-sm font-bold text-primary-fixed-dim mt-0.5">+{value}</p>
            <p className="font-label text-[9px] text-neutral-600 tracking-widest uppercase mt-0.5">
              SOL
            </p>
          </div>
        ))}
      </div>

      {/* jitoSOL info row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">LIQUID TOKEN</p>
          <p className="font-body text-sm font-bold text-on-surface/80 mt-0.5">jitoSOL</p>
        </div>
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">UNSTAKE</p>
          <p className="font-body text-sm font-bold text-on-surface/80 mt-0.5">Anytime</p>
        </div>
      </div>

      {/* Mainnet notice */}
      <div className="flex items-center gap-2 py-2 px-3 bg-surface-container-highest/50 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
        <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
          Executes on Solana mainnet · jitoSOL earns yield automatically
        </p>
      </div>

      {/* Tx error */}
      {txError && (
        <p className="font-label text-[10px] text-error tracking-wide leading-relaxed">
          {txError}
        </p>
      )}

      {/* Solscan link on success */}
      {status === "confirmed" && txid && (
        <a
          href={`https://solscan.io/tx/${txid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-label text-[10px] text-tertiary tracking-widest uppercase hover:text-tertiary/80 transition-colors"
        >
          VIEW ON SOLSCAN →
        </a>
      )}

      {/* Action buttons */}
      {status !== "confirmed" && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !publicKey}
            className="relative group flex-1 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold tracking-[0.2em] text-xs uppercase rounded shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 rounded transition-opacity" />
            {isSubmitting && (
              <span className="inline-block w-3 h-3 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin mr-2 align-middle" />
            )}
            {!publicKey ? "CONNECT WALLET" : (confirmLabel[status] ?? "CONFIRM STAKE")}
          </button>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="font-label text-[10px] text-neutral-500 hover:text-primary tracking-widest uppercase border-b border-transparent hover:border-primary/40 pb-0.5 transition-all disabled:opacity-30"
          >
            CANCEL
          </button>
        </div>
      )}
    </div>
  )
}

// ─── CardHeader ───────────────────────────────────────────────────────────────

function CardHeader({
  status,
  isEstimated,
}: {
  status: "loading" | "live" | "error"
  isEstimated?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full font-label text-[10px] text-primary tracking-widest uppercase">
          Jito
        </span>
        <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase">
          LIQUID STAKE PREVIEW
        </span>
      </div>
      {status !== "error" && (
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
          <span className="font-label text-[9px] text-tertiary tracking-widest uppercase">
            {status === "loading" ? "FETCHING" : isEstimated ? "ESTIMATED" : "LIVE"}
          </span>
        </div>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  JupiterSwapIntent,
  JupiterSwapPreview,
  fetchJupiterQuote,
  buildJupiterSwapTransaction,
} from "@/lib/tools/jupiter"

interface TxConfirmCardProps {
  intent: JupiterSwapIntent
  onSuccess?: (txid: string) => void
  onCancel?: () => void
}

type Status = "idle" | "building" | "signing" | "sending" | "confirmed" | "error"

export default function TxConfirmCard({ intent, onSuccess, onCancel }: TxConfirmCardProps) {
  const { publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()

  const [preview, setPreview]         = useState<JupiterSwapPreview | null>(null)
  const [quoteError, setQuoteError]   = useState<string | null>(null)
  const [status, setStatus]           = useState<Status>("idle")
  const [txid, setTxid]               = useState<string | null>(null)
  const [txError, setTxError]         = useState<string | null>(null)

  // Fetch live quote from Jupiter in the browser on mount
  useEffect(() => {
    let cancelled = false
    setQuoteError(null)
    setPreview(null)

    fetchJupiterQuote(intent)
      .then((p) => { if (!cancelled) setPreview(p) })
      .catch((err) => { if (!cancelled) setQuoteError(err instanceof Error ? err.message : String(err)) })

    return () => { cancelled = true }
  }, [intent.fromMint, intent.toMint, intent.inputAmount, intent.slippageBps])

  const statusLabel: Record<Status, string> = {
    idle:      "CONFIRM TRANSACTION",
    building:  "BUILDING TX...",
    signing:   "SIGN IN WALLET...",
    sending:   "BROADCASTING...",
    confirmed: "CONFIRMED ✓",
    error:     "RETRY",
  }

  async function handleConfirm() {
    if (!publicKey || !signTransaction || !preview) return
    setTxError(null)

    try {
      setStatus("building")
      const tx = await buildJupiterSwapTransaction(preview, publicKey.toString())

      setStatus("signing")
      const signed = await signTransaction(tx)

      setStatus("sending")
      const rawTx = signed.serialize()
      const sig = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      })
      await connection.confirmTransaction(sig, "confirmed")

      setTxid(sig)
      setStatus("confirmed")
      onSuccess?.(sig)
    } catch (err) {
      setStatus("error")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(msg.includes("User rejected") ? "Transaction cancelled in wallet." : msg)
    }
  }

  const isSubmitting = status === "building" || status === "signing" || status === "sending"

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!preview && !quoteError) {
    return (
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full font-label text-[10px] text-primary tracking-widest uppercase">
              Jupiter
            </span>
            <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase">
              SWAP PREVIEW
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
            <span className="font-label text-[9px] text-tertiary tracking-widest uppercase">FETCHING QUOTE</span>
          </div>
        </div>
        <div className="flex items-center gap-3 py-4">
          <span className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
          <span className="font-label text-[10px] text-neutral-400 tracking-widest uppercase">
            Getting best route for {intent.inputAmount} {intent.fromToken} → {intent.toToken}...
          </span>
        </div>
      </div>
    )
  }

  // ── Quote error state ──────────────────────────────────────────────────────
  if (quoteError) {
    return (
      <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full font-label text-[10px] text-primary tracking-widest uppercase">
            Jupiter
          </span>
          <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase">SWAP PREVIEW</span>
        </div>
        <p className="font-label text-[10px] text-error tracking-wide">{quoteError}</p>
        <button
          onClick={() => { setQuoteError(null); setPreview(null) }}
          className="font-label text-[10px] text-primary tracking-widest uppercase border-b border-primary/40 pb-0.5"
        >
          RETRY QUOTE
        </button>
      </div>
    )
  }

  // ── Full preview ───────────────────────────────────────────────────────────
  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full font-label text-[10px] text-primary tracking-widest uppercase">
            {preview!.protocol}
          </span>
          <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase">
            SWAP PREVIEW
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
          <span className="font-label text-[9px] text-tertiary tracking-widest uppercase">LIVE</span>
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-2 items-center">
        <div className="space-y-1">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">FROM</p>
          <p className="font-headline text-2xl text-on-surface">{preview!.inputAmount}</p>
          <p className="font-label text-xs text-primary tracking-widest">{preview!.fromToken}</p>
        </div>
        <div className="flex justify-center">
          <span className="material-symbols-outlined text-primary/60 text-2xl">arrow_forward</span>
        </div>
        <div className="space-y-1 text-right">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">TO</p>
          <p className="font-headline text-2xl text-on-surface">{preview!.outputAmount.toFixed(4)}</p>
          <p className="font-label text-xs text-primary tracking-widest">{preview!.toToken}</p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-outline-variant/10">
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">PRICE IMPACT</p>
          <p className="font-body text-sm font-bold text-primary-fixed-dim mt-0.5">
            {parseFloat(preview!.priceImpact).toFixed(4)}%
          </p>
        </div>
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">SLIPPAGE</p>
          <p className="font-body text-sm font-bold text-primary-fixed-dim mt-0.5">
            {(preview!.slippageBps / 100).toFixed(1)}%
          </p>
        </div>
        {preview!.fee !== null && (
          <div>
            <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">PLATFORM FEE</p>
            <p className="font-body text-sm font-bold text-primary-fixed-dim mt-0.5">{preview!.fee} bps</p>
          </div>
        )}
        <div className="col-span-2">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">ROUTE</p>
          <p className="font-body text-xs text-on-surface/70 mt-0.5 leading-relaxed">{preview!.routeLabel}</p>
        </div>
      </div>

      {/* Tx error */}
      {txError && <p className="font-label text-[10px] text-error tracking-wide">{txError}</p>}

      {/* Solscan link after confirm */}
      {status === "confirmed" && txid && (
        
         <a href={`https://solscan.io/tx/${txid}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet"}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-label text-[10px] text-tertiary tracking-widest uppercase hover:text-tertiary/80 transition-colors"
        >
          VIEW ON SOLSCAN →
        </a>
      )}

      {/* Actions */}
      {status !== "confirmed" && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="relative group flex-1 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold tracking-[0.2em] text-xs uppercase rounded shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 rounded transition-opacity" />
            {isSubmitting && (
              <span className="inline-block w-3 h-3 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin mr-2 align-middle" />
            )}
            {statusLabel[status]}
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
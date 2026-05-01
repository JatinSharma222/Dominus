"use client"

// components/StreamflowPaymentCard.tsx
//
// Streamflow Finance — recurring payment stream preview + create.
// Uses @streamflow/stream SDK directly — no server route needed.
// Streamflow supports devnet, so this works on both networks.

import { useState, useCallback } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SolanaStreamClient, getBN, ICluster } from "@streamflow/stream"
import { StreamflowPaymentIntent } from "@/lib/tools/streamflow"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamflowPaymentCardProps {
  intent:     StreamflowPaymentIntent
  onSuccess?: (streamId: string) => void
  onCancel?:  () => void
}

type CardStatus =
  | "ready"
  | "building"
  | "signing"
  | "sending"
  | "confirmed"
  | "failed"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

function frequencyLabel(frequency: string): string {
  return (
    { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" }[frequency] ??
    frequency.toUpperCase()
  )
}

function durationLabel(frequency: string, periods: number): string {
  const map: Record<string, string> = {
    daily: "days",
    weekly: "weeks",
    monthly: "months",
  }
  return `${periods} ${map[frequency] ?? "periods"}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StreamflowPaymentCard({
  intent,
  onSuccess,
  onCancel,
}: StreamflowPaymentCardProps) {
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { connection } = useConnection()

  const [status,   setStatus]   = useState<CardStatus>("ready")
  const [streamId, setStreamId] = useState<string | null>(null)
  const [txError,  setTxError]  = useState<string | null>(null)

  const isDevnet     = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet"
  const mint         = isDevnet ? intent.devnetMint : intent.mainnetMint
  const isSubmitting = status === "building" || status === "signing" || status === "sending"

  const confirmLabel: Partial<Record<CardStatus, string>> = {
    ready:     "CREATE STREAM",
    building:  "BUILDING TX...",
    signing:   "SIGN IN WALLET...",
    sending:   "BROADCASTING...",
    confirmed: "STREAM CREATED ✓",
    failed:    "RETRY",
  }

  // ── Create stream ────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return
    setTxError(null)
    setStatus("building")

    try {
      const cluster = isDevnet ? ICluster.Devnet : ICluster.Mainnet

      const client = new SolanaStreamClient(
        connection.rpcEndpoint,
        cluster,
        "confirmed"
      )

      const nowSeconds   = Math.floor(Date.now() / 1000)
      const startSeconds = nowSeconds + 60 // stream starts in 1 minute

      const createParams = {
        recipient:               intent.recipient,
        tokenId:                 mint,
        start:                   startSeconds,
        amount:                  getBN(intent.totalAmount, intent.decimals),
        period:                  intent.periodSeconds,
        cliff:                   startSeconds,
        cliffAmount:             getBN(0, intent.decimals),
        amountPerPeriod:         getBN(intent.amountPerPeriod, intent.decimals),
        name:                    `Dominus: ${intent.amountPerPeriod} ${intent.token}/${intent.frequency}`,
        canTopup:                true,
        cancelableBySender:      true,
        cancelableByRecipient:   false,
        transferableBySender:    false,
        transferableByRecipient: false,
        automaticWithdrawal:     false,
        withdrawalFrequency:     0,
      }

      // Streamflow sender needs publicKey + sign methods — wallet adapter satisfies this.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sender = { publicKey, signTransaction, signAllTransactions } as any

      setStatus("signing")

      const { txId, metadataId } = await client.create(createParams, { sender })

      setStatus("sending")
      await new Promise((r) => setTimeout(r, 400))

      const id = metadataId?.toString() ?? txId
      setStreamId(id)
      setStatus("confirmed")
      onSuccess?.(id)
    } catch (err) {
      setStatus("failed")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(
        msg.includes("User rejected") ||
        msg.includes("Plugin Closed") ||
        msg.includes("rejected")
          ? "Transaction cancelled in wallet."
          : msg
      )
    }
  }, [
    publicKey,
    signTransaction,
    signAllTransactions,
    connection,
    intent,
    mint,
    isDevnet,
    onSuccess,
  ])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 w-full max-w-md space-y-4">

      <CardHeader />

      {/* Hero: amount + frequency */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="space-y-1">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
            AMOUNT PER PERIOD
          </p>
          <p className="font-headline text-3xl text-on-surface">
            {intent.amountPerPeriod}
          </p>
          <p className="font-label text-xs text-primary tracking-widest">{intent.token}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
            FREQUENCY
          </p>
          <p className="font-headline text-3xl text-primary">
            {frequencyLabel(intent.frequency)}
          </p>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
            RELEASE SCHEDULE
          </p>
        </div>
      </div>

      {/* Stream detail grid */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/10">
        {[
          { label: "RECIPIENT", value: shortenAddress(intent.recipient) },
          {
            label: "DURATION",
            value: durationLabel(intent.frequency, intent.totalPeriods),
          },
          {
            label: "TOTAL",
            value: `${intent.totalAmount} ${intent.token}`,
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
              {label}
            </p>
            <p className="font-body text-sm font-bold text-primary-fixed-dim mt-0.5">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Cancellation info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
            RECIPIENT CAN WITHDRAW
          </p>
          <p className="font-body text-sm font-bold text-on-surface/80 mt-0.5">Anytime</p>
        </div>
        <div>
          <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
            YOU CAN CANCEL
          </p>
          <p className="font-body text-sm font-bold text-on-surface/80 mt-0.5">Anytime</p>
        </div>
      </div>

      {/* Network notice */}
      <div className="flex items-center gap-2 py-2 px-3 bg-surface-container-highest/50 rounded">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isDevnet ? "bg-tertiary" : "bg-secondary"
          }`}
        />
        <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase">
          {isDevnet
            ? "Executes on Solana devnet · No real funds"
            : "Executes on Solana mainnet · Funds leave your wallet"}
        </p>
      </div>

      {/* Full recipient address */}
      <div className="py-2 px-3 bg-surface-container-lowest rounded">
        <p className="font-label text-[9px] text-neutral-500 tracking-widest uppercase mb-1">
          FULL RECIPIENT ADDRESS
        </p>
        <p className="font-label text-[10px] text-neutral-400 break-all leading-relaxed">
          {intent.recipient}
        </p>
      </div>

      {/* Tx error */}
      {txError && (
        <p className="font-label text-[10px] text-error tracking-wide leading-relaxed">
          {txError}
        </p>
      )}

      {/* Streamflow link on success */}
      {status === "confirmed" && streamId && (
        <a
          href="https://app.streamflow.finance/"
          target="_blank"
          rel="noopener noreferrer"
          className="block font-label text-[10px] text-tertiary tracking-widest uppercase hover:text-tertiary/80 transition-colors"
        >
          VIEW STREAM ON STREAMFLOW →
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
            {!publicKey
              ? "CONNECT WALLET"
              : (confirmLabel[status] ?? "CREATE STREAM")}
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

function CardHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full font-label text-[10px] text-primary tracking-widest uppercase">
          Streamflow
        </span>
        <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase">
          PAYMENT STREAM
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
        <span className="font-label text-[9px] text-tertiary tracking-widest uppercase">
          PREVIEW
        </span>
      </div>
    </div>
  )
}
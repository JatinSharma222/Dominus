"use client"

import { useState, useCallback } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import { SolanaStreamClient, getBN, ICluster } from "@streamflow/stream"
import { StreamflowPaymentIntent } from "@/lib/tools/streamflow"

interface StreamflowPaymentCardProps {
  intent: StreamflowPaymentIntent
  onSuccess?: (streamId: string) => void
  onCancel?: () => void
}

type CardStatus = "ready"|"building"|"signing"|"sending"|"confirmed"|"failed"

function shortenAddress(address: string, chars = 5): string {
  if (address.length < chars * 2 + 3) return address
  return `${address.slice(0, chars)}…${address.slice(-chars)}`
}

function freqLabel(f: string) {
  return ({ daily:"DAILY", weekly:"WEEKLY", monthly:"MONTHLY" }[f] ?? f.toUpperCase())
}

function durationLabel(f: string, n: number) {
  const map: Record<string,string> = { daily:"days", weekly:"weeks", monthly:"months" }
  return `${n} ${map[f] ?? "periods"}`
}

// ── Styles ────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "#111116",
  border: "1px solid rgba(255,255,255,.08)",
  borderTop: "1px solid rgba(167,139,250,.25)",
  borderRadius: 10,
  overflow: "hidden",
  position: "relative",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 4px 24px rgba(0,0,0,.5)",
}

const btnConfirm: React.CSSProperties = {
  flex: 1, padding: "12px 0",
  background: "linear-gradient(135deg,#c084fc,#a855f7 55%,#7c3aed)",
  border: "none", borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".66rem", fontWeight: 700,
  letterSpacing: ".22em", textTransform: "uppercase" as const,
  color: "#f3e8ff", cursor: "pointer",
  boxShadow: "0 0 20px rgba(168,85,247,.3), 0 4px 14px rgba(0,0,0,.5)",
  transition: "transform .15s",
}

const btnCancel: React.CSSProperties = {
  padding: "12px 18px",
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".6rem", fontWeight: 600,
  letterSpacing: ".18em", textTransform: "uppercase" as const,
  color: "#6B6A72", cursor: "pointer",
}

export default function StreamflowPaymentCard({ intent, onSuccess, onCancel }: StreamflowPaymentCardProps) {
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { connection } = useConnection()

  const [status,   setStatus]   = useState<CardStatus>("ready")
  const [streamId, setStreamId] = useState<string | null>(null)
  const [txError,  setTxError]  = useState<string | null>(null)

  const isDevnet    = process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet-beta"
  const mint        = isDevnet ? intent.devnetMint : intent.mainnetMint
  const isSubmitting = ["building","signing","sending"].includes(status)

  const confirmLabel: Partial<Record<CardStatus,string>> = {
    ready: "CREATE STREAM", building: "BUILDING TX…", signing: "SIGN IN WALLET…",
    sending: "BROADCASTING…", confirmed: "STREAM CREATED ✓", failed: "RETRY",
  }

  const handleConfirm = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return
    setTxError(null); setStatus("building")
    try {
      const cluster = isDevnet ? ICluster.Devnet : ICluster.Mainnet
      const client = new SolanaStreamClient(connection.rpcEndpoint, cluster, "confirmed")
      const nowSeconds   = Math.floor(Date.now() / 1000)
      const startSeconds = nowSeconds + 60
      const createParams = {
        recipient: intent.recipient, tokenId: mint,
        start: startSeconds, amount: getBN(intent.totalAmount, intent.decimals),
        period: intent.periodSeconds, cliff: startSeconds,
        cliffAmount: getBN(0, intent.decimals),
        amountPerPeriod: getBN(intent.amountPerPeriod, intent.decimals),
        name: `Dominus: ${intent.amountPerPeriod} ${intent.token}/${intent.frequency}`,
        canTopup: true, cancelableBySender: true, cancelableByRecipient: false,
        transferableBySender: false, transferableByRecipient: false,
        automaticWithdrawal: false, withdrawalFrequency: 0,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sender = { publicKey, signTransaction, signAllTransactions } as any
      setStatus("signing")
      const { txId, metadataId } = await client.create(createParams, { sender })
      setStatus("sending")
      await new Promise(r => setTimeout(r, 400))
      const id = metadataId?.toString() ?? txId
      setStreamId(id); setStatus("confirmed"); onSuccess?.(id)
    } catch (err) {
      setStatus("failed")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(
        msg.includes("User rejected") || msg.includes("Plugin Closed") || msg.includes("rejected")
          ? "Transaction cancelled in wallet." : msg
      )
    }
  }, [publicKey, signTransaction, signAllTransactions, connection, intent, mint, isDevnet, onSuccess])

  return (
    <div style={card}>
      {/* Accent top bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,transparent,rgba(167,139,250,.5),transparent)" }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ padding:"2px 8px", background:"rgba(167,139,250,.08)", border:"1px solid rgba(167,139,250,.22)",
            borderRadius:4, fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700,
            letterSpacing:".14em", textTransform:"uppercase", color:"rgba(196,181,253,.88)" }}>STREAMFLOW</span>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600,
            letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>PAYMENT STREAM</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"#A78BFA",
            display:"inline-block", animation:"blink 2s ease-in-out infinite" }} />
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
            letterSpacing:".16em", textTransform:"uppercase", color:"#3F3F46" }}>PREVIEW</span>
        </div>
      </div>

      <div style={{ padding:"18px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Hero: amount + frequency */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8,
          padding:"14px", background:"rgba(0,0,0,.25)", borderRadius:8, border:"1px solid rgba(255,255,255,.06)" }}>
          <div>
            <p style={labelXs}>PER PERIOD</p>
            <p style={heroNum}>{intent.amountPerPeriod}</p>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:700,
              letterSpacing:".1em", color:"rgba(245,158,11,.8)" }}>{intent.token}</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={labelXs}>FREQUENCY</p>
            <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.5rem", fontWeight:400,
              color:"rgba(196,181,253,.9)", lineHeight:1.1, margin:"4px 0 2px" }}>
              {freqLabel(intent.frequency)}
            </p>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:500,
              letterSpacing:".12em", textTransform:"uppercase", color:"#3F3F46" }}>RELEASE SCHEDULE</span>
          </div>
        </div>

        {/* Stream details */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {[
            { l:"RECIPIENT", v:shortenAddress(intent.recipient) },
            { l:"DURATION",  v:durationLabel(intent.frequency, intent.totalPeriods) },
            { l:"TOTAL",     v:`${intent.totalAmount} ${intent.token}` },
          ].map(({ l, v }) => (
            <div key={l} style={{ padding:"10px 12px", background:"rgba(0,0,0,.22)",
              border:"1px solid rgba(255,255,255,.05)", borderRadius:7 }}>
              <p style={labelXs}>{l}</p>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".7rem", fontWeight:700,
                letterSpacing:".06em", color:"rgba(196,181,253,.8)", margin:0 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Cancellation */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { l:"RECIPIENT WITHDRAW", v:"Anytime" },
            { l:"YOU CAN CANCEL",     v:"Anytime" },
          ].map(({ l, v }) => (
            <div key={l} style={{ padding:"10px 12px", background:"rgba(0,0,0,.2)",
              border:"1px solid rgba(255,255,255,.05)", borderRadius:7 }}>
              <p style={labelXs}>{l}</p>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".7rem", fontWeight:600,
                color:"rgba(196,181,253,.7)", margin:0 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Full recipient */}
        <div style={{ padding:"10px 12px", background:"rgba(0,0,0,.2)",
          borderRadius:7, border:"1px solid rgba(255,255,255,.05)" }}>
          <p style={labelXs}>FULL RECIPIENT ADDRESS</p>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem",
            color:"#3F3F46", letterSpacing:".04em", wordBreak:"break-all", lineHeight:1.6, margin:0 }}>
            {intent.recipient}
          </p>
        </div>

        {/* Network notice */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
          background:"rgba(0,0,0,.2)", borderRadius:6, border:"1px solid rgba(255,255,255,.05)" }}>
          <span style={{ width:5, height:5, borderRadius:"50%",
            background: isDevnet ? "rgba(96,165,250,.6)" : "rgba(167,139,250,.6)",
            display:"inline-block", animation:"blink 2.5s ease-in-out infinite", flexShrink:0 }} />
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:500,
            letterSpacing:".12em", textTransform:"uppercase", color:"#3F3F46" }}>
            {isDevnet ? "EXECUTES ON SOLANA DEVNET · NO REAL FUNDS" : "EXECUTES ON SOLANA MAINNET · FUNDS LEAVE YOUR WALLET"}
          </span>
        </div>

        {txError && <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem",
          color:"rgba(248,113,113,.8)", lineHeight:1.55, margin:0 }}>{txError}</p>}

        {status === "confirmed" && streamId && (
          <a href="https://app.streamflow.finance/" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".56rem", fontWeight:600,
              letterSpacing:".16em", textTransform:"uppercase", color:"rgba(196,181,253,.65)",
              textDecoration:"none" }}>VIEW STREAM ON STREAMFLOW →</a>
        )}

        {status !== "confirmed" && (
          <div style={{ display:"flex", gap:8, marginTop:2 }}>
            <button onClick={handleConfirm} disabled={isSubmitting || !publicKey}
              style={{ ...btnConfirm, opacity: (isSubmitting || !publicKey) ? .55 : 1 }}
              onMouseEnter={e => { if(!isSubmitting&&publicKey)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.02)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="none" }}>
              {isSubmitting && <InlineSpinner />}
              {!publicKey ? "CONNECT WALLET" : (confirmLabel[status] ?? "CREATE STREAM")}
            </button>
            <button onClick={onCancel} disabled={isSubmitting}
              style={{ ...btnCancel, opacity: isSubmitting ? .4 : 1 }}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  )
}

function InlineSpinner({ color = "#f3e8ff" }: { color?: string }) {
  return <span style={{ width:11, height:11, border:`2px solid ${color}33`,
    borderTop:`2px solid ${color}cc`, borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite",
    marginRight:8, verticalAlign:"middle" }} />
}

const labelXs: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
  letterSpacing:".2em", textTransform:"uppercase", color:"#3F3F46", display:"block", marginBottom:4,
}
const heroNum: React.CSSProperties = {
  fontFamily:"'Noto Serif',serif", fontSize:"1.8rem", fontWeight:400,
  color:"#F2F0EC", lineHeight:1.1, margin:"4px 0 2px",
}
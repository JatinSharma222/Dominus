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

const cardShell: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(28,22,14,.96) 0%, rgba(22,17,10,.98) 100%)",
  border: "1px solid rgba(255,185,60,.16)",
  borderTop: "1px solid rgba(255,185,60,.28)",
  borderRadius: 14,
  boxShadow: [
    "0 0 0 1px rgba(0,0,0,.55)",
    "0 4px 8px rgba(0,0,0,.6)",
    "0 16px 40px rgba(0,0,0,.75)",
    "0 32px 70px rgba(0,0,0,.55)",
    "0 0 40px rgba(245,140,10,.07)",
    "inset 0 1px 0 rgba(255,200,80,.1)",
    "inset 0 -1px 0 rgba(0,0,0,.3)",
  ].join(","),
  overflow: "hidden",
  position: "relative" as const,
  width: "100%",
  maxWidth: 420,
}

const btnConfirm: React.CSSProperties = {
  flex: 1,
  padding: "13px 0",
  background: "linear-gradient(135deg, #FFE980 0%, #FFD060 18%, #FFAC10 55%, #F59E0B 74%, #D97706 100%)",
  border: "none",
  borderRadius: 10,
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: ".68rem",
  fontWeight: 700,
  letterSpacing: ".26em",
  textTransform: "uppercase" as const,
  color: "#1a0c00",
  cursor: "pointer",
  position: "relative" as const,
  overflow: "hidden",
  boxShadow: "0 0 28px rgba(245,158,11,.55), 0 6px 20px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.45)",
  transition: "transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s",
  textShadow: "0 1px 0 rgba(255,255,255,.3)",
}

const btnCancel: React.CSSProperties = {
  padding: "13px 20px",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,185,60,.14)",
  borderRadius: 10,
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: ".62rem",
  fontWeight: 600,
  letterSpacing: ".22em",
  textTransform: "uppercase" as const,
  color: "rgba(255,200,140,.4)",
  cursor: "pointer",
  transition: "all .18s",
  boxShadow: "0 4px 14px rgba(0,0,0,.45)",
}

export default function TxConfirmCard({ intent, onSuccess, onCancel }: TxConfirmCardProps) {
  const { publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()

  const [preview,    setPreview]    = useState<JupiterSwapPreview | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [status,     setStatus]     = useState<Status>("idle")
  const [txid,       setTxid]       = useState<string | null>(null)
  const [txError,    setTxError]    = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setQuoteError(null); setPreview(null)
    fetchJupiterQuote(intent)
      .then(p => { if (!cancelled) setPreview(p) })
      .catch(err => { if (!cancelled) setQuoteError(err instanceof Error ? err.message : String(err)) })
    return () => { cancelled = true }
  }, [intent.fromMint, intent.toMint, intent.inputAmount, intent.slippageBps])

  const statusLabel: Record<Status, string> = {
    idle: "CONFIRM TRANSACTION", building: "BUILDING TX…",
    signing: "SIGN IN WALLET…", sending: "BROADCASTING…",
    confirmed: "CONFIRMED ✓", error: "RETRY",
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
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 })
      await connection.confirmTransaction(sig, "confirmed")
      setTxid(sig); setStatus("confirmed"); onSuccess?.(sig)
    } catch (err) {
      setStatus("error")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(msg.includes("User rejected") ? "Transaction cancelled in wallet." : msg)
    }
  }

  const isSubmitting = ["building","signing","sending"].includes(status)
  const solscanCluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet"

  // ── Loading ──
  if (!preview && !quoteError) return (
    <div style={cardShell}>
      <TopBar label="SWAP PREVIEW" badge="JUPITER" status="fetching" />
      <div style={{ padding: "20px 22px 22px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Spinner />
          <span style={labelSm}>Getting best route for {intent.inputAmount} {intent.fromToken} → {intent.toToken}…</span>
        </div>
      </div>
    </div>
  )

  // ── Error ──
  if (quoteError) return (
    <div style={cardShell}>
      <TopBar label="SWAP PREVIEW" badge="JUPITER" status="error" />
      <div style={{ padding: "20px 22px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <p style={{ ...labelSm, color:"rgba(255,100,80,.8)", lineHeight:1.55 }}>{quoteError}</p>
        <button style={{ ...btnCancel, color:"rgba(255,185,60,.7)", borderColor:"rgba(255,185,60,.24)" }}
          onClick={() => { setQuoteError(null); setPreview(null) }}>
          RETRY QUOTE
        </button>
      </div>
    </div>
  )

  return (
    <div style={cardShell}>
      {/* Shimmer top line */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1.5,
        background:"linear-gradient(90deg,transparent,rgba(255,205,70,.55),transparent)" }} />

      <TopBar label="SWAP PREVIEW" badge={preview!.protocol} status="live" />

      <div style={{ padding: "0 22px 22px", display:"flex", flexDirection:"column", gap:18 }}>

        {/* Token amounts — hero row */}
        <div style={{
          display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:12,
          padding:"18px 18px 16px",
          background:"rgba(0,0,0,.28)",
          borderRadius:10,
          border:"1px solid rgba(255,185,60,.08)",
          boxShadow:"inset 0 2px 8px rgba(0,0,0,.35)",
        }}>
          <div>
            <span style={labelXs}>FROM</span>
            <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"2rem", fontWeight:400,
              color:"#E5E2E1", lineHeight:1.1, margin:"4px 0 2px" }}>{preview!.inputAmount}</p>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".72rem", fontWeight:700,
              letterSpacing:".12em", color:"rgba(255,185,60,.9)" }}>{preview!.fromToken}</span>
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{ width:32, height:32, borderRadius:"50%",
              background:"rgba(245,158,11,.1)", border:"1px solid rgba(255,185,60,.22)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 12px rgba(245,158,11,.2)" }}>
              <span style={{ fontFamily:"'Material Symbols Outlined'",
                fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
                fontSize:16, color:"rgba(255,185,60,.8)", lineHeight:1 }}>arrow_forward</span>
            </div>
          </div>

          <div style={{ textAlign:"right" }}>
            <span style={labelXs}>TO (ESTIMATED)</span>
            <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"2rem", fontWeight:400,
              color:"#E5E2E1", lineHeight:1.1, margin:"4px 0 2px" }}>{preview!.outputAmount.toFixed(4)}</p>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".72rem", fontWeight:700,
              letterSpacing:".12em", color:"rgba(255,185,60,.9)" }}>{preview!.toToken}</span>
          </div>
        </div>

        {/* Detail grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { l:"PRICE IMPACT", v:`${parseFloat(preview!.priceImpact).toFixed(4)}%` },
            { l:"SLIPPAGE",     v:`${(preview!.slippageBps/100).toFixed(1)}%` },
            ...(preview!.fee !== null ? [{ l:"PLATFORM FEE", v:`${preview!.fee} bps` }] : []),
          ].map(({ l, v }) => (
            <div key={l} style={dataCell}>
              <span style={labelXs}>{l}</span>
              <span style={dataVal}>{v}</span>
            </div>
          ))}
          <div style={{ ...dataCell, gridColumn:"1/-1" }}>
            <span style={labelXs}>ROUTE</span>
            <span style={{ ...dataVal, fontSize:".64rem", color:"rgba(229,226,225,.55)", fontWeight:500 }}>{preview!.routeLabel}</span>
          </div>
        </div>

        {/* Error */}
        {txError && <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem",
          color:"rgba(255,100,80,.8)", lineHeight:1.55, margin:0 }}>{txError}</p>}

        {/* Solscan */}
        {status === "confirmed" && txid && (
          <a href={`https://solscan.io/tx/${txid}${solscanCluster}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".58rem", fontWeight:600,
              letterSpacing:".18em", textTransform:"uppercase", color:"rgba(177,207,246,.7)",
              textDecoration:"none", display:"flex", alignItems:"center", gap:4 }}>
            VIEW ON SOLSCAN →
          </a>
        )}

        {/* Buttons */}
        {status !== "confirmed" && (
          <div style={{ display:"flex", gap:10, marginTop:2 }}>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              style={{ ...btnConfirm, opacity: isSubmitting ? .65 : 1 }}
              onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03) translateY(-1px)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none" }}
            >
              {isSubmitting && <InlineSpinner />}
              {statusLabel[status]}
            </button>
            <button onClick={onCancel} disabled={isSubmitting} style={{ ...btnCancel, opacity: isSubmitting ? .4 : 1 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,185,60,.7)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,185,60,.28)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,200,140,.4)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,185,60,.14)" }}>
              CANCEL
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TopBar({ label, badge, status }: { label:string; badge:string; status:"fetching"|"live"|"error"|"estimated" }) {
  const dotColor = status === "live" ? "#55FF99" : status === "estimated" ? "#FFB95F" : status === "error" ? "#FF6B6B" : "#B1CFF6"
  const dotLabel = status === "fetching" ? "FETCHING" : status === "estimated" ? "ESTIMATED" : status === "error" ? "ERROR" : "LIVE"
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"14px 22px 14px", borderBottom:"1px solid rgba(255,185,60,.07)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{
          padding:"3px 10px",
          background:"rgba(245,158,11,.1)", border:"1px solid rgba(255,185,60,.22)",
          borderRadius:20, fontFamily:"'Space Grotesk',sans-serif",
          fontSize:".52rem", fontWeight:700, letterSpacing:".18em",
          textTransform:"uppercase", color:"rgba(255,185,60,.9)",
        }}>{badge}</span>
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", fontWeight:600,
          letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,215,150,.3)" }}>{label}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:dotColor,
          boxShadow:`0 0 7px ${dotColor}`, display:"inline-block",
          animation: status === "live" || status === "fetching" ? "blink 2s ease-in-out infinite" : "none" }} />
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:600,
          letterSpacing:".2em", textTransform:"uppercase", color:`${dotColor}99` }}>{dotLabel}</span>
      </div>
    </div>
  )
}

function Spinner() {
  return <span style={{ width:14, height:14, border:"2px solid rgba(255,185,60,.2)",
    borderTop:"2px solid rgba(255,185,60,.85)", borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite", flexShrink:0 }} />
}

function InlineSpinner() {
  return <span style={{ width:11, height:11, border:"2px solid rgba(26,12,0,.3)",
    borderTop:"2px solid rgba(26,12,0,.9)", borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite", marginRight:8,
    verticalAlign:"middle" }} />
}

const labelXs: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
  letterSpacing:".22em", textTransform:"uppercase", color:"rgba(255,215,150,.28)",
  display:"block", marginBottom:5,
}

const labelSm: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem",
  color:"rgba(255,215,150,.4)", letterSpacing:".06em",
}

const dataCell: React.CSSProperties = {
  padding:"10px 12px",
  background:"rgba(0,0,0,.22)",
  border:"1px solid rgba(255,185,60,.06)",
  borderRadius:8,
  display:"flex", flexDirection:"column",
}

const dataVal: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem", fontWeight:700,
  letterSpacing:".08em", color:"rgba(255,185,60,.88)",
}
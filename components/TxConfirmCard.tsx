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

type Status = "idle"|"building"|"signing"|"sending"|"confirmed"|"error"

const card: React.CSSProperties = {
  background: "#111116",
  border: "1px solid rgba(255,255,255,.08)",
  borderTop: "1px solid rgba(245,158,11,.25)",
  borderRadius: 10,
  overflow: "hidden",
  position: "relative",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 4px 24px rgba(0,0,0,.5)",
}

const btnConfirm: React.CSSProperties = {
  flex: 1, padding: "12px 0",
  background: "linear-gradient(135deg,#FCD34D 0%,#F59E0B 55%,#D97706 100%)",
  border: "none", borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".66rem", fontWeight: 700,
  letterSpacing: ".22em", textTransform: "uppercase" as const,
  color: "#1C0A00", cursor: "pointer",
  boxShadow: "0 0 22px rgba(245,158,11,.35), 0 4px 14px rgba(0,0,0,.5)",
  transition: "transform .15s, box-shadow .15s",
  textShadow: "0 1px 0 rgba(255,255,255,.2)",
}

const btnCancel: React.CSSProperties = {
  padding: "12px 18px",
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".6rem", fontWeight: 600,
  letterSpacing: ".18em", textTransform: "uppercase" as const,
  color: "#6B6A72", cursor: "pointer",
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
      setTxError(msg.includes("User rejected") || msg.includes("Plugin Closed") ? "Transaction cancelled in wallet." : msg)
    }
  }

  const isSubmitting = ["building","signing","sending"].includes(status)
  const solscanCluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet"

  // ── Loading state ──
  if (!preview && !quoteError) return (
    <div style={card}>
      <Header badge="JUPITER" label="SWAP PREVIEW" dotColor="#60A5FA" dotLabel="FETCHING" />
      <div style={{ padding:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Spinner color="rgba(245,158,11,.8)" />
          <span style={labelSm}>Getting best route for {intent.inputAmount} {intent.fromToken} → {intent.toToken}…</span>
        </div>
      </div>
    </div>
  )

  // ── Quote error ──
  if (quoteError) return (
    <div style={card}>
      <Header badge="JUPITER" label="SWAP PREVIEW" dotColor="#F87171" dotLabel="ERROR" />
      <div style={{ padding:"18px", display:"flex", flexDirection:"column", gap:12 }}>
        <p style={{ ...labelSm, color:"rgba(248,113,113,.8)", lineHeight:1.55 }}>{quoteError}</p>
        <button style={btnCancel}
          onClick={() => { setQuoteError(null); setPreview(null) }}>RETRY QUOTE</button>
      </div>
    </div>
  )

  return (
    <div style={card}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,transparent,rgba(245,158,11,.55),transparent)" }} />

      <Header badge={preview!.protocol} label="SWAP PREVIEW"
        dotColor="#22C55E" dotLabel="LIVE" />

      <div style={{ padding:"18px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Token amounts */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:10,
          padding:"14px", background:"rgba(0,0,0,.25)", borderRadius:8, border:"1px solid rgba(255,255,255,.06)" }}>
          <div>
            <p style={labelXs}>FROM</p>
            <p style={heroNum}>{preview!.inputAmount}</p>
            <span style={tokenBadge}>{preview!.fromToken}</span>
          </div>
          <div style={{ width:28, height:28, borderRadius:"50%",
            background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.18)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily:"'Material Symbols Outlined'",
              fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
              fontSize:14, color:"rgba(245,158,11,.7)", lineHeight:1 }}>arrow_forward</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={labelXs}>TO (ESTIMATED)</p>
            <p style={heroNum}>{preview!.outputAmount.toFixed(4)}</p>
            <span style={tokenBadge}>{preview!.toToken}</span>
          </div>
        </div>

        {/* Detail grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <Cell label="PRICE IMPACT" value={`${parseFloat(preview!.priceImpact).toFixed(4)}%`} />
          <Cell label="SLIPPAGE" value={`${(preview!.slippageBps / 100).toFixed(1)}%`} />
          {preview!.fee !== null && (
            <Cell label="PLATFORM FEE" value={`${preview!.fee} bps`} />
          )}
          <div style={{ gridColumn:"1/-1", padding:"10px 12px", background:"rgba(0,0,0,.22)",
            border:"1px solid rgba(255,255,255,.05)", borderRadius:7 }}>
            <p style={labelXs}>ROUTE</p>
            <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:500,
              color:"#6B6A72", margin:0, letterSpacing:".04em" }}>{preview!.routeLabel}</p>
          </div>
        </div>

        {txError && <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem",
          color:"rgba(248,113,113,.8)", lineHeight:1.55, margin:0 }}>{txError}</p>}

        {status === "confirmed" && txid && (
          <a href={`https://solscan.io/tx/${txid}${solscanCluster}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".56rem", fontWeight:600,
              letterSpacing:".16em", textTransform:"uppercase", color:"rgba(96,165,250,.65)",
              textDecoration:"none" }}>VIEW ON SOLSCAN →</a>
        )}

        {status !== "confirmed" && (
          <div style={{ display:"flex", gap:8, marginTop:2 }}>
            <button onClick={handleConfirm} disabled={isSubmitting}
              style={{ ...btnConfirm, opacity: isSubmitting ? .65 : 1 }}
              onMouseEnter={e => { if(!isSubmitting)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.02)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="none" }}>
              {isSubmitting && <InlineSpinner />}
              {statusLabel[status]}
            </button>
            <button onClick={onCancel} disabled={isSubmitting}
              style={{ ...btnCancel, opacity: isSubmitting ? .4 : 1 }}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Header({ badge, label, dotColor, dotLabel }:
  { badge:string; label:string; dotColor:string; dotLabel:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ padding:"2px 8px", background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.22)",
          borderRadius:4, fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700,
          letterSpacing:".14em", textTransform:"uppercase", color:"rgba(245,158,11,.88)" }}>{badge}</span>
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600,
          letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>{label}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ width:5, height:5, borderRadius:"50%", background:dotColor,
          display:"inline-block", animation:"blink 2s ease-in-out infinite",
          boxShadow:`0 0 5px ${dotColor}` }} />
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
          letterSpacing:".16em", textTransform:"uppercase", color:"#3F3F46" }}>{dotLabel}</span>
      </div>
    </div>
  )
}

function Cell({ label, value }: { label:string; value:string }) {
  return (
    <div style={{ padding:"10px 12px", background:"rgba(0,0,0,.22)",
      border:"1px solid rgba(255,255,255,.05)", borderRadius:7,
      display:"flex", flexDirection:"column" }}>
      <p style={labelXs}>{label}</p>
      <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem", fontWeight:700,
        letterSpacing:".06em", color:"rgba(245,158,11,.85)", margin:0 }}>{value}</p>
    </div>
  )
}

function Spinner({ color = "rgba(245,158,11,.8)" }: { color?: string }) {
  return <span style={{ width:14, height:14, border:`2px solid ${color}22`,
    borderTop:`2px solid ${color}`, borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite", flexShrink:0 }} />
}

function InlineSpinner() {
  return <span style={{ width:11, height:11, border:"2px solid rgba(28,10,0,.3)",
    borderTop:"2px solid rgba(28,10,0,.9)", borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite",
    marginRight:8, verticalAlign:"middle" }} />
}

const labelXs: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
  letterSpacing:".2em", textTransform:"uppercase", color:"#3F3F46", display:"block", marginBottom:4,
}
const labelSm: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", color:"#6B6A72", letterSpacing:".04em",
}
const heroNum: React.CSSProperties = {
  fontFamily:"'Noto Serif',serif", fontSize:"1.8rem", fontWeight:400,
  color:"#F2F0EC", lineHeight:1.1, margin:"4px 0 2px",
}
const tokenBadge: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:700,
  letterSpacing:".1em", color:"rgba(245,158,11,.8)",
}
"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { VersionedTransaction, Transaction } from "@solana/web3.js"
import { JitoStakeIntent } from "@/lib/tools/jito"

interface JitoStakeCardProps {
  intent: JitoStakeIntent
  onSuccess?: (txid: string) => void
  onCancel?: () => void
}

type CardStatus = "loading_apy"|"ready"|"apy_error"|"building"|"signing"|"sending"|"confirmed"|"failed"
interface APYData { apy: number; source: "live"|"estimated" }

async function fetchJitoAPY(): Promise<APYData> {
  const res = await fetch("/api/jito/apy", { headers: { Accept: "application/json" } })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Jito APY fetch failed (${res.status})`)
  return body as APYData
}

// ── Styles ────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "#111116",
  border: "1px solid rgba(255,255,255,.08)",
  borderTop: "1px solid rgba(99,102,241,.25)",
  borderRadius: 10,
  overflow: "hidden",
  position: "relative",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 4px 24px rgba(0,0,0,.5)",
}

const btnConfirm: React.CSSProperties = {
  flex: 1, padding: "12px 0",
  background: "linear-gradient(135deg,#818cf8,#6366f1 55%,#4f46e5)",
  border: "none", borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".66rem", fontWeight: 700,
  letterSpacing: ".22em", textTransform: "uppercase" as const,
  color: "#e0e7ff", cursor: "pointer",
  boxShadow: "0 0 20px rgba(99,102,241,.3), 0 4px 14px rgba(0,0,0,.5)",
  transition: "transform .15s, box-shadow .15s",
}

const btnCancel: React.CSSProperties = {
  padding: "12px 18px",
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".6rem", fontWeight: 600,
  letterSpacing: ".18em", textTransform: "uppercase" as const,
  color: "#6B6A72", cursor: "pointer",
}

export default function JitoStakeCard({ intent, onSuccess, onCancel }: JitoStakeCardProps) {
  const { publicKey, signTransaction } = useWallet()

  const [status,   setStatus]   = useState<CardStatus>("loading_apy")
  const [apyData,  setApyData]  = useState<APYData | null>(null)
  const [apyError, setApyError] = useState<string | null>(null)
  const [txid,     setTxid]     = useState<string | null>(null)
  const [txError,  setTxError]  = useState<string | null>(null)

  const daily   = apyData ? (intent.amount * apyData.apy) / 100 / 365 : 0
  const monthly = daily * 30
  const yearly  = apyData ? (intent.amount * apyData.apy) / 100 : 0

  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus("loading_apy"); setApyError(null)
      try {
        const data = await fetchJitoAPY()
        if (!cancelled) { setApyData(data); setStatus("ready") }
      } catch (err) {
        if (!cancelled) { setApyError(err instanceof Error ? err.message : String(err)); setStatus("apy_error") }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleConfirm() {
    if (!publicKey || !signTransaction || !apyData) return
    setTxError(null)
    try {
      setStatus("building")
      const res = await fetch("/api/jito/stake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: intent.amount, walletAddress: publicKey.toString(), stakePoolAddress: intent.stakePoolAddress }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(b.error ?? `Build failed (${res.status})`)
      }
      const { transaction: txBase64, isVersioned } = await res.json() as { transaction: string; isVersioned: boolean }
      const txBytes = Buffer.from(txBase64, "base64")
      const tx = isVersioned ? VersionedTransaction.deserialize(txBytes) : Transaction.from(txBytes)
      setStatus("signing")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signed = await signTransaction(tx as any)
      setStatus("sending")
      const mainnetRpc = process.env.NEXT_PUBLIC_KAMINO_RPC_URL || "https://api.mainnet-beta.solana.com"
      const { Connection } = await import("@solana/web3.js")
      const conn = new Connection(mainnetRpc, "confirmed")
      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 })
      await conn.confirmTransaction(sig, "confirmed")
      setTxid(sig); setStatus("confirmed"); onSuccess?.(sig)
    } catch (err) {
      setStatus("failed")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(msg.includes("User rejected") || msg.includes("Plugin Closed") ? "Transaction cancelled in wallet." : msg)
    }
  }

  const isSubmitting = ["building","signing","sending"].includes(status)
  const confirmLabel: Partial<Record<CardStatus,string>> = {
    ready: "CONFIRM STAKE", building: "BUILDING TX…", signing: "SIGN IN WALLET…",
    sending: "BROADCASTING…", confirmed: "STAKED ✓", failed: "RETRY",
  }

  const solscanCluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet"

  return (
    <div style={card}>
      {/* Accent top bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,transparent,rgba(99,102,241,.5),transparent)" }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ padding:"2px 8px", background:"rgba(99,102,241,.08)", border:"1px solid rgba(99,102,241,.22)",
            borderRadius:4, fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700,
            letterSpacing:".14em", textTransform:"uppercase", color:"rgba(129,140,248,.88)" }}>JITO</span>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600,
            letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>LIQUID STAKE PREVIEW</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:"50%",
            background: status === "loading_apy" ? "#60A5FA" : status === "apy_error" ? "#F87171" : apyData?.source === "estimated" ? "#F59E0B" : "#818CF8",
            display:"inline-block", animation:"blink 2s ease-in-out infinite" }} />
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
            letterSpacing:".16em", textTransform:"uppercase", color:"#3F3F46" }}>
            {status === "loading_apy" ? "FETCHING" : apyData?.source === "estimated" ? "ESTIMATED" : status === "apy_error" ? "ERROR" : "LIVE"}
          </span>
        </div>
      </div>

      <div style={{ padding:"18px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Loading */}
        {status === "loading_apy" && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Spinner color="rgba(129,140,248,.8)" />
            <span style={labelSm}>Loading jitoSOL yield rate…</span>
          </div>
        )}

        {/* Error */}
        {status === "apy_error" && (
          <>
            <p style={{ ...labelSm, color:"rgba(248,113,113,.8)", lineHeight:1.55 }}>{apyError}</p>
            <button style={btnCancel} onClick={() => { setApyError(null); setStatus("loading_apy") }}>RETRY</button>
          </>
        )}

        {/* Ready / TX states */}
        {status !== "loading_apy" && status !== "apy_error" && (
          <>
            {/* Hero: stake → receive */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:10,
              padding:"14px", background:"rgba(0,0,0,.25)", borderRadius:8, border:"1px solid rgba(255,255,255,.06)" }}>
              <div>
                <p style={labelXs}>YOU STAKE</p>
                <p style={heroNum}>{intent.amount}</p>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:700,
                  letterSpacing:".1em", color:"rgba(245,158,11,.8)" }}>SOL</span>
              </div>
              <div style={{ width:28, height:28, borderRadius:"50%",
                background:"rgba(99,102,241,.08)", border:"1px solid rgba(99,102,241,.2)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontFamily:"'Material Symbols Outlined'",
                  fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
                  fontSize:14, color:"rgba(129,140,248,.7)", lineHeight:1 }}>arrow_forward</span>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={labelXs}>YOU RECEIVE</p>
                <p style={heroNum}>≈ {intent.amount.toFixed(4)}</p>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:700,
                  letterSpacing:".1em", color:"rgba(129,140,248,.85)" }}>jitoSOL</span>
              </div>
            </div>

            {/* APY + Liquid token */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div style={{ padding:"12px 14px", background:"rgba(99,102,241,.06)", borderRadius:8,
                border:"1px solid rgba(99,102,241,.14)" }}>
                <p style={labelXs}>STAKING APY</p>
                <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.7rem", fontWeight:400,
                  color:"rgba(129,140,248,.95)", lineHeight:1.1, margin:"4px 0 2px" }}>
                  {(apyData?.apy ?? 0).toFixed(2)}%
                </p>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:500,
                  letterSpacing:".1em", color:"#3F3F46" }}>Validator + MEV rewards</span>
              </div>
              <div style={{ padding:"12px 14px", background:"rgba(0,0,0,.25)", borderRadius:8,
                border:"1px solid rgba(255,255,255,.06)" }}>
                <p style={labelXs}>LIQUID TOKEN</p>
                <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.3rem", fontWeight:400,
                  color:"#F2F0EC", lineHeight:1.1, margin:"4px 0 2px" }}>jitoSOL</p>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:500,
                  letterSpacing:".1em", color:"#3F3F46" }}>Unstake anytime</span>
              </div>
            </div>

            {/* Projected earnings */}
            <div style={{ background:"rgba(0,0,0,.25)", borderRadius:8, padding:"12px 14px",
              border:"1px solid rgba(255,255,255,.05)" }}>
              <p style={labelXs}>PROJECTED SOL EARNINGS / YEAR</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:8 }}>
                {[
                  { l:"DAILY",   v:(daily   ?? 0).toFixed(6) },
                  { l:"MONTHLY", v:(monthly ?? 0).toFixed(4) },
                  { l:"YEARLY",  v:(yearly  ?? 0).toFixed(4) },
                ].map(({ l, v }) => (
                  <div key={l} style={{ textAlign:"center" }}>
                    <p style={labelXs}>{l}</p>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem", fontWeight:700,
                      color:"rgba(129,140,248,.85)", margin:0 }}>+{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Network notice */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
              background:"rgba(0,0,0,.2)", borderRadius:6, border:"1px solid rgba(255,255,255,.05)" }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(245,158,11,.6)",
                display:"inline-block", animation:"blink 2.5s ease-in-out infinite", flexShrink:0 }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:500,
                letterSpacing:".12em", textTransform:"uppercase", color:"#3F3F46" }}>
                EXECUTES ON SOLANA MAINNET · jitoSOL EARNS YIELD AUTOMATICALLY
              </span>
            </div>

            {txError && <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem",
              color:"rgba(248,113,113,.8)", lineHeight:1.55, margin:0 }}>{txError}</p>}

            {status === "confirmed" && txid && (
              <a href={`https://solscan.io/tx/${txid}${solscanCluster}`} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".56rem", fontWeight:600,
                  letterSpacing:".16em", textTransform:"uppercase", color:"rgba(129,140,248,.65)",
                  textDecoration:"none" }}>VIEW ON SOLSCAN →</a>
            )}

            {status !== "confirmed" && (
              <div style={{ display:"flex", gap:8, marginTop:2 }}>
                <button onClick={handleConfirm} disabled={isSubmitting || !publicKey}
                  style={{ ...btnConfirm, opacity: (isSubmitting || !publicKey) ? .55 : 1 }}
                  onMouseEnter={e => { if(!isSubmitting&&publicKey)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.02)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="none" }}>
                  {isSubmitting && <InlineSpinner color="#c7d2fe" />}
                  {!publicKey ? "CONNECT WALLET" : (confirmLabel[status] ?? "CONFIRM STAKE")}
                </button>
                <button onClick={onCancel} disabled={isSubmitting}
                  style={{ ...btnCancel, opacity: isSubmitting ? .4 : 1 }}>CANCEL</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Spinner({ color = "rgba(245,158,11,.8)" }: { color?: string }) {
  return <span style={{ width:14, height:14, border:`2px solid ${color}22`,
    borderTop:`2px solid ${color}`, borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite", flexShrink:0 }} />
}

function InlineSpinner({ color = "#e0e7ff" }: { color?: string }) {
  return <span style={{ width:11, height:11, border:`2px solid ${color}33`,
    borderTop:`2px solid ${color}cc`, borderRadius:"50%",
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
  fontFamily:"'Noto Serif',serif", fontSize:"1.7rem", fontWeight:400,
  color:"#F2F0EC", lineHeight:1.1, margin:"4px 0 2px",
}
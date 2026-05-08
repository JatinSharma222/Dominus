"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { VersionedTransaction, Transaction } from "@solana/web3.js"
import { KaminoDepositIntent } from "@/lib/tools/kamino"

interface KaminoDepositCardProps {
  intent: KaminoDepositIntent
  onSuccess?: (txid: string) => void
  onCancel?: () => void
}

type CardStatus = "loading_apy"|"ready"|"apy_error"|"building"|"signing"|"sending"|"confirmed"|"failed"
interface APYData { apy: number; source: "live"|"estimated"; marketSize?: string; utilization?: string }

// ── FIX: pass market + mint + symbol (was only passing token before) ──────────
async function fetchKaminoAPY(intent: KaminoDepositIntent): Promise<APYData> {
  const params = new URLSearchParams({
    market: intent.marketAddress,
    mint:   intent.mint,
    symbol: intent.token,
  })
  const res = await fetch(`/api/kamino/apy?${params}`, { headers: { Accept: "application/json" } })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Kamino APY fetch failed (${res.status})`)
  return body as APYData
}

// ── Styles ────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "#111116",
  border: "1px solid rgba(255,255,255,.08)",
  borderTop: "1px solid rgba(34,197,94,.18)",
  borderRadius: 10,
  overflow: "hidden",
  position: "relative",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 4px 24px rgba(0,0,0,.5)",
}

const btnConfirm: React.CSSProperties = {
  flex: 1, padding: "12px 0",
  background: "linear-gradient(135deg,#4ade80,#22c55e 55%,#16a34a)",
  border: "none", borderRadius: 8,
  fontFamily: "'Space Grotesk',sans-serif", fontSize: ".66rem", fontWeight: 700,
  letterSpacing: ".22em", textTransform: "uppercase" as const,
  color: "#052210", cursor: "pointer",
  boxShadow: "0 0 20px rgba(34,197,94,.3), 0 4px 14px rgba(0,0,0,.5)",
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

export default function KaminoDepositCard({ intent, onSuccess, onCancel }: KaminoDepositCardProps) {
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
        const data = await fetchKaminoAPY(intent)
        if (!cancelled) { setApyData(data); setStatus("ready") }
      } catch (err) {
        if (!cancelled) { setApyError(err instanceof Error ? err.message : String(err)); setStatus("apy_error") }
      }
    }
    load()
    return () => { cancelled = true }
  }, [intent.token])

  async function handleConfirm() {
    if (!publicKey || !signTransaction || !apyData) return
    setTxError(null)
    try {
      setStatus("building")
      const res = await fetch("/api/kamino/deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: intent.amount, token: intent.token, walletAddress: publicKey.toString(), marketAddress: intent.marketAddress, mint: intent.mint, decimals: intent.decimals }),
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
    ready: "CONFIRM DEPOSIT", building: "BUILDING TX…", signing: "SIGN IN WALLET…",
    sending: "BROADCASTING…", confirmed: "DEPOSITED ✓", failed: "RETRY",
  }

  const solscanCluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet"

  return (
    <div style={card}>
      {/* Accent top bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,transparent,rgba(34,197,94,.5),transparent)" }} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ padding:"2px 8px", background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.2)",
            borderRadius:4, fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700,
            letterSpacing:".14em", textTransform:"uppercase", color:"rgba(34,197,94,.85)" }}>KAMINO</span>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600,
            letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>LEND PREVIEW</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:"50%",
            background: status === "loading_apy" ? "#60A5FA" : status === "apy_error" ? "#F87171" : apyData?.source === "estimated" ? "#F59E0B" : "#22C55E",
            display:"inline-block", animation:"blink 2s ease-in-out infinite" }} />
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
            letterSpacing:".16em", textTransform:"uppercase", color:"#3F3F46" }}>
            {status === "loading_apy" ? "FETCHING" : apyData?.source === "estimated" ? "ESTIMATED" : status === "apy_error" ? "ERROR" : "LIVE"}
          </span>
        </div>
      </div>

      <div style={{ padding:"18px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Loading state */}
        {status === "loading_apy" && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Spinner color="rgba(34,197,94,.8)" />
            <span style={labelSm}>Loading yield rates for {intent.token}…</span>
          </div>
        )}

        {/* Error state */}
        {status === "apy_error" && (
          <>
            <p style={{ ...labelSm, color:"rgba(248,113,113,.8)", lineHeight:1.55 }}>{apyError}</p>
            <button style={btnCancel} onClick={() => { setApyError(null); setStatus("loading_apy") }}>RETRY</button>
          </>
        )}

        {/* Ready / transaction states */}
        {status !== "loading_apy" && status !== "apy_error" && (
          <>
            {/* Hero grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Cell label="DEPOSIT" value={`${intent.amount}`} unit={intent.token} big />
              <Cell label="SUPPLY APY" value={`${(apyData?.apy ?? 0).toFixed(2)}%`}
                valueColor="rgba(34,197,94,.9)"
                sub={apyData?.source === "estimated" ? "Estimated" : "Live rate"} big />
            </div>

            {/* Projected earnings */}
            <div style={{ background:"rgba(0,0,0,.25)", borderRadius:8, padding:"12px 14px",
              border:"1px solid rgba(255,255,255,.05)" }}>
              <p style={labelXs}>PROJECTED EARNINGS ({intent.token})</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:8 }}>
                {[
                  { l:"DAILY",   v:(daily   ?? 0).toFixed(4) },
                  { l:"MONTHLY", v:(monthly ?? 0).toFixed(2) },
                  { l:"YEARLY",  v:(yearly  ?? 0).toFixed(2) },
                ].map(({ l, v }) => (
                  <div key={l} style={{ textAlign:"center" }}>
                    <p style={labelXs}>{l}</p>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem", fontWeight:700,
                      color:"rgba(34,197,94,.85)", margin:0 }}>+{v}</p>
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
                EXECUTES ON SOLANA MAINNET · FUNDS EARN YIELD IMMEDIATELY
              </span>
            </div>

            {/* Errors */}
            {txError && <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem",
              color:"rgba(248,113,113,.8)", lineHeight:1.55, margin:0 }}>{txError}</p>}

            {/* Solscan link */}
            {status === "confirmed" && txid && (
              <a href={`https://solscan.io/tx/${txid}${solscanCluster}`} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".56rem", fontWeight:600,
                  letterSpacing:".16em", textTransform:"uppercase", color:"rgba(34,197,94,.6)",
                  textDecoration:"none" }}>VIEW ON SOLSCAN →</a>
            )}

            {/* Buttons */}
            {status !== "confirmed" && (
              <div style={{ display:"flex", gap:8, marginTop:2 }}>
                <button onClick={handleConfirm} disabled={isSubmitting || !publicKey}
                  style={{ ...btnConfirm, opacity: (isSubmitting || !publicKey) ? .55 : 1 }}
                  onMouseEnter={e => { if(!isSubmitting&&publicKey)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.02)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="none" }}>
                  {isSubmitting && <InlineSpinner color="#052210" />}
                  {!publicKey ? "CONNECT WALLET" : (confirmLabel[status] ?? "CONFIRM DEPOSIT")}
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

// ── Sub-components ────────────────────────────────────────────────────────────
function Cell({ label, value, unit, sub, big, valueColor }:
  { label:string; value:string; unit?:string; sub?:string; big?:boolean; valueColor?:string }) {
  return (
    <div style={{ padding:"12px 14px", background:"rgba(0,0,0,.25)", borderRadius:8, border:"1px solid rgba(255,255,255,.06)" }}>
      <p style={labelXs}>{label}</p>
      <p style={{ fontFamily:"'Noto Serif',serif", fontSize: big ? "1.7rem" : "1.2rem", fontWeight:400,
        color: valueColor ?? "#F2F0EC", lineHeight:1.1, margin:"4px 0 2px" }}>{value}</p>
      {unit && <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:700,
        letterSpacing:".1em", color:"rgba(245,158,11,.8)" }}>{unit}</span>}
      {sub && <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:500,
        letterSpacing:".1em", color:"#3F3F46", display:"block", marginTop:2 }}>{sub}</span>}
    </div>
  )
}

function Spinner({ color = "rgba(245,158,11,.8)" }: { color?: string }) {
  return <span style={{ width:14, height:14, border:`2px solid ${color}22`,
    borderTop:`2px solid ${color}`, borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite", flexShrink:0 }} />
}

function InlineSpinner({ color = "#1a0c00" }: { color?: string }) {
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
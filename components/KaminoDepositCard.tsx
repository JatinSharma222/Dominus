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

async function fetchKaminoAPY(token: string): Promise<APYData> {
  const res = await fetch(`/api/kamino/apy?token=${encodeURIComponent(token)}`, { headers: { Accept:"application/json" } })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Kamino APY fetch failed (${res.status})`)
  return body as APYData
}

const cardShell: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(20,26,20,.97) 0%, rgba(14,20,14,.99) 100%)",
  border: "1px solid rgba(100,220,120,.13)",
  borderTop: "1px solid rgba(120,240,140,.22)",
  borderRadius: 14,
  boxShadow: [
    "0 0 0 1px rgba(0,0,0,.55)",
    "0 4px 8px rgba(0,0,0,.62)",
    "0 16px 40px rgba(0,0,0,.76)",
    "0 32px 70px rgba(0,0,0,.55)",
    "0 0 40px rgba(60,200,90,.05)",
    "inset 0 1px 0 rgba(120,240,140,.07)",
    "inset 0 -1px 0 rgba(0,0,0,.3)",
  ].join(","),
  overflow: "hidden", position:"relative" as const, width:"100%", maxWidth:420,
}

export default function KaminoDepositCard({ intent, onSuccess, onCancel }: KaminoDepositCardProps) {
  const { publicKey, signTransaction } = useWallet()

  const [status,   setStatus]   = useState<CardStatus>("loading_apy")
  const [apyData,  setApyData]  = useState<APYData | null>(null)
  const [apyError, setApyError] = useState<string | null>(null)
  const [txid,     setTxid]     = useState<string | null>(null)
  const [txError,  setTxError]  = useState<string | null>(null)

  const daily   = apyData ? (intent.amount * apyData.apy) / 100 / 365 : null
  const monthly = daily   ? daily * 30 : null
  const yearly  = apyData ? (intent.amount * apyData.apy) / 100 : null

  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus("loading_apy"); setApyError(null)
      try {
        const data = await fetchKaminoAPY(intent.token)
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
    if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet") {
      setTxError("Kamino is a mainnet protocol. Execution enabled when app switches to mainnet.")
      setStatus("failed"); return
    }
    try {
      setStatus("building")
      const res = await fetch("/api/kamino/deposit", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ amount:intent.amount, token:intent.token, walletAddress:publicKey.toString(), marketAddress:intent.marketAddress, mint:intent.mint, decimals:intent.decimals }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({ error:res.statusText })); throw new Error(b.error ?? `Build failed (${res.status})`) }
      const { transaction:txBase64, isVersioned } = await res.json() as { transaction:string; isVersioned:boolean }
      const txBytes = Buffer.from(txBase64,"base64")
      const tx = isVersioned ? VersionedTransaction.deserialize(txBytes) : Transaction.from(txBytes)
      setStatus("signing")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signed = await signTransaction(tx as any)
      setStatus("sending")
      const mainnetRpc = process.env.NEXT_PUBLIC_KAMINO_RPC_URL || "https://api.mainnet-beta.solana.com"
      const { Connection } = await import("@solana/web3.js")
      const conn = new Connection(mainnetRpc,"confirmed")
      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight:false, maxRetries:3 })
      await conn.confirmTransaction(sig,"confirmed")
      setTxid(sig); setStatus("confirmed"); onSuccess?.(sig)
    } catch (err) {
      setStatus("failed")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(msg.includes("User rejected")||msg.includes("Plugin Closed") ? "Transaction cancelled in wallet." : msg)
    }
  }

  const isSubmitting = ["building","signing","sending"].includes(status)
  const confirmLabel: Partial<Record<CardStatus,string>> = {
    ready:"CONFIRM DEPOSIT", building:"BUILDING TX…", signing:"SIGN IN WALLET…",
    sending:"BROADCASTING…", confirmed:"DEPOSITED ✓", failed:"RETRY",
  }

  if (status === "loading_apy") return (
    <div style={cardShell}>
      <TopBar badge="KAMINO" label="LEND PREVIEW" status="fetching" />
      <div style={{ padding:"20px 22px 22px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <GreenSpinner />
          <span style={labelSm}>Loading yield rates for {intent.token}…</span>
        </div>
      </div>
    </div>
  )

  if (status === "apy_error") return (
    <div style={cardShell}>
      <TopBar badge="KAMINO" label="LEND PREVIEW" status="error" />
      <div style={{ padding:"20px 22px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <p style={{ ...labelSm, color:"rgba(255,100,80,.8)", lineHeight:1.55 }}>{apyError}</p>
        <button style={btnRetry} onClick={() => { setApyError(null); setStatus("loading_apy") }}>RETRY</button>
      </div>
    </div>
  )

  return (
    <div style={cardShell}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1.5,
        background:"linear-gradient(90deg,transparent,rgba(120,240,140,.45),transparent)" }} />

      <TopBar badge="KAMINO" label="LEND PREVIEW" status={apyData?.source === "estimated" ? "estimated" : "live"} accent="green" />

      <div style={{ padding:"0 22px 22px", display:"flex", flexDirection:"column", gap:18 }}>

        {/* Hero: deposit amount + APY */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={heroCell}>
            <span style={labelXs}>DEPOSIT</span>
            <p style={heroNum}>{intent.amount}</p>
            <span style={tokenBadge}>{intent.token}</span>
          </div>
          <div style={{ ...heroCell, background:"linear-gradient(135deg,rgba(80,200,100,.08),rgba(60,160,80,.04))", borderColor:"rgba(100,220,120,.14)" }}>
            <span style={labelXs}>SUPPLY APY</span>
            <p style={{ ...heroNum, color:"rgba(100,230,120,.95)" }}>{(apyData?.apy ?? 0).toFixed(2)}%</p>
            <span style={{ ...tokenBadge, color:"rgba(100,220,120,.6)" }}>
              {apyData?.source === "estimated" ? "ESTIMATED" : "LIVE RATE"}
            </span>
          </div>
        </div>

        {/* Projected earnings */}
        <div style={{ background:"rgba(0,0,0,.28)", borderRadius:10, padding:"14px 16px",
          border:"1px solid rgba(100,220,120,.07)", boxShadow:"inset 0 2px 8px rgba(0,0,0,.3)" }}>
          <span style={{ ...labelXs, marginBottom:12 }}>PROJECTED EARNINGS ({intent.token})</span>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[
              { label:"DAILY",   value:(daily   ?? 0).toFixed(4) },
              { label:"MONTHLY", value:(monthly ?? 0).toFixed(2) },
              { label:"YEARLY",  value:(yearly  ?? 0).toFixed(2) },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign:"center" }}>
                <span style={labelXs}>{label}</span>
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".82rem", fontWeight:700,
                  color:"rgba(100,220,120,.88)", margin:0 }}>+{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Market stats */}
        {(apyData?.marketSize || apyData?.utilization) && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {apyData.marketSize && (
              <div style={dataCell}><span style={labelXs}>MARKET SIZE</span><span style={dataVal}>{apyData.marketSize}</span></div>
            )}
            {apyData.utilization && (
              <div style={dataCell}><span style={labelXs}>UTILIZATION</span><span style={dataVal}>{apyData.utilization}</span></div>
            )}
          </div>
        )}

        {/* Network badge */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px",
          background:"rgba(0,0,0,.22)", borderRadius:8, border:"1px solid rgba(255,185,60,.07)" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"rgba(255,185,60,.6)",
            boxShadow:"0 0 6px rgba(245,158,11,.5)", display:"inline-block", flexShrink:0,
            animation:"blink 2.5s ease-in-out infinite" }} />
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:600,
            letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,215,150,.32)" }}>
            EXECUTES ON SOLANA MAINNET · FUNDS EARN YIELD IMMEDIATELY
          </span>
        </div>

        {txError && <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem",
          color:"rgba(255,100,80,.8)", lineHeight:1.55, margin:0 }}>{txError}</p>}

        {status === "confirmed" && txid && (
          <a href={`https://solscan.io/tx/${txid}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".58rem", fontWeight:600,
              letterSpacing:".18em", textTransform:"uppercase", color:"rgba(100,220,120,.7)",
              textDecoration:"none" }}>VIEW ON SOLSCAN →</a>
        )}

        {status !== "confirmed" && (
          <div style={{ display:"flex", gap:10, marginTop:2 }}>
            <button onClick={handleConfirm} disabled={isSubmitting||!publicKey}
              style={{
                flex:1, padding:"13px 0",
                background:"linear-gradient(135deg,#4ade80,#22c55e 45%,#16a34a)",
                border:"none", borderRadius:10,
                fontFamily:"'Space Grotesk',sans-serif", fontSize:".68rem", fontWeight:700,
                letterSpacing:".26em", textTransform:"uppercase" as const,
                color:"#052210", cursor:"pointer",
                boxShadow:"0 0 24px rgba(74,222,128,.45), 0 6px 20px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.3)",
                opacity: (isSubmitting||!publicKey) ? .55 : 1,
                transition:"transform .18s, box-shadow .18s",
                textShadow:"0 1px 0 rgba(255,255,255,.25)",
              }}
              onMouseEnter={e=>{ if(!isSubmitting&&publicKey)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.03) translateY(-1px)" }}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="none"}}>
              {isSubmitting && <InlineSpinner color="#052210" />}
              {!publicKey ? "CONNECT WALLET" : (confirmLabel[status] ?? "CONFIRM DEPOSIT")}
            </button>
            <button onClick={onCancel} disabled={isSubmitting}
              style={{ ...btnRetry, padding:"13px 20px", opacity:isSubmitting?.4:1 }}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  )
}

function TopBar({ badge, label, status, accent="amber" }: { badge:string; label:string; status:string; accent?:string }) {
  const isGreen = accent === "green"
  const dotColor = status==="live" ? (isGreen?"#55FF88":"#55FF99") : status==="estimated" ? "#FFB95F" : status==="error" ? "#FF6B6B" : "#B1CFF6"
  const dotLabel = status==="fetching"?"FETCHING":status==="estimated"?"ESTIMATED":status==="error"?"ERROR":"LIVE"
  const badgeColor = isGreen ? "rgba(100,220,120," : "rgba(255,185,60,"
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"14px 22px", borderBottom:`1px solid ${badgeColor}.07)` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ padding:"3px 10px", background:`${badgeColor}.08)`, border:`1px solid ${badgeColor}.2)`,
          borderRadius:20, fontFamily:"'Space Grotesk',sans-serif",
          fontSize:".52rem", fontWeight:700, letterSpacing:".18em",
          textTransform:"uppercase", color:`${badgeColor}.88)` }}>{badge}</span>
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", fontWeight:600,
          letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,215,150,.3)" }}>{label}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:dotColor,
          boxShadow:`0 0 7px ${dotColor}`, display:"inline-block",
          animation:"blink 2s ease-in-out infinite" }} />
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:600,
          letterSpacing:".2em", textTransform:"uppercase", color:`${dotColor}99` }}>{dotLabel}</span>
      </div>
    </div>
  )
}

function GreenSpinner() {
  return <span style={{ width:14, height:14, border:"2px solid rgba(100,220,120,.2)",
    borderTop:"2px solid rgba(100,220,120,.85)", borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite", flexShrink:0 }} />
}

function InlineSpinner({ color="#1a0c00" }: { color?:string }) {
  return <span style={{ width:11, height:11, border:`2px solid ${color}33`,
    borderTop:`2px solid ${color}ee`, borderRadius:"50%",
    display:"inline-block", animation:"spin .8s linear infinite",
    marginRight:8, verticalAlign:"middle" }} />
}

const labelXs: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
  letterSpacing:".22em", textTransform:"uppercase", color:"rgba(255,215,150,.28)",
  display:"block", marginBottom:5,
}
const labelSm: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", color:"rgba(255,215,150,.4)", letterSpacing:".06em",
}
const heroCell: React.CSSProperties = {
  padding:"14px 14px", background:"rgba(0,0,0,.28)", borderRadius:10,
  border:"1px solid rgba(255,185,60,.08)", boxShadow:"inset 0 2px 8px rgba(0,0,0,.3)",
}
const heroNum: React.CSSProperties = {
  fontFamily:"'Noto Serif',serif", fontSize:"1.9rem", fontWeight:400,
  color:"#E5E2E1", lineHeight:1.1, margin:"4px 0 4px",
}
const tokenBadge: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".64rem", fontWeight:700,
  letterSpacing:".12em", color:"rgba(255,185,60,.88)",
}
const dataCell: React.CSSProperties = {
  padding:"10px 12px", background:"rgba(0,0,0,.22)",
  border:"1px solid rgba(100,220,120,.06)", borderRadius:8, display:"flex", flexDirection:"column",
}
const dataVal: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem", fontWeight:700,
  letterSpacing:".08em", color:"rgba(100,220,120,.82)",
}
const btnRetry: React.CSSProperties = {
  padding:"8px 16px", background:"rgba(255,255,255,.04)",
  border:"1px solid rgba(255,185,60,.14)", borderRadius:10,
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:600,
  letterSpacing:".22em", textTransform:"uppercase" as const,
  color:"rgba(255,200,140,.4)", cursor:"pointer",
  boxShadow:"0 4px 14px rgba(0,0,0,.45)",
}
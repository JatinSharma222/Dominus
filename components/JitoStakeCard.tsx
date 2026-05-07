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
interface APYData { apy: number; source:"live"|"estimated" }

async function fetchJitoAPY(): Promise<APYData> {
  const res = await fetch("/api/jito/apy", { headers:{ Accept:"application/json" } })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `Jito APY fetch failed (${res.status})`)
  return body as APYData
}

const cardShell: React.CSSProperties = {
  background:"linear-gradient(145deg,rgba(14,18,30,.97) 0%,rgba(10,13,24,.99) 100%)",
  border:"1px solid rgba(100,140,255,.13)",
  borderTop:"1px solid rgba(130,165,255,.22)",
  borderRadius:14,
  boxShadow:[
    "0 0 0 1px rgba(0,0,0,.55)",
    "0 4px 8px rgba(0,0,0,.62)",
    "0 16px 40px rgba(0,0,0,.76)",
    "0 32px 70px rgba(0,0,0,.55)",
    "0 0 40px rgba(80,100,255,.05)",
    "inset 0 1px 0 rgba(130,165,255,.07)",
    "inset 0 -1px 0 rgba(0,0,0,.3)",
  ].join(","),
  overflow:"hidden", position:"relative" as const, width:"100%", maxWidth:420,
}

export default function JitoStakeCard({ intent, onSuccess, onCancel }: JitoStakeCardProps) {
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
    if (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet") {
      setTxError("Jito is a mainnet protocol. Execution enabled when app switches to mainnet.")
      setStatus("failed"); return
    }
    try {
      setStatus("building")
      const res = await fetch("/api/jito/stake", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ amount:intent.amount, walletAddress:publicKey.toString(), stakePoolAddress:intent.stakePoolAddress }),
      })
      if (!res.ok) { const b = await res.json().catch(()=>({error:res.statusText})); throw new Error(b.error??`Build failed (${res.status})`) }
      const { transaction:txBase64, isVersioned } = await res.json() as {transaction:string;isVersioned:boolean}
      const txBytes = Buffer.from(txBase64,"base64")
      const tx = isVersioned ? VersionedTransaction.deserialize(txBytes) : Transaction.from(txBytes)
      setStatus("signing")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signed = await signTransaction(tx as any)
      setStatus("sending")
      const mainnetRpc = process.env.NEXT_PUBLIC_KAMINO_RPC_URL||"https://api.mainnet-beta.solana.com"
      const { Connection } = await import("@solana/web3.js")
      const conn = new Connection(mainnetRpc,"confirmed")
      const sig = await conn.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:3})
      await conn.confirmTransaction(sig,"confirmed")
      setTxid(sig); setStatus("confirmed"); onSuccess?.(sig)
    } catch (err) {
      setStatus("failed")
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setTxError(msg.includes("User rejected")||msg.includes("Plugin Closed")?"Transaction cancelled in wallet.":msg)
    }
  }

  const isSubmitting = ["building","signing","sending"].includes(status)
  const confirmLabel: Partial<Record<CardStatus,string>> = {
    ready:"CONFIRM STAKE", building:"BUILDING TX…", signing:"SIGN IN WALLET…",
    sending:"BROADCASTING…", confirmed:"STAKED ✓", failed:"RETRY",
  }

  if (status==="loading_apy") return (
    <div style={cardShell}>
      <TopBar status="fetching" />
      <div style={{padding:"20px 22px 22px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <BlueSpinner /><span style={labelSm}>Loading jitoSOL yield rate…</span>
        </div>
      </div>
    </div>
  )

  if (status==="apy_error") return (
    <div style={cardShell}>
      <TopBar status="error" />
      <div style={{padding:"20px 22px 22px",display:"flex",flexDirection:"column",gap:14}}>
        <p style={{...labelSm,color:"rgba(255,100,80,.8)",lineHeight:1.55}}>{apyError}</p>
        <button style={btnRetry} onClick={()=>{setApyError(null);setStatus("loading_apy")}}>RETRY</button>
      </div>
    </div>
  )

  return (
    <div style={cardShell}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1.5,
        background:"linear-gradient(90deg,transparent,rgba(130,165,255,.45),transparent)"}} />

      <TopBar status={apyData?.source==="estimated"?"estimated":"live"} />

      <div style={{padding:"0 22px 22px",display:"flex",flexDirection:"column",gap:18}}>

        {/* Hero: stake → receive */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:10,
          padding:"18px 16px 16px",background:"rgba(0,0,0,.3)",borderRadius:10,
          border:"1px solid rgba(100,140,255,.08)",boxShadow:"inset 0 2px 8px rgba(0,0,0,.35)"}}>
          <div>
            <span style={labelXs}>YOU STAKE</span>
            <p style={heroNum}>{intent.amount}</p>
            <span style={{...tokenBadge,color:"rgba(255,185,60,.88)"}}>SOL</span>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:30,height:30,borderRadius:"50%",
              background:"rgba(100,140,255,.1)",border:"1px solid rgba(130,165,255,.22)",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 0 12px rgba(100,140,255,.2)"}}>
              <span style={{fontFamily:"'Material Symbols Outlined'",
                fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
                fontSize:15,color:"rgba(130,165,255,.8)",lineHeight:1}}>arrow_forward</span>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <span style={labelXs}>YOU RECEIVE</span>
            <p style={heroNum}>≈ {intent.amount.toFixed(4)}</p>
            <span style={{...tokenBadge,color:"rgba(130,165,255,.88)"}}>jitoSOL</span>
          </div>
        </div>

        {/* APY highlight */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{padding:"14px",background:"linear-gradient(135deg,rgba(100,140,255,.08),rgba(80,110,220,.04))",
            borderRadius:10,border:"1px solid rgba(100,140,255,.14)",boxShadow:"inset 0 2px 8px rgba(0,0,0,.28)"}}>
            <span style={labelXs}>STAKING APY</span>
            <p style={{fontFamily:"'Noto Serif',serif",fontSize:"1.9rem",fontWeight:400,
              color:"rgba(130,165,255,.95)",margin:"4px 0 4px"}}>{(apyData?.apy??0).toFixed(2)}%</p>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".52rem",fontWeight:600,
              letterSpacing:".14em",textTransform:"uppercase" as const,color:"rgba(130,165,255,.45)"}}>
              Validator rewards + MEV
            </span>
          </div>
          <div style={{padding:"14px",background:"rgba(0,0,0,.25)",borderRadius:10,
            border:"1px solid rgba(100,140,255,.07)",boxShadow:"inset 0 2px 8px rgba(0,0,0,.28)"}}>
            <span style={labelXs}>LIQUID TOKEN</span>
            <p style={{fontFamily:"'Noto Serif',serif",fontSize:"1.3rem",fontWeight:400,
              color:"#E5E2E1",margin:"4px 0 4px"}}>jitoSOL</p>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".52rem",fontWeight:600,
              letterSpacing:".14em",textTransform:"uppercase" as const,color:"rgba(255,215,150,.35)"}}>
              Unstake anytime
            </span>
          </div>
        </div>

        {/* Projected earnings */}
        <div style={{background:"rgba(0,0,0,.28)",borderRadius:10,padding:"14px 16px",
          border:"1px solid rgba(100,140,255,.07)",boxShadow:"inset 0 2px 8px rgba(0,0,0,.3)"}}>
          <span style={{...labelXs,marginBottom:12}}>PROJECTED EARNINGS (SOL/year)</span>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {label:"DAILY",value:(daily??0).toFixed(6)},
              {label:"MONTHLY",value:(monthly??0).toFixed(4)},
              {label:"YEARLY",value:(yearly??0).toFixed(4)},
            ].map(({label,value})=>(
              <div key={label} style={{textAlign:"center"}}>
                <span style={labelXs}>{label}</span>
                <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".78rem",fontWeight:700,
                  color:"rgba(130,165,255,.88)",margin:0}}>+{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mainnet badge */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",
          background:"rgba(0,0,0,.22)",borderRadius:8,border:"1px solid rgba(100,140,255,.07)"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"rgba(130,165,255,.6)",
            boxShadow:"0 0 6px rgba(100,140,255,.6)",display:"inline-block",flexShrink:0,
            animation:"blink 2.5s ease-in-out infinite"}} />
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".46rem",fontWeight:600,
            letterSpacing:".18em",textTransform:"uppercase" as const,color:"rgba(255,215,150,.32)"}}>
            EXECUTES ON SOLANA MAINNET · jitoSOL EARNS YIELD AUTOMATICALLY
          </span>
        </div>

        {txError && <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".62rem",
          color:"rgba(255,100,80,.8)",lineHeight:1.55,margin:0}}>{txError}</p>}

        {status==="confirmed"&&txid&&(
          <a href={`https://solscan.io/tx/${txid}`} target="_blank" rel="noopener noreferrer"
            style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".58rem",fontWeight:600,
              letterSpacing:".18em",textTransform:"uppercase",color:"rgba(130,165,255,.7)",textDecoration:"none"}}>
            VIEW ON SOLSCAN →</a>
        )}

        {status!=="confirmed"&&(
          <div style={{display:"flex",gap:10,marginTop:2}}>
            <button onClick={handleConfirm} disabled={isSubmitting||!publicKey}
              style={{
                flex:1,padding:"13px 0",
                background:"linear-gradient(135deg,#818cf8,#6366f1 45%,#4f46e5)",
                border:"none",borderRadius:10,
                fontFamily:"'Space Grotesk',sans-serif",fontSize:".68rem",fontWeight:700,
                letterSpacing:".26em",textTransform:"uppercase" as const,
                color:"#e0e7ff",cursor:"pointer",
                boxShadow:"0 0 24px rgba(99,102,241,.5), 0 6px 20px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.2)",
                opacity:(isSubmitting||!publicKey)?.55:1,
                transition:"transform .18s, box-shadow .18s",
              }}
              onMouseEnter={e=>{if(!isSubmitting&&publicKey)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.03) translateY(-1px)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="none"}}>
              {isSubmitting&&<InlineSpinner color="#c7d2fe" />}
              {!publicKey?"CONNECT WALLET":(confirmLabel[status]??"CONFIRM STAKE")}
            </button>
            <button onClick={onCancel} disabled={isSubmitting}
              style={{...btnRetry,padding:"13px 20px",opacity:isSubmitting?.4:1}}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  )
}

function TopBar({status}:{status:string}) {
  const dotColor = status==="live"?"#6ee7b7":status==="estimated"?"#FFB95F":status==="error"?"#FF6B6B":"#93c5fd"
  const dotLabel = status==="fetching"?"FETCHING":status==="estimated"?"ESTIMATED":status==="error"?"ERROR":"LIVE"
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"14px 22px",borderBottom:"1px solid rgba(100,140,255,.07)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{padding:"3px 10px",background:"rgba(100,140,255,.09)",border:"1px solid rgba(130,165,255,.2)",
          borderRadius:20,fontFamily:"'Space Grotesk',sans-serif",fontSize:".52rem",fontWeight:700,
          letterSpacing:".18em",textTransform:"uppercase" as const,color:"rgba(130,165,255,.88)"}}>Jito</span>
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".52rem",fontWeight:600,
          letterSpacing:".18em",textTransform:"uppercase" as const,color:"rgba(255,215,150,.3)"}}>LIQUID STAKE PREVIEW</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:dotColor,
          boxShadow:`0 0 7px ${dotColor}`,display:"inline-block",animation:"blink 2s ease-in-out infinite"}} />
        <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".46rem",fontWeight:600,
          letterSpacing:".2em",textTransform:"uppercase" as const,color:`${dotColor}99`}}>{dotLabel}</span>
      </div>
    </div>
  )
}

function BlueSpinner() {
  return <span style={{width:14,height:14,border:"2px solid rgba(100,140,255,.2)",
    borderTop:"2px solid rgba(130,165,255,.85)",borderRadius:"50%",
    display:"inline-block",animation:"spin .8s linear infinite",flexShrink:0}} />
}
function InlineSpinner({color="#1a0c00"}:{color?:string}) {
  return <span style={{width:11,height:11,border:`2px solid ${color}33`,
    borderTop:`2px solid ${color}ee`,borderRadius:"50%",
    display:"inline-block",animation:"spin .8s linear infinite",marginRight:8,verticalAlign:"middle"}} />
}
const labelXs:React.CSSProperties={fontFamily:"'Space Grotesk',sans-serif",fontSize:".44rem",fontWeight:600,letterSpacing:".22em",textTransform:"uppercase",color:"rgba(255,215,150,.28)",display:"block",marginBottom:5}
const labelSm:React.CSSProperties={fontFamily:"'Space Grotesk',sans-serif",fontSize:".6rem",color:"rgba(255,215,150,.4)",letterSpacing:".06em"}
const heroNum:React.CSSProperties={fontFamily:"'Noto Serif',serif",fontSize:"1.9rem",fontWeight:400,color:"#E5E2E1",lineHeight:1.1,margin:"4px 0 4px"}
const tokenBadge:React.CSSProperties={fontFamily:"'Space Grotesk',sans-serif",fontSize:".64rem",fontWeight:700,letterSpacing:".12em"}
const btnRetry:React.CSSProperties={padding:"8px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,185,60,.14)",borderRadius:10,fontFamily:"'Space Grotesk',sans-serif",fontSize:".62rem",fontWeight:600,letterSpacing:".22em",textTransform:"uppercase" as const,color:"rgba(255,200,140,.4)",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,0,0,.45)"}
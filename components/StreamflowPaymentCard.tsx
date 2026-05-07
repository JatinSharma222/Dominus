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

const cardShell: React.CSSProperties = {
  background:"linear-gradient(145deg,rgba(22,14,30,.97) 0%,rgba(16,10,22,.99) 100%)",
  border:"1px solid rgba(167,139,250,.13)",
  borderTop:"1px solid rgba(196,181,253,.22)",
  borderRadius:14,
  boxShadow:[
    "0 0 0 1px rgba(0,0,0,.55)",
    "0 4px 8px rgba(0,0,0,.62)",
    "0 16px 40px rgba(0,0,0,.76)",
    "0 32px 70px rgba(0,0,0,.55)",
    "0 0 40px rgba(120,80,220,.06)",
    "inset 0 1px 0 rgba(196,181,253,.07)",
    "inset 0 -1px 0 rgba(0,0,0,.3)",
  ].join(","),
  overflow:"hidden", position:"relative" as const, width:"100%", maxWidth:420,
}

export default function StreamflowPaymentCard({ intent, onSuccess, onCancel }: StreamflowPaymentCardProps) {
  const { publicKey, signTransaction, signAllTransactions } = useWallet()
  const { connection } = useConnection()

  const [status,   setStatus]   = useState<CardStatus>("ready")
  const [streamId, setStreamId] = useState<string | null>(null)
  const [txError,  setTxError]  = useState<string | null>(null)

  const isDevnet    = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet"
  const mint        = isDevnet ? intent.devnetMint : intent.mainnetMint
  const isSubmitting = ["building","signing","sending"].includes(status)

  const confirmLabel: Partial<Record<CardStatus,string>> = {
    ready:"CREATE STREAM", building:"BUILDING TX…", signing:"SIGN IN WALLET…",
    sending:"BROADCASTING…", confirmed:"STREAM CREATED ✓", failed:"RETRY",
  }

  const handleConfirm = useCallback(async () => {
    if (!publicKey||!signTransaction||!signAllTransactions) return
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
        canTopup:true, cancelableBySender:true, cancelableByRecipient:false,
        transferableBySender:false, transferableByRecipient:false,
        automaticWithdrawal:false, withdrawalFrequency:0,
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
      setTxError(msg.includes("User rejected")||msg.includes("Plugin Closed")||msg.includes("rejected")
        ? "Transaction cancelled in wallet." : msg)
    }
  }, [publicKey, signTransaction, signAllTransactions, connection, intent, mint, isDevnet, onSuccess])

  return (
    <div style={cardShell}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1.5,
        background:"linear-gradient(90deg,transparent,rgba(196,181,253,.45),transparent)"}} />

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"14px 22px",borderBottom:"1px solid rgba(167,139,250,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{padding:"3px 10px",background:"rgba(167,139,250,.09)",
            border:"1px solid rgba(196,181,253,.2)",borderRadius:20,
            fontFamily:"'Space Grotesk',sans-serif",fontSize:".52rem",fontWeight:700,
            letterSpacing:".18em",textTransform:"uppercase" as const,color:"rgba(196,181,253,.88)"}}>Streamflow</span>
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".52rem",fontWeight:600,
            letterSpacing:".18em",textTransform:"uppercase" as const,color:"rgba(255,215,150,.3)"}}>PAYMENT STREAM</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#a78bfa",
            boxShadow:"0 0 7px #a78bfa",display:"inline-block",animation:"blink 2s ease-in-out infinite"}} />
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".46rem",fontWeight:600,
            letterSpacing:".2em",textTransform:"uppercase" as const,color:"rgba(167,139,250,.6)"}}>PREVIEW</span>
        </div>
      </div>

      <div style={{padding:"0 22px 22px",display:"flex",flexDirection:"column",gap:18}}>

        {/* Hero: amount + frequency */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,
          padding:"18px 16px 16px",background:"rgba(0,0,0,.3)",borderRadius:10,
          border:"1px solid rgba(167,139,250,.08)",boxShadow:"inset 0 2px 8px rgba(0,0,0,.35)"}}>
          <div>
            <span style={labelXs}>PER PERIOD</span>
            <p style={heroNum}>{intent.amountPerPeriod}</p>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".64rem",fontWeight:700,
              letterSpacing:".12em",color:"rgba(255,185,60,.88)"}}>{intent.token}</span>
          </div>
          <div style={{textAlign:"right"}}>
            <span style={labelXs}>FREQUENCY</span>
            <p style={{fontFamily:"'Noto Serif',serif",fontSize:"1.6rem",fontWeight:400,
              color:"rgba(196,181,253,.95)",lineHeight:1.1,margin:"4px 0 4px"}}>
              {freqLabel(intent.frequency)}
            </p>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".46rem",fontWeight:600,
              letterSpacing:".14em",textTransform:"uppercase" as const,color:"rgba(167,139,250,.45)"}}>
              RELEASE SCHEDULE
            </span>
          </div>
        </div>

        {/* Stream details grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {label:"RECIPIENT", value:shortenAddress(intent.recipient)},
            {label:"DURATION",  value:durationLabel(intent.frequency, intent.totalPeriods)},
            {label:"TOTAL",     value:`${intent.totalAmount} ${intent.token}`},
          ].map(({label,value}) => (
            <div key={label} style={dataCell}>
              <span style={labelXs}>{label}</span>
              <span style={dataVal}>{value}</span>
            </div>
          ))}
        </div>

        {/* Cancellation info */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={dataCell}>
            <span style={labelXs}>RECIPIENT WITHDRAW</span>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".72rem",fontWeight:700,
              letterSpacing:".08em",color:"rgba(196,181,253,.75)"}}>Anytime</span>
          </div>
          <div style={dataCell}>
            <span style={labelXs}>YOU CAN CANCEL</span>
            <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".72rem",fontWeight:700,
              letterSpacing:".08em",color:"rgba(196,181,253,.75)"}}>Anytime</span>
          </div>
        </div>

        {/* Full recipient */}
        <div style={{padding:"10px 14px",background:"rgba(0,0,0,.3)",borderRadius:8,
          border:"1px solid rgba(167,139,250,.07)"}}>
          <span style={labelXs}>FULL RECIPIENT ADDRESS</span>
          <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".5rem",
            color:"rgba(196,181,253,.4)",letterSpacing:".06em",wordBreak:"break-all",lineHeight:1.6,margin:0}}>
            {intent.recipient}
          </p>
        </div>

        {/* Network badge */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",
          background:"rgba(0,0,0,.22)",borderRadius:8,border:"1px solid rgba(167,139,250,.07)"}}>
          <span style={{width:6,height:6,borderRadius:"50%",
            background:isDevnet?"rgba(177,207,246,.6)":"rgba(167,139,250,.6)",
            boxShadow:`0 0 6px ${isDevnet?"rgba(177,207,246,.6)":"rgba(167,139,250,.6)"}`,
            display:"inline-block",flexShrink:0,animation:"blink 2.5s ease-in-out infinite"}} />
          <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".46rem",fontWeight:600,
            letterSpacing:".18em",textTransform:"uppercase" as const,color:"rgba(255,215,150,.32)"}}>
            {isDevnet?"EXECUTES ON SOLANA DEVNET · NO REAL FUNDS":"EXECUTES ON SOLANA MAINNET · FUNDS LEAVE YOUR WALLET"}
          </span>
        </div>

        {txError && <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".62rem",
          color:"rgba(255,100,80,.8)",lineHeight:1.55,margin:0}}>{txError}</p>}

        {status==="confirmed"&&streamId&&(
          <a href="https://app.streamflow.finance/" target="_blank" rel="noopener noreferrer"
            style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:".58rem",fontWeight:600,
              letterSpacing:".18em",textTransform:"uppercase",color:"rgba(196,181,253,.7)",textDecoration:"none"}}>
            VIEW STREAM ON STREAMFLOW →</a>
        )}

        {status!=="confirmed"&&(
          <div style={{display:"flex",gap:10,marginTop:2}}>
            <button onClick={handleConfirm} disabled={isSubmitting||!publicKey}
              style={{
                flex:1,padding:"13px 0",
                background:"linear-gradient(135deg,#c084fc,#a855f7 45%,#7c3aed)",
                border:"none",borderRadius:10,
                fontFamily:"'Space Grotesk',sans-serif",fontSize:".68rem",fontWeight:700,
                letterSpacing:".26em",textTransform:"uppercase" as const,
                color:"#f3e8ff",cursor:"pointer",
                boxShadow:"0 0 24px rgba(168,85,247,.45), 0 6px 20px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.2)",
                opacity:(isSubmitting||!publicKey)?.55:1,
                transition:"transform .18s, box-shadow .18s",
              }}
              onMouseEnter={e=>{if(!isSubmitting&&publicKey)(e.currentTarget as HTMLButtonElement).style.transform="scale(1.03) translateY(-1px)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="none"}}>
              {isSubmitting&&<InlineSpinner color="#e9d5ff" />}
              {!publicKey?"CONNECT WALLET":(confirmLabel[status]??"CREATE STREAM")}
            </button>
            <button onClick={onCancel} disabled={isSubmitting}
              style={{...btnCancel,opacity:isSubmitting?.4:1}}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  )
}

function InlineSpinner({color="#1a0c00"}:{color?:string}) {
  return <span style={{width:11,height:11,border:`2px solid ${color}33`,
    borderTop:`2px solid ${color}ee`,borderRadius:"50%",
    display:"inline-block",animation:"spin .8s linear infinite",marginRight:8,verticalAlign:"middle"}} />
}
const labelXs:React.CSSProperties={fontFamily:"'Space Grotesk',sans-serif",fontSize:".44rem",fontWeight:600,letterSpacing:".22em",textTransform:"uppercase",color:"rgba(255,215,150,.28)",display:"block",marginBottom:5}
const heroNum:React.CSSProperties={fontFamily:"'Noto Serif',serif",fontSize:"1.9rem",fontWeight:400,color:"#E5E2E1",lineHeight:1.1,margin:"4px 0 4px"}
const dataCell:React.CSSProperties={padding:"10px 12px",background:"rgba(0,0,0,.25)",border:"1px solid rgba(167,139,250,.07)",borderRadius:8,display:"flex",flexDirection:"column"}
const dataVal:React.CSSProperties={fontFamily:"'Space Grotesk',sans-serif",fontSize:".72rem",fontWeight:700,letterSpacing:".08em",color:"rgba(196,181,253,.82)"}
const btnCancel:React.CSSProperties={padding:"13px 20px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,185,60,.14)",borderRadius:10,fontFamily:"'Space Grotesk',sans-serif",fontSize:".62rem",fontWeight:600,letterSpacing:".22em",textTransform:"uppercase" as const,color:"rgba(255,200,140,.4)",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,0,0,.45)"}
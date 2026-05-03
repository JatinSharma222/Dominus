"use client"

import { Message } from "@/lib/types"
import { JupiterSwapIntent } from "@/lib/tools/jupiter"
import { KaminoDepositIntent } from "@/lib/tools/kamino"
import { JitoStakeIntent } from "@/lib/tools/jito"
import { StreamflowPaymentIntent } from "@/lib/tools/streamflow"
import TxConfirmCard from "./TxConfirmCard"
import KaminoDepositCard from "./KaminoDepositCard"
import JitoStakeCard from "./JitoStakeCard"
import StreamflowPaymentCard from "./StreamflowPaymentCard"

interface ToolInvocation {
  toolName: string
  state: "call" | "result" | "partial-call"
  result?: unknown
}
interface MessageBubbleProps {
  message: Message & { toolInvocations?: ToolInvocation[] }
  isLoading?: boolean
}

const isSwap       = (r: unknown): r is JupiterSwapIntent        => typeof r === "object" && r !== null && (r as Record<string,unknown>).type === "swap_intent"
const isKamino     = (r: unknown): r is KaminoDepositIntent      => typeof r === "object" && r !== null && (r as Record<string,unknown>).type === "kamino_deposit_intent"
const isJito       = (r: unknown): r is JitoStakeIntent          => typeof r === "object" && r !== null && (r as Record<string,unknown>).type === "jito_stake_intent"
const isStreamflow = (r: unknown): r is StreamflowPaymentIntent  => typeof r === "object" && r !== null && (r as Record<string,unknown>).type === "streamflow_payment_intent"

const TOOL_LABELS: Record<string,string> = {
  get_portfolio:         "Reading wallet balances",
  swap_tokens:           "Resolving swap route via Jupiter",
  deposit_for_yield:     "Loading Kamino yield rates",
  stake_sol:             "Fetching Jito staking data",
  create_payment_stream: "Setting up Streamflow payment",
}

const AETHER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

export default function MessageBubble({ message, isLoading }: MessageBubbleProps) {
  const isAI = message.role === "assistant"
  const time = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false })
  const tools = message.toolInvocations ?? []

  const swapIntents       = tools.filter((t) => t.state === "result" && isSwap(t.result)).map((t) => t.result as JupiterSwapIntent)
  const kaminoIntents     = tools.filter((t) => t.state === "result" && isKamino(t.result)).map((t) => t.result as KaminoDepositIntent)
  const jitoIntents       = tools.filter((t) => t.state === "result" && isJito(t.result)).map((t) => t.result as JitoStakeIntent)
  const streamflowIntents = tools.filter((t) => t.state === "result" && isStreamflow(t.result)).map((t) => t.result as StreamflowPaymentIntent)

  if (isAI) {
    return (
      <div style={{ display:"flex", gap:10, maxWidth:"88%", marginRight:"auto" }}>

        {/* Avatar */}
        <div style={{
          width:28, height:28, borderRadius:3, flexShrink:0, marginTop:18, overflow:"hidden",
          border:"1px solid rgba(255,193,116,.2)",
          background:"rgba(255,193,116,.07)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <img
            src={AETHER_AVATAR}
            alt="Aether-01"
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none"
            }}
          />
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Eyebrow */}
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600, letterSpacing:".22em", textTransform:"uppercase", color:"rgba(229,226,225,.25)", marginBottom:6 }}>
            AETHER-01 CORE // {time}
          </p>

          {/* Bubble */}
          <div style={{
            background:"#1C1B1B",
            borderLeft:"2.5px solid rgba(255,193,116,.32)",
            borderRadius:"0 3px 3px 0",
            padding:"14px 18px",
            display:"flex", flexDirection:"column", gap:12,
          }}>
            {/* Tool status rows */}
            {tools.map((tool, i) => {
              const done = tool.state === "result"
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{
                    width:6, height:6, borderRadius:"50%", flexShrink:0,
                    background: done ? "#FFC174" : "#B1CFF6",
                    animation: done ? "none" : "blink 1.5s ease-in-out infinite",
                  }} />
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".58rem", fontWeight:600, letterSpacing:".18em", textTransform:"uppercase", color: done ? "#FFC174" : "#B1CFF6" }}>
                    {done
                      ? `${TOOL_LABELS[tool.toolName] ?? tool.toolName} ✓`
                      : `${TOOL_LABELS[tool.toolName] ?? tool.toolName}...`}
                  </span>
                </div>
              )
            })}

            {/* Transaction cards */}
            {swapIntents.map((intent, i) => (
              <TxConfirmCard key={`swap-${i}`} intent={intent} onSuccess={(id) => console.log("swap:", id)} onCancel={() => {}} />
            ))}
            {kaminoIntents.map((intent, i) => (
              <KaminoDepositCard key={`kamino-${i}`} intent={intent} onSuccess={(id) => console.log("kamino:", id)} onCancel={() => {}} />
            ))}
            {jitoIntents.map((intent, i) => (
              <JitoStakeCard key={`jito-${i}`} intent={intent} onSuccess={(id) => console.log("jito:", id)} onCancel={() => {}} />
            ))}
            {streamflowIntents.map((intent, i) => (
              <StreamflowPaymentCard key={`sf-${i}`} intent={intent} onSuccess={(id) => console.log("stream:", id)} onCancel={() => {}} />
            ))}

            {/* Message text */}
            {message.content ? (
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem", color:"rgba(216,195,173,.9)", lineHeight:1.65, whiteSpace:"pre-wrap" }}>
                {message.content}
              </p>
            ) : isLoading ? (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ display:"flex", gap:5 }}>
                  {[0, 160, 320].map((delay) => (
                    <span key={delay} style={{
                      width:6, height:6, borderRadius:"50%",
                      background:"rgba(255,193,116,.45)",
                      animation:`blink 1.4s ease-in-out infinite`,
                      animationDelay:`${delay}ms`,
                    }} />
                  ))}
                </div>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".55rem", letterSpacing:".18em", textTransform:"uppercase", color:"rgba(229,226,225,.25)" }}>
                  {tools.some((t) => t.state === "result") ? "Generating response..." : tools.length ? "Processing..." : "Thinking..."}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  // User message
  const authCode = Math.random().toString(36).slice(2, 6).toUpperCase()
  return (
    <div style={{ display:"flex", flexDirection:"column", maxWidth:"76%", marginLeft:"auto", alignItems:"flex-end", gap:5 }}>
      <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600, letterSpacing:".22em", textTransform:"uppercase", color:"rgba(255,193,116,.35)", paddingRight:4 }}>
        OPERATOR COMMAND // AUTH:{authCode}
      </p>
      <div style={{
        background:"#252423",
        borderRight:"2.5px solid rgba(160,142,122,.32)",
        borderRadius:"3px 0 0 3px",
        padding:"12px 18px",
      }}>
        <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem", color:"#E5E2E1", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
          {message.content}
        </p>
      </div>
    </div>
  )
}
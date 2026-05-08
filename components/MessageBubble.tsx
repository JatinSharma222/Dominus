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

interface ExtendedMessage extends Message {
  toolInvocations?: ToolInvocation[]
  annotations?: unknown[]
}

interface MessageBubbleProps {
  message: ExtendedMessage
  isLoading?: boolean
}

// ── Type guards ───────────────────────────────────────────────────────────────
const isSwap       = (r: unknown): r is JupiterSwapIntent       =>
  !!r && typeof r === "object" && (r as Record<string,unknown>).type === "swap_intent"
const isKamino     = (r: unknown): r is KaminoDepositIntent     =>
  !!r && typeof r === "object" && (r as Record<string,unknown>).type === "kamino_deposit_intent"
const isJito       = (r: unknown): r is JitoStakeIntent         =>
  !!r && typeof r === "object" && (r as Record<string,unknown>).type === "jito_stake_intent"
const isStreamflow = (r: unknown): r is StreamflowPaymentIntent =>
  !!r && typeof r === "object" && (r as Record<string,unknown>).type === "streamflow_payment_intent"

// ── Extract tool results from BOTH paths ─────────────────────────────────────
// Anthropic/OpenAI path: results in message.toolInvocations
// Ollama path: results streamed as 8: annotations → message.annotations
function extractAllToolResults(message: ExtendedMessage): unknown[] {
  const results: unknown[] = []

  // Path 1 — Vercel AI SDK toolInvocations (Anthropic/OpenAI)
  for (const inv of message.toolInvocations ?? []) {
    if (inv.state === "result" && inv.result !== undefined) {
      results.push(inv.result)
    }
  }

  // Path 2 — Ollama: tool results sent as 8: stream annotations
  // Format can be: { toolName, result } or the raw result directly
  for (const ann of message.annotations ?? []) {
    if (!ann || typeof ann !== "object") continue
    const a = ann as Record<string, unknown>

    // Shape: { toolName: string, result: {...intent...} }
    if (a.result && typeof a.result === "object") {
      const r = a.result as Record<string,unknown>
      if (r.type) results.push(a.result)
    }
    // Shape: the intent directly at the annotation level
    else if (a.type) {
      results.push(ann)
    }
  }

  return results
}

// ── Tool chip metadata ────────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  get_portfolio:         "Reading wallet balances",
  swap_tokens:           "Resolving swap route via Jupiter",
  deposit_for_yield:     "Loading Kamino yield rates",
  stake_sol:             "Fetching Jito staking data",
  create_payment_stream: "Setting up Streamflow payment",
}

const TOOL_ICONS: Record<string, string> = {
  get_portfolio:         "account_balance_wallet",
  swap_tokens:           "swap_horiz",
  deposit_for_yield:     "trending_up",
  stake_sol:             "bolt",
  create_payment_stream: "stream",
}

const AETHER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

// ── Shared style tokens ───────────────────────────────────────────────────────
const S = {
  // AI bubble
  aiBg: {
    background: "#111116",
    border: "1px solid rgba(255,255,255,.07)",
    borderLeft: "2px solid rgba(245,158,11,.25)",
    borderRadius: "2px 8px 8px 8px",
    boxShadow: "0 2px 12px rgba(0,0,0,.4)",
  } as React.CSSProperties,

  // User bubble
  userBg: {
    background: "#18181D",
    border: "1px solid rgba(255,255,255,.06)",
    borderRight: "2px solid rgba(255,255,255,.12)",
    borderRadius: "8px 2px 8px 8px",
    boxShadow: "0 2px 12px rgba(0,0,0,.35)",
  } as React.CSSProperties,

  // Tool chip — done
  chipDone: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 10px",
    background: "rgba(245,158,11,.06)",
    border: "1px solid rgba(245,158,11,.14)",
    borderRadius: 6,
  } as React.CSSProperties,

  // Tool chip — pending
  chipPending: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 10px",
    background: "rgba(96,165,250,.05)",
    border: "1px solid rgba(96,165,250,.12)",
    borderRadius: 6,
  } as React.CSSProperties,
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MessageBubble({ message, isLoading }: MessageBubbleProps) {
  const isAI  = message.role === "assistant"
  const time  = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false })
  const tools = message.toolInvocations ?? []

  // Extract all intent objects from both paths
  const allResults    = extractAllToolResults(message)
  const swapIntents       = allResults.filter(isSwap)
  const kaminoIntents     = allResults.filter(isKamino)
  const jitoIntents       = allResults.filter(isJito)
  const streamflowIntents = allResults.filter(isStreamflow)

  /* ── AI bubble ─────────────────────────────────────────────────────────── */
  if (isAI) {
    return (
      <div style={{
        display: "flex", gap: 10,
        maxWidth: "86%", marginRight: "auto",
        animation: "msg-in .38s cubic-bezier(.22,1,.36,1) both",
      }}>
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0, marginTop: 20,
          overflow: "hidden",
          border: "1px solid rgba(245,158,11,.2)",
          boxShadow: "0 0 8px rgba(245,158,11,.15)",
        }}>
          <img src={AETHER_AVATAR} alt="Aether"
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display="none" }} />
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Eyebrow */}
          <p style={{
            fontFamily:"'Space Grotesk',sans-serif",
            fontSize:".46rem", fontWeight:600,
            letterSpacing:".2em", textTransform:"uppercase",
            color:"rgba(245,158,11,.3)", marginBottom:6,
          }}>
            AETHER-01 // {time}
          </p>

          {/* Bubble */}
          <div style={{ ...S.aiBg, padding:"14px 18px", display:"flex", flexDirection:"column", gap:10 }}>

            {/* Tool chips */}
            {tools.map((tool, i) => {
              const done = tool.state === "result"
              const icon = TOOL_ICONS[tool.toolName] ?? "terminal"
              return (
                <div key={i} style={done ? S.chipDone : S.chipPending}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: done ? "#F59E0B" : "#60A5FA",
                    boxShadow: done ? "0 0 5px rgba(245,158,11,.7)" : "0 0 5px rgba(96,165,250,.5)",
                    display: done ? "inline-block" : "inline-block",
                    animation: done ? "none" : "blink 1.3s ease-in-out infinite",
                  }} />
                  <span style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: ".54rem", fontWeight: 600,
                    letterSpacing: ".12em", textTransform: "uppercase",
                    color: done ? "rgba(245,158,11,.75)" : "rgba(96,165,250,.65)",
                    flex: 1,
                  }}>
                    {done
                      ? `${TOOL_LABELS[tool.toolName] ?? tool.toolName} ✓`
                      : `${TOOL_LABELS[tool.toolName] ?? tool.toolName}…`}
                  </span>
                  <span style={{
                    fontFamily: "'Material Symbols Outlined'",
                    fontVariationSettings: "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
                    fontSize: 14, lineHeight: 1,
                    color: done ? "rgba(245,158,11,.35)" : "rgba(96,165,250,.3)",
                  }}>{icon}</span>
                </div>
              )
            })}

            {/* Transaction cards */}
            {swapIntents.map((intent, i) => (
              <TxConfirmCard key={`swap-${i}`} intent={intent}
                onSuccess={id => console.log("swap tx:", id)} onCancel={() => {}} />
            ))}
            {kaminoIntents.map((intent, i) => (
              <KaminoDepositCard key={`kamino-${i}`} intent={intent}
                onSuccess={id => console.log("kamino tx:", id)} onCancel={() => {}} />
            ))}
            {jitoIntents.map((intent, i) => (
              <JitoStakeCard key={`jito-${i}`} intent={intent}
                onSuccess={id => console.log("jito tx:", id)} onCancel={() => {}} />
            ))}
            {streamflowIntents.map((intent, i) => (
              <StreamflowPaymentCard key={`sf-${i}`} intent={intent}
                onSuccess={id => console.log("stream:", id)} onCancel={() => {}} />
            ))}

            {/* Message text */}
            {message.content ? (
              <p style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: ".78rem", color: "rgba(242,240,236,.82)",
                lineHeight: 1.72, whiteSpace: "pre-wrap", margin: 0,
              }}>
                {message.content}
              </p>
            ) : isLoading ? (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ display:"flex", gap:4 }}>
                  {[0, 140, 280].map(delay => (
                    <span key={delay} style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "rgba(245,158,11,.35)",
                      animation: "blink 1.4s ease-in-out infinite",
                      animationDelay: `${delay}ms`,
                      display: "inline-block",
                    }} />
                  ))}
                </div>
                <span style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: ".5rem", letterSpacing: ".16em",
                  textTransform: "uppercase", color: "rgba(242,240,236,.2)",
                }}>
                  {tools.some(t => t.state === "result") ? "Generating response…"
                    : tools.length ? "Processing…" : "Thinking…"}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  /* ── User bubble ────────────────────────────────────────────────────────── */
  const authCode = Math.random().toString(36).slice(2, 6).toUpperCase()

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      maxWidth: "68%", marginLeft: "auto",
      alignItems: "flex-end", gap: 5,
      animation: "msg-in .38s cubic-bezier(.22,1,.36,1) both",
    }}>
      <p style={{
        fontFamily: "'Space Grotesk',sans-serif",
        fontSize: ".46rem", fontWeight: 600,
        letterSpacing: ".2em", textTransform: "uppercase",
        color: "rgba(245,158,11,.25)", paddingRight: 4,
      }}>
        OPERATOR // AUTH:{authCode}
      </p>
      <div style={{ ...S.userBg, padding: "12px 16px" }}>
        <p style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: ".78rem", color: "rgba(242,240,236,.88)",
          lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0,
        }}>
          {message.content}
        </p>
      </div>
    </div>
  )
}
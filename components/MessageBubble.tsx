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

const isSwap       = (r: unknown): r is JupiterSwapIntent       => !!r && (r as Record<string,unknown>).type === "swap_intent"
const isKamino     = (r: unknown): r is KaminoDepositIntent     => !!r && (r as Record<string,unknown>).type === "kamino_deposit_intent"
const isJito       = (r: unknown): r is JitoStakeIntent         => !!r && (r as Record<string,unknown>).type === "jito_stake_intent"
const isStreamflow = (r: unknown): r is StreamflowPaymentIntent => !!r && (r as Record<string,unknown>).type === "streamflow_payment_intent"

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

/* ─── AI bubble glass style ─────────────────────────────────────────────────
   12px border radius + deep black shadow with subtle amber rim
   ──────────────────────────────────────────────────────────────────────────── */
const aiBubble: React.CSSProperties = {
  background: "linear-gradient(135deg,rgba(255,255,255,.064) 0%,rgba(255,192,60,.022) 50%,rgba(255,255,255,.040) 100%)",
  backdropFilter: "blur(24px) saturate(1.5) brightness(1.05)",
  WebkitBackdropFilter: "blur(24px) saturate(1.5) brightness(1.05)",
  border: "1px solid rgba(255,185,60,.18)",
  borderTop: "1px solid rgba(255,255,255,.12)",
  borderLeft: "1px solid rgba(255,255,255,.07)",
  /* 12px radius + layered shadows: deep black body + faint amber glow */
  borderRadius: 12,
  boxShadow: [
    "inset 0 1.5px 0 rgba(255,255,255,.08)",
    "inset 0 -1px 0 rgba(0,0,0,.16)",
    "0 4px 6px rgba(0,0,0,.55)",      // tight contact shadow
    "0 12px 32px rgba(0,0,0,.72)",    // mid depth
    "0 28px 64px rgba(0,0,0,.6)",     // far bloom
    "0 0 0 1px rgba(0,0,0,.35)",      // crisp dark outline
    "0 0 22px rgba(245,158,11,.06)",  // faint amber aura
  ].join(","),
  position: "relative" as const,
  overflow: "hidden",
}

/* ─── User bubble glass style ───────────────────────────────────────────────
   12px radius (squared on bottom-right for "sent" feel) + black shadow
   ──────────────────────────────────────────────────────────────────────────── */
const userBubble: React.CSSProperties = {
  background: "linear-gradient(135deg,rgba(255,255,255,.05) 0%,rgba(160,142,122,.022) 100%)",
  backdropFilter: "blur(20px) saturate(1.35)",
  WebkitBackdropFilter: "blur(20px) saturate(1.35)",
  border: "1px solid rgba(160,142,122,.2)",
  borderTop: "1px solid rgba(255,255,255,.08)",
  borderRight: "2.5px solid rgba(160,142,122,.32)",
  borderRadius: "12px 4px 12px 12px",   // top-right sharper = sent bubble feel
  boxShadow: [
    "inset 0 1px 0 rgba(255,255,255,.05)",
    "0 4px 8px rgba(0,0,0,.58)",
    "0 14px 36px rgba(0,0,0,.75)",
    "0 28px 60px rgba(0,0,0,.55)",
    "0 0 0 1px rgba(0,0,0,.32)",
  ].join(","),
  position: "relative" as const,
  overflow: "hidden",
}

/* ─── Tool chip styles ──────────────────────────────────────────────────────
   Slightly rounded chips, black shadow
   ──────────────────────────────────────────────────────────────────────────── */
const chipDone: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "6px 12px",
  background: "rgba(255,185,60,.085)",
  border: "1px solid rgba(255,185,60,.22)",
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,.5),0 6px 18px rgba(0,0,0,.4),0 0 0 1px rgba(0,0,0,.25)",
  transition: "background .3s,border-color .3s",
}

const chipPending: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "6px 12px",
  background: "rgba(177,207,246,.055)",
  border: "1px solid rgba(177,207,246,.14)",
  borderRadius: 8,
  boxShadow: "0 2px 8px rgba(0,0,0,.48),0 6px 18px rgba(0,0,0,.38),0 0 0 1px rgba(0,0,0,.22)",
}

export default function MessageBubble({ message, isLoading }: MessageBubbleProps) {
  const isAI  = message.role === "assistant"
  const time  = new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false })
  const tools = message.toolInvocations ?? []

  const swapIntents       = tools.filter(t => t.state === "result" && isSwap(t.result)).map(t => t.result as JupiterSwapIntent)
  const kaminoIntents     = tools.filter(t => t.state === "result" && isKamino(t.result)).map(t => t.result as KaminoDepositIntent)
  const jitoIntents       = tools.filter(t => t.state === "result" && isJito(t.result)).map(t => t.result as JitoStakeIntent)
  const streamflowIntents = tools.filter(t => t.state === "result" && isStreamflow(t.result)).map(t => t.result as StreamflowPaymentIntent)

  /* ── AI bubble ─────────────────────────────────────────────────────────── */
  if (isAI) {
    return (
      <div style={{
        display: "flex", gap: 10,
        maxWidth: "88%", marginRight: "auto",
        animation: "msg-in .42s cubic-bezier(.22,1,.36,1) both",
      }}>

        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 22,
          overflow: "hidden",
          border: "1px solid rgba(255,185,60,.28)",
          boxShadow: [
            "0 0 10px rgba(245,158,11,.38)",
            "0 4px 12px rgba(0,0,0,.7)",
            "0 0 0 1px rgba(0,0,0,.4)",
          ].join(","),
        }}>
          <img
            src={AETHER_AVATAR} alt="Aether"
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Eyebrow */}
          <p style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: ".46rem", fontWeight: 600,
            letterSpacing: ".22em", textTransform: "uppercase",
            color: "rgba(255,185,60,.32)", marginBottom: 7,
          }}>
            AETHER-01 CORE // {time}
          </p>

          {/* Bubble */}
          <div style={{ ...aiBubble, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Top shimmer bar */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1.5,
              background: "linear-gradient(90deg,transparent,rgba(255,185,60,.42),transparent)",
              borderRadius: "12px 12px 0 0",
            }} />
            {/* Left amber accent */}
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: 2.5,
              background: "linear-gradient(180deg,rgba(255,185,60,.5),rgba(255,185,60,.14),rgba(255,185,60,.5))",
              borderRadius: "12px 0 0 12px",
            }} />

            {/* Tool status chips */}
            {tools.map((tool, i) => {
              const done = tool.state === "result"
              const icon = TOOL_ICONS[tool.toolName] ?? "terminal"
              return (
                <div key={i} style={done ? chipDone : chipPending}>
                  {done ? (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#FFC060",
                      boxShadow: "0 0 6px rgba(255,185,60,.85)", flexShrink: 0,
                    }} />
                  ) : (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#B1CFF6",
                      flexShrink: 0, animation: "blink 1.4s ease-in-out infinite",
                    }} />
                  )}
                  <span style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: ".54rem", fontWeight: 600,
                    letterSpacing: ".14em", textTransform: "uppercase",
                    color: done ? "rgba(255,185,60,.82)" : "rgba(177,207,246,.7)",
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
                    color: done ? "rgba(255,185,60,.5)" : "rgba(177,207,246,.4)",
                  }}>{icon}</span>
                </div>
              )
            })}

            {/* Transaction cards */}
            {swapIntents.map((intent, i) => (
              <TxConfirmCard key={`swap-${i}`} intent={intent} onSuccess={id => console.log("swap:", id)} onCancel={() => {}} />
            ))}
            {kaminoIntents.map((intent, i) => (
              <KaminoDepositCard key={`kamino-${i}`} intent={intent} onSuccess={id => console.log("kamino:", id)} onCancel={() => {}} />
            ))}
            {jitoIntents.map((intent, i) => (
              <JitoStakeCard key={`jito-${i}`} intent={intent} onSuccess={id => console.log("jito:", id)} onCancel={() => {}} />
            ))}
            {streamflowIntents.map((intent, i) => (
              <StreamflowPaymentCard key={`sf-${i}`} intent={intent} onSuccess={id => console.log("stream:", id)} onCancel={() => {}} />
            ))}

            {/* Message text */}
            {message.content ? (
              <p style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: ".78rem", color: "rgba(220,198,178,.88)",
                lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0,
              }}>
                {message.content}
              </p>
            ) : isLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 160, 320].map(delay => (
                    <span key={delay} style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "rgba(255,185,60,.42)",
                      animation: "blink 1.4s ease-in-out infinite",
                      animationDelay: `${delay}ms`,
                      display: "inline-block",
                    }} />
                  ))}
                </div>
                <span style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: ".5rem", letterSpacing: ".18em",
                  textTransform: "uppercase", color: "rgba(229,226,225,.2)",
                }}>
                  {tools.some(t => t.state === "result") ? "Generating response…" : tools.length ? "Processing…" : "Thinking…"}
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
      maxWidth: "72%", marginLeft: "auto",
      alignItems: "flex-end", gap: 6,
      animation: "msg-in .42s cubic-bezier(.22,1,.36,1) both",
    }}>
      <p style={{
        fontFamily: "'Space Grotesk',sans-serif",
        fontSize: ".46rem", fontWeight: 600,
        letterSpacing: ".22em", textTransform: "uppercase",
        color: "rgba(255,185,60,.3)", paddingRight: 4,
      }}>
        OPERATOR COMMAND // AUTH:{authCode}
      </p>

      <div style={{ ...userBubble, padding: "13px 18px" }}>
        {/* Top shimmer */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,.09),transparent)",
          borderRadius: "12px 4px 0 0",
        }} />
        <p style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: ".78rem", color: "rgba(229,226,225,.9)",
          lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0,
        }}>
          {message.content}
        </p>
      </div>
    </div>
  )
}
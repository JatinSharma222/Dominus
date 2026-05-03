"use client"

import { useEffect, useRef } from "react"
import { Message } from "@/lib/types"
import MessageBubble from "./MessageBubble"

interface ToolInvocation {
  toolName: string
  state: "call" | "result" | "partial-call"
  result?: unknown
}

interface ExtendedMessage extends Message {
  toolInvocations?: ToolInvocation[]
}

interface ChatWindowProps {
  messages: ExtendedMessage[]
  isLoading: boolean
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28, padding:"0 32px", position:"relative", overflow:"hidden" }}>

        {/* Ambient glow */}
        <div style={{
          position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          width:380, height:380, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(245,158,11,0.05) 0%,transparent 70%)",
          filter:"blur(40px)", pointerEvents:"none",
        }} />

        <div style={{ textAlign:"center", position:"relative" }}>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".58rem", fontWeight:600, letterSpacing:".38em", textTransform:"uppercase", color:"#FFC174", marginBottom:12 }}>
            SYSTEM STATUS: ONLINE
          </p>
          <h2 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, letterSpacing:"-.02em", color:"#E5E2E1", fontSize:"clamp(1.8rem,3.5vw,2.5rem)", lineHeight:.95, marginBottom:14 }}>
            Oracle Command
          </h2>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem", color:"rgba(229,226,225,.35)", lineHeight:1.6, maxWidth:320, margin:"0 auto" }}>
            Describe what you want to do with your crypto in plain English. Aether-01 handles the rest.
          </p>
        </div>

        {/* Example prompts */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", maxWidth:380 }}>
          {[
            "What's my portfolio worth?",
            "Swap 0.5 SOL to USDC",
            "Stake my idle SOL for yield",
            "Send $20 USDC to a friend every week",
          ].map((prompt) => (
            <div key={prompt} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"10px 16px",
              background:"rgba(28,27,27,0.7)",
              border:"1px solid rgba(83,68,52,0.22)",
              borderRadius:2,
            }}>
              <span style={{ color:"rgba(255,193,116,0.3)", fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem", flexShrink:0 }}>›</span>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", letterSpacing:".14em", textTransform:"uppercase", color:"rgba(229,226,225,.3)" }}>
                {prompt}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 32px", display:"flex", flexDirection:"column", gap:20 }}>
      {messages.map((message, i) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLoading={isLoading && i === messages.length - 1}
        />
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <MessageBubble
          message={{ id: "thinking", role: "assistant", content: "" }}
          isLoading={true}
        />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
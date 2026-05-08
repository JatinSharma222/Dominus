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
  annotations?: unknown[]
}

interface ChatWindowProps {
  messages: ExtendedMessage[]
  isLoading: boolean
  onPromptSelect?: (p: string) => void
}

const QUICK_PROMPTS = [
  "What's my portfolio worth?",
  "Swap 0.5 SOL to USDC",
  "Stake my idle SOL for yield",
  "Send 20 USDC weekly to a friend",
]

export default function ChatWindow({ messages, isLoading, onPromptSelect }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:"0 32px" }}>
        <div style={{ textAlign:"center" }}>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:600, letterSpacing:".28em", textTransform:"uppercase", color:"rgba(245,158,11,.5)", marginBottom:10 }}>
            AETHER-01 READY
          </p>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem", color:"#6B6A72", lineHeight:1.7, maxWidth:320, margin:"0 auto" }}>
            Describe what you want to do with your crypto in plain English.
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, width:"100%", maxWidth:440 }}>
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => onPromptSelect?.(p)}
              style={{ padding:"10px 14px", background:"#111116", border:"1px solid rgba(255,255,255,.07)", borderRadius:6, textAlign:"left", cursor:"pointer", transition:"border-color .15s, background .15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor="rgba(245,158,11,.22)"; (e.currentTarget as HTMLButtonElement).style.background="#18181D" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor="rgba(255,255,255,.07)"; (e.currentTarget as HTMLButtonElement).style.background="#111116" }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", color:"#6B6A72", lineHeight:1.5, margin:0 }}>{p}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 28px", display:"flex", flexDirection:"column", gap:16 }}>
      {messages.map((msg, i) => (
        <MessageBubble key={msg.id} message={msg} isLoading={isLoading && i === messages.length - 1} />
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <MessageBubble message={{ id:"thinking", role:"assistant", content:"" }} isLoading={true} />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
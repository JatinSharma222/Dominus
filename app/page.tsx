"use client"

import { useChat } from "ai/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useState, useRef, useEffect } from "react"
import ChatWindow from "@/components/ChatWindow"
import { Message } from "@/lib/types"
import { shortenAddress } from "@/lib/solana"

export default function Home() {
  const { publicKey, disconnect, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
    body: {
      walletAddress: publicKey?.toString(),
    },
  })

  // Cast to our Message type
const typedMessages = messages.map((m) => {
  let content = ""
  if (typeof m.content === "string") {
    content = m.content
  } else if (Array.isArray(m.content)) {
    content = (m.content as { type: string; text?: string }[])
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("")
  }

  if (!content && m.toolInvocations?.length) {
    const results = m.toolInvocations
      .filter((t) => t.state === "result")
      .map((t) => {
        const r = t.result as Record<string, unknown>
        return r?.summary as string || JSON.stringify(t.result, null, 2)
      })
      .join("\n")
    content = results || ""
  }
console.log("last msg:", JSON.stringify(messages[messages.length-1], null, 2))
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content,
    toolInvocations: m.toolInvocations as {
      toolName: string
      state: "call" | "result" | "partial-call"
      result?: unknown
    }[],
  }
})

  // Auto-resize textarea as user types
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [input])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput("")
    await append({ role: "user", content: trimmed })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSuggestion(prompt: string) {
    if (isLoading) return
    await append({ role: "user", content: prompt })
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── Top Nav ── */}
      <nav className="h-16 flex items-center justify-between px-8 bg-neutral-950/40 backdrop-blur-xl border-b border-white/10 shrink-0">
        {/* Brand */}
        <span className="font-headline text-2xl font-bold tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
          DOMINUS
        </span>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {connected && publicKey ? (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg font-label text-[10px] text-primary tracking-widest uppercase hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm mr-2 align-middle">
                account_balance_wallet
              </span>
              {shortenAddress(publicKey.toString())}
            </button>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold tracking-[0.2em] text-xs uppercase rounded shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              CONNECT WALLET
            </button>
          )}
        </div>
      </nav>

      {/* ── Chat Area ── */}
      <ChatWindow messages={typedMessages} isLoading={isLoading} />

      {/* ── Suggestion Chips (show only when no messages) ── */}
      {messages.length === 0 && (
        <div className="flex gap-2 px-6 pb-3 flex-wrap justify-center shrink-0">
          {[
            "Swap SOL → USDC",
            "Check Portfolio",
            "Stake SOL",
            "Best Yield Now",
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => handleSuggestion(chip)}
              className="px-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-full font-label text-xs text-neutral-400 hover:text-primary hover:border-primary/30 hover:bg-surface-container-high tracking-widest uppercase transition-all"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="px-6 pb-6 pt-2 shrink-0">
        <div className="relative flex items-end gap-3 bg-surface-container-lowest rounded-lg px-4 py-3 focus-within:shadow-[0_0_0_1px_rgba(255,193,116,0.3)] transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to do with your crypto..."
            rows={1}
            className="flex-1 bg-transparent font-body text-sm text-on-surface placeholder:text-neutral-600 resize-none outline-none leading-relaxed max-h-40 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-r from-primary to-primary-container rounded text-on-primary disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
        <p className="text-center font-label text-[9px] text-neutral-600 tracking-widest uppercase mt-2">
          DOMINUS NEVER EXECUTES WITHOUT YOUR CONFIRMATION
        </p>
      </div>

      {/* ── Bottom Status Bar ── */}
      <div className="h-10 flex items-center justify-between px-8 bg-neutral-950/80 backdrop-blur-md border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-label text-[9px] text-neutral-400 tracking-[0.2em] uppercase">
            {connected ? "Wallet Connected" : "Core Prime Online"}
          </span>
        </div>
        <span className="font-label text-[9px] text-neutral-600 tracking-[0.2em] uppercase">
          v1.0.0 — DEVNET
        </span>
      </div>

    </div>
  )
}
"use client"

import { useEffect, useRef } from "react"
import { Message } from "@/lib/types"
import MessageBubble from "./MessageBubble"

interface ChatWindowProps {
  messages: Message[]
  isLoading: boolean
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on every new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        {/* Atmospheric orb */}
        <div className="absolute w-[400px] h-[400px] bg-primary-container/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Empty state */}
        <div className="relative text-center space-y-3">
          <p className="font-label text-[10px] text-primary tracking-[0.4em] uppercase">
            SYSTEM STATUS: ONLINE
          </p>
          <h2 className="font-headline text-4xl text-on-surface tracking-tighter">
            Oracle Command
          </h2>
          <p className="font-body text-sm text-on-surface/50 max-w-sm">
            Describe what you want to do with your crypto in plain English.
            Dominus handles the rest.
          </p>
        </div>

        {/* Example prompts */}
        <div className="relative flex flex-col gap-2 mt-4 w-full max-w-md">
          {[
            "What's my portfolio worth?",
            "Swap 0.5 SOL to USDC",
            "Stake my idle SOL for yield",
            "Send $20 USDC to a friend every week",
          ].map((prompt) => (
            <div
              key={prompt}
              className="px-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg"
            >
              <p className="font-label text-xs text-neutral-400 tracking-widest uppercase">
                {prompt}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Show thinking dots when AI is loading but no streaming content yet */}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <MessageBubble
          message={{
            id: "thinking",
            role: "assistant",
            content: "",
          }}
        />
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
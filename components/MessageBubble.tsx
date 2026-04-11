import { Message } from "@/lib/types"

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isAI = message.role === "assistant"
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  if (isAI) {
    return (
      <div className="flex flex-col gap-1 max-w-[80%] mr-auto">
        {/* Eyebrow */}
        <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase pl-6">
          AETHER-01 CORE // {time}
        </span>

        {/* Bubble */}
        <div className="bg-surface-container-low border-l-4 border-primary/40 p-4 pl-6 rounded-lg">
          {message.content ? (
            <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            /* Thinking / streaming state — three pulsing dots */
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.4s]" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // User message
  const authCode = Math.random().toString(36).slice(2, 6).toUpperCase()

  return (
    <div className="flex flex-col gap-1 max-w-[80%] ml-auto items-end">
      {/* Eyebrow */}
      <span className="font-label text-[10px] text-primary/60 tracking-widest uppercase pr-6">
        OPERATOR COMMAND // AUTH:{authCode}
      </span>

      {/* Bubble */}
      <div className="bg-surface-container-high border-r-4 border-outline/40 p-4 pr-6 rounded-lg">
        <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  )
}
import { Message } from "@/lib/types"

interface ToolInvocation {
  toolName: string
  state: "call" | "result" | "partial-call"
  result?: unknown
}

interface MessageBubbleProps {
  message: Message & { toolInvocations?: ToolInvocation[] }
  isLoading?: boolean
}

export default function MessageBubble({ message, isLoading }: MessageBubbleProps) {
  const isAI = message.role === "assistant"
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const toolLabels: Record<string, string> = {
    get_portfolio: "Reading wallet balances via Helius...",
    swap_tokens: "Fetching best swap route via Jupiter...",
    deposit_for_yield: "Checking Kamino yield rates...",
    stake_sol: "Fetching Jito staking data...",
    create_payment_stream: "Setting up Streamflow payment...",
  }

  if (isAI) {
    return (
      <div className="flex flex-col gap-1 max-w-[80%] mr-auto">
        <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase pl-6">
          AETHER-01 CORE // {time}
        </span>

        <div className="bg-surface-container-low border-l-4 border-primary/40 p-4 pl-6 rounded-lg space-y-3">

          {/* Tool invocation states */}
          {message.toolInvocations?.map((tool, i) => (
            <div key={i} className="flex items-center gap-3">
              {tool.state === "call" || tool.state === "partial-call" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse shrink-0" />
                  <span className="font-label text-[10px] text-tertiary tracking-widest uppercase">
                    {toolLabels[tool.toolName] ?? `Calling ${tool.toolName}...`}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="font-label text-[10px] text-primary tracking-widest uppercase">
                    {toolLabels[tool.toolName]?.replace("...", " ✓") ?? `${tool.toolName} complete`}
                  </span>
                </>
              )}
            </div>
          ))}

          {/* Main content */}
          {message.content ? (
            <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : isLoading ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.4s]" />
              </div>
              <span className="font-label text-[10px] text-neutral-500 tracking-widest uppercase animate-pulse">
                {message.toolInvocations?.some(t => t.state === "result")
                  ? "Generating response..."
                  : message.toolInvocations?.length
                  ? "Processing..."
                  : "Thinking..."}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const authCode = Math.random().toString(36).slice(2, 6).toUpperCase()

  return (
    <div className="flex flex-col gap-1 max-w-[80%] ml-auto items-end">
      <span className="font-label text-[10px] text-primary/60 tracking-widest uppercase pr-6">
        OPERATOR COMMAND // AUTH:{authCode}
      </span>
      <div className="bg-surface-container-high border-r-4 border-outline/40 p-4 pr-6 rounded-lg">
        <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  )
}
export type TxPreview = {
  type: "tx_preview"
  action: "swap" | "deposit" | "stake" | "stream"
  protocol: "Jupiter" | "Kamino" | "Jito" | "Streamflow"
  fromToken?: string
  toToken?: string
  inputAmount?: number
  outputAmount?: number
  fee?: number
  apy?: number
  priceImpact?: string
  route?: unknown
  quoteResponse?: unknown
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  txPreview?: TxPreview
}

export type LLMProvider = "ollama" | "anthropic" | "openai"

export type WalletStatus = "disconnected" | "connecting" | "connected"
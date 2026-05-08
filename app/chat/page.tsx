"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useChat } from "ai/react"
import { loadLLMConfig, LLMSettingsConfig } from "@/components/LLMSettings"
import LLMSettings from "@/components/LLMSettings"
import MessageBubble from "@/components/MessageBubble"
import RightPanel from "@/components/RightPanel"
import { useRouter } from "next/navigation"

const AETHER_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortenAddress(addr: string, chars = 4) {
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const NAV_H   = 56
const SIDEBAR = 220
const BAR_H   = 36

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { connected, publicKey, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const router = useRouter()

  const [mounted,      setMounted]      = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [llmConfig,    setLLMConfig]    = useState<LLMSettingsConfig | null>(null)
  const [input,        setInput]        = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true); setLLMConfig(loadLLMConfig()) }, [])

  const walletAddr = publicKey?.toString() ?? ""

  // Build llmOverride for the API body
  const llmOverride = llmConfig
    ? llmConfig.mode === "ollama"
      ? { provider: "ollama" as const, baseUrl: llmConfig.ollamaBaseUrl, model: llmConfig.ollamaModel }
      : { provider: llmConfig.provider as "anthropic" | "openai", apiKey: llmConfig.apiKey, model: llmConfig.model }
    : undefined

  const { messages, append, isLoading, setMessages } = useChat({
    api: "/api/chat",
    body: { walletAddress: walletAddr, llmOverride },
    id: "dominus-chat",
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput("")

    if (!connected || !publicKey) {
      setMessages(prev => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: text },
        { id: `a-${Date.now()}`, role: "assistant", content: "Please connect your wallet first to use Dominus. Click **CONNECT WALLET** in the top nav." },
      ])
      return
    }
    await append({ role: "user", content: text })
  }, [input, isLoading, connected, publicKey, append, setMessages])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!mounted) return null

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "MAINNET" : "DEVNET"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #09090B; color: #F2F0EC; }
        body { font-family: 'Space Grotesk', sans-serif; -webkit-font-smoothing: antialiased; }
        .ms { font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24; line-height: 1; user-select: none; display: inline-block; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #09090B; }
        ::-webkit-scrollbar-thumb { background: #27272E; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #F59E0B; }
        ::selection { background: rgba(245,158,11,.18); }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.15} }
        @keyframes msg-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{transform:scale(1)} 50%{transform:scale(.7)} }
        .wallet-adapter-dropdown,.wallet-adapter-button-trigger,[class*="wallet-adapter-dropdown"]{display:none!important}
        .wallet-adapter-modal-wrapper{background:#111116!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:8px!important}
        .wallet-adapter-modal-title{color:#F2F0EC!important;font-family:'Noto Serif',serif!important}
        .wallet-adapter-modal-list li>button,.wallet-adapter-button{background:#18181D!important;border:1px solid rgba(255,255,255,.07)!important;color:#F2F0EC!important;font-family:'Space Grotesk',sans-serif!important;transition:background .15s!important}
        .wallet-adapter-modal-list li>button:hover,.wallet-adapter-button:hover{background:#1F1F25!important;border-color:rgba(245,158,11,.2)!important}
        .nav-item { display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:6px;cursor:pointer;transition:background .15s,color .15s;text-decoration:none;width:100%;border:none;background:none; }
        .nav-item:hover { background:rgba(255,255,255,.04);color:#F2F0EC; }
        .nav-item.active { background:rgba(245,158,11,.08);color:#F59E0B; }
        .nav-item.active .nav-icon { color:#F59E0B; }
        .send-btn:hover { background:rgba(245,158,11,.12)!important; }
        textarea::placeholder { color:#3F3F46; }
        textarea { resize:none; outline:none; background:transparent; border:none; width:100%; color:#F2F0EC; font-family:'Space Grotesk',sans-serif; font-size:.8rem; line-height:1.6; }
      `}</style>

      <div style={{ position:"fixed", inset:0, background:"#09090B", display:"flex", flexDirection:"column" }}>

        {/* ══ TOP NAV ════════════════════════════════════════════ */}
        <nav style={{
          height: NAV_H, flexShrink:0,
          background: "#0C0C0F",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", zIndex: 50,
        }}>
          {/* Left — brand */}
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <button
              onClick={() => router.push("/")}
              style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:0 }}
            >
              <div style={{ width:24, height:24, borderRadius:6, overflow:"hidden", border:"1px solid rgba(245,158,11,.25)" }}>
                <img src={AETHER_IMG} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display="none" }} />
              </div>
              <span style={{ fontFamily:"'Noto Serif',serif", fontWeight:700, fontSize:"1rem", letterSpacing:"-.01em",
                color:"#F59E0B", textShadow:"0 0 20px rgba(245,158,11,.4)" }}>DOMINUS</span>
            </button>

            {/* Page badge */}
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 10px",
              background:"rgba(245,158,11,.07)", border:"1px solid rgba(245,158,11,.15)", borderRadius:4 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#F59E0B",
                boxShadow:"0 0 6px rgba(245,158,11,.8)", display:"inline-block", animation:"blink 2.5s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", fontWeight:600,
                letterSpacing:".22em", textTransform:"uppercase", color:"rgba(245,158,11,.7)" }}>ORACLE COMMAND</span>
            </div>
          </div>

          {/* Right — controls */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={() => setSettingsOpen(true)} style={{ width:32, height:32, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
              background:"none", border:"1px solid rgba(255,255,255,.06)", cursor:"pointer", color:"#6B6A72",
              transition:"all .15s" }}
              onMouseEnter={e=>(e.currentTarget.style.color="#F2F0EC")}
              onMouseLeave={e=>(e.currentTarget.style.color="#6B6A72")}>
              <span className="ms" style={{ fontSize:16 }}>settings</span>
            </button>

            {connected && publicKey ? (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px",
                background:"rgba(245,158,11,.07)", border:"1px solid rgba(245,158,11,.18)", borderRadius:6,
                cursor:"pointer" }}
                onClick={() => setVisible(true)}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#F59E0B",
                  boxShadow:"0 0 6px rgba(245,158,11,.8)" }} />
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:500,
                  letterSpacing:".06em", color:"rgba(245,158,11,.8)" }}>{shortenAddress(publicKey.toString())}</span>
              </div>
            ) : (
              <button
                onClick={() => setVisible(true)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
                  background:"linear-gradient(135deg,#FCD34D 0%,#F59E0B 55%,#D97706 100%)",
                  border:"none", borderRadius:6, cursor:"pointer",
                  fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", fontWeight:700,
                  letterSpacing:".16em", textTransform:"uppercase", color:"#1C0A00",
                  boxShadow:"0 0 20px rgba(245,158,11,.3), 0 2px 8px rgba(0,0,0,.4)",
                  transition:"transform .15s, box-shadow .15s" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(1.03)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 28px rgba(245,158,11,.5), 0 4px 12px rgba(0,0,0,.5)"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="none";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 20px rgba(245,158,11,.3), 0 2px 8px rgba(0,0,0,.4)"}}>
                <span className="ms" style={{ fontSize:14 }}>account_balance_wallet</span>
                CONNECT
              </button>
            )}
          </div>
        </nav>

        {/* ══ BODY ══════════════════════════════════════════════ */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── SIDEBAR ─────────────────────────────────────── */}
          <aside style={{
            width: SIDEBAR, flexShrink:0,
            background: "#0C0C0F",
            borderRight: "1px solid rgba(255,255,255,.06)",
            display: "flex", flexDirection: "column",
            padding: "16px 12px",
            overflowY: "auto",
          }}>
            {/* Agent identity */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 10px 14px",
              borderBottom:"1px solid rgba(255,255,255,.05)", marginBottom:12 }}>
              <div style={{ width:32, height:32, borderRadius:8, overflow:"hidden", flexShrink:0,
                border:"1px solid rgba(245,158,11,.2)", boxShadow:"0 0 10px rgba(245,158,11,.15)" }}>
                <img src={AETHER_IMG} alt="Aether" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display="none" }} />
              </div>
              <div>
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".7rem", fontWeight:700,
                  letterSpacing:".08em", color:"#F59E0B", margin:0 }}>AETHER-01</p>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"#22C55E",
                    boxShadow:"0 0 5px rgba(34,197,94,.7)", display:"inline-block", animation:"blink 2.8s ease-in-out infinite" }} />
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:500,
                    letterSpacing:".14em", textTransform:"uppercase", color:"rgba(34,197,94,.6)" }}>ONLINE · SOLANA</span>
                </div>
              </div>
            </div>

            {/* Initiate scan CTA */}
            <button
              onClick={() => append({ role:"user", content:"What's my portfolio worth?" })}
              style={{ width:"100%", padding:"9px 12px", marginBottom:16,
                background:"rgba(245,158,11,.07)", border:"1px solid rgba(245,158,11,.18)", borderRadius:6,
                display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:600,
                letterSpacing:".16em", textTransform:"uppercase", color:"rgba(245,158,11,.8)", cursor:"pointer",
                transition:"background .15s, border-color .15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(245,158,11,.12)";(e.currentTarget as HTMLButtonElement).style.borderColor="rgba(245,158,11,.3)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(245,158,11,.07)";(e.currentTarget as HTMLButtonElement).style.borderColor="rgba(245,158,11,.18)"}}>
              <span className="ms" style={{ fontSize:15, color:"rgba(245,158,11,.7)" }}>radar</span>
              INITIATE SCAN
            </button>

            {/* Nav — ONLY Neural Link (the one working page) */}
            <nav style={{ display:"flex", flexDirection:"column", gap:2, flex:1 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
                letterSpacing:".24em", textTransform:"uppercase", color:"#3F3F46", padding:"0 12px", marginBottom:6 }}>
                INTERFACE
              </p>
              <button className="nav-item active" style={{ color:"#F59E0B" }}>
                <span className="ms nav-icon" style={{ fontSize:18, color:"inherit" }}>psychology</span>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".68rem", fontWeight:600,
                  letterSpacing:".08em", textTransform:"uppercase" }}>Neural Link</span>
              </button>
            </nav>

            {/* Footer */}
            <div style={{ borderTop:"1px solid rgba(255,255,255,.05)", paddingTop:12, display:"flex", flexDirection:"column", gap:2 }}>
              <button className="nav-item" style={{ color:"#6B6A72" }}
                onClick={() => setSettingsOpen(true)}>
                <span className="ms" style={{ fontSize:18 }}>terminal</span>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".68rem", fontWeight:500, letterSpacing:".06em", textTransform:"uppercase" }}>Diagnostics</span>
              </button>
              {connected && (
                <button className="nav-item" style={{ color:"#6B6A72" }}
                  onClick={() => disconnect()}
                  onMouseEnter={e=>(e.currentTarget.style.color="#F87171")}
                  onMouseLeave={e=>(e.currentTarget.style.color="#6B6A72")}>
                  <span className="ms" style={{ fontSize:18 }}>power_settings_new</span>
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".68rem", fontWeight:500, letterSpacing:".06em", textTransform:"uppercase" }}>Disconnect</span>
                </button>
              )}
            </div>
          </aside>

          {/* ── MAIN CHAT AREA ───────────────────────────────── */}
          <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

            {/* Page header */}
            <div style={{ padding:"20px 28px 0", flexShrink:0 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:600,
                letterSpacing:".32em", textTransform:"uppercase", color:"rgba(245,158,11,.5)", marginBottom:6 }}>
                PHASE 04 // DEPLOYMENT
              </p>
              <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
                <h1 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, fontSize:"2.6rem",
                  letterSpacing:"-.02em", color:"#F2F0EC", lineHeight:1 }}>Oracle</h1>
                <h1 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, fontSize:"2.6rem",
                  letterSpacing:"-.02em",
                  background:"linear-gradient(135deg,#FCD34D,#F59E0B)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                  lineHeight:1 }}>Command</h1>
              </div>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".72rem", color:"#6B6A72",
                marginTop:6, lineHeight:1.5 }}>
                {connected && publicKey
                  ? `Agent active · ${shortenAddress(publicKey.toString(), 6)} connected`
                  : "Connect wallet to execute transactions"}
              </p>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"20px 28px", display:"flex", flexDirection:"column", gap:16 }}>
              {messages.length === 0 && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  gap:24, paddingTop:40 }}>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:600,
                      letterSpacing:".28em", textTransform:"uppercase", color:"rgba(245,158,11,.5)", marginBottom:10 }}>
                      AETHER-01 READY
                    </p>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem", color:"#6B6A72",
                      lineHeight:1.7, maxWidth:340, margin:"0 auto" }}>
                      Describe what you want to do with your crypto in plain English.
                    </p>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, width:"100%", maxWidth:440 }}>
                    {[
                      "What's my portfolio worth?",
                      "Swap 0.5 SOL to USDC",
                      "Stake my idle SOL for yield",
                      "Send 20 USDC weekly to a friend",
                    ].map(p => (
                      <button key={p}
                        onClick={() => { setInput(p) }}
                        style={{ padding:"10px 14px", background:"#111116", border:"1px solid rgba(255,255,255,.07)",
                          borderRadius:6, textAlign:"left", cursor:"pointer", transition:"border-color .15s, background .15s" }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="rgba(245,158,11,.2)";(e.currentTarget as HTMLButtonElement).style.background="#18181D"}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="rgba(255,255,255,.07)";(e.currentTarget as HTMLButtonElement).style.background="#111116"}}>
                        <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", color:"#6B6A72",
                          lineHeight:1.5, margin:0 }}>{p}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  // @ts-expect-error extended message type
                  message={msg}
                  isLoading={isLoading && i === messages.length - 1}
                />
              ))}

              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <MessageBubble
                  message={{ id:"thinking", role:"assistant", content:"" }}
                  isLoading={true}
                />
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ── INPUT ── */}
            <div style={{ padding:"12px 28px 16px", flexShrink:0 }}>
              <div style={{
                background: "#111116",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 8,
                transition: "border-color .15s",
              }}
                onFocus={() => {}}
                onBlur={() => {}}>
                <div style={{ padding:"14px 16px 10px" }}>
                  <textarea
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Describe what you want to do with your crypto…"
                    style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".8rem",
                      color:"#F2F0EC", background:"transparent", border:"none", outline:"none",
                      width:"100%", resize:"none", lineHeight:1.6, minHeight:22,
                      maxHeight:120, overflowY:"auto" }}
                    onInput={e => {
                      const el = e.currentTarget
                      el.style.height = "auto"
                      el.style.height = Math.min(el.scrollHeight, 120) + "px"
                    }}
                  />
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"8px 12px 12px" }}>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:500,
                    letterSpacing:".12em", textTransform:"uppercase", color:"#3F3F46" }}>
                    DOMINUS NEVER EXECUTES WITHOUT YOUR EXPLICIT CONFIRMATION
                  </p>
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    style={{ width:32, height:32, borderRadius:6,
                      background: input.trim() && !isLoading ? "rgba(245,158,11,.1)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${input.trim() && !isLoading ? "rgba(245,158,11,.25)" : "rgba(255,255,255,.06)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                      transition:"all .15s", flexShrink:0 }}>
                    {isLoading ? (
                      <span style={{ width:12, height:12, border:"1.5px solid rgba(245,158,11,.3)",
                        borderTop:"1.5px solid rgba(245,158,11,.8)", borderRadius:"50%",
                        display:"inline-block", animation:"spin .8s linear infinite" }} />
                    ) : (
                      <span className="ms" style={{ fontSize:16,
                        color: input.trim() ? "rgba(245,158,11,.8)" : "#3F3F46" }}>send</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </main>

          {/* ── RIGHT PANEL ─────────────────────────────────── */}
          <aside style={{
            width: 256, flexShrink:0,
            background: "#0C0C0F",
            borderLeft: "1px solid rgba(255,255,255,.06)",
            overflow: "hidden",
          }}>
            <RightPanel walletAddress={walletAddr} />
          </aside>
        </div>

        {/* ══ STATUS BAR ════════════════════════════════════════ */}
        <div style={{
          height: BAR_H, flexShrink:0,
          background: "#0C0C0F",
          borderTop: "1px solid rgba(255,255,255,.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", zIndex: 50,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#F59E0B",
                boxShadow:"0 0 6px rgba(245,158,11,.8)", display:"inline-block",
                animation:"blink 2.5s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:500,
                letterSpacing:".18em", textTransform:"uppercase", color:"#6B6A72" }}>CORE PRIME CONNECTED</span>
            </div>
            <div style={{ width:1, height:10, background:"rgba(255,255,255,.06)" }} />
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:500,
              letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>
              LLAMA3.1:8B
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:500,
              letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>{network}</span>
            <div style={{ width:1, height:10, background:"rgba(255,255,255,.06)" }} />
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:500,
              letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46" }}>V2.4.9-SECURE</span>
          </div>
        </div>
      </div>

      {/* LLM Settings panel */}
      <LLMSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={cfg => { setLLMConfig(cfg); setSettingsOpen(false) }}
      />
    </>
  )
}
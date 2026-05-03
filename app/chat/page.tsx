"use client"

import { useChat } from "ai/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useState, useRef, useEffect, useCallback } from "react"
import ChatWindow from "@/components/ChatWindow"
import LLMSettings, { LLMSettingsConfig, loadLLMConfig } from "@/components/LLMSettings"
import { shortenAddress } from "@/lib/solana"

const AETHER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

// Only nav items that have real routes
const NAV_ITEMS = [
  { icon: "psychology",  label: "Neural Link",  href: "/chat",  active: true  },
]

const NEURAL_METRICS = [
  { label: "Sync Ratio",  value: "94.2%",  pct: 94 },
  { label: "Latency",     value: "0.02ms", pct: 99 },
  { label: "Accuracy",    value: "98.7%",  pct: 99 },
  { label: "Throughput",  value: "4,891",  pct: 74 },
]

const PROTOCOL_LOG = [
  { time: "14:23", desc: "Jupiter route optimised via 3-hop path" },
  { time: "14:19", desc: "Kamino APY updated — USDC at 5.8%" },
  { time: "14:15", desc: "Jito MEV bundle captured +0.003 SOL" },
  { time: "14:08", desc: "Streamflow disbursement #4421 complete" },
  { time: "14:01", desc: "Portfolio snapshot — $4,218 total" },
]

const CHIPS = ["Swap SOL → USDC", "Check Portfolio", "Stake SOL", "Best Yield Now"]

export default function ChatPage() {
  const { publicKey, disconnect, connected } = useWallet()
  const { setVisible }                       = useWalletModal()
  const [input, setInput]                    = useState("")
  const [isSettingsOpen, setIsSettingsOpen]  = useState(false)
  const [llmConfig, setLLMConfig]            = useState<LLMSettingsConfig | null>(null)
  const [avatarErr, setAvatarErr]            = useState(false)
  const [clock, setClock]                    = useState("")
  const inputRef                             = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setLLMConfig(loadLLMConfig()) }, [])

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  const chatBody = {
    walletAddress: publicKey?.toString(),
    ...(llmConfig && {
      llmOverride: llmConfig.mode === "ollama"
        ? { provider: "ollama" as const, baseUrl: llmConfig.ollamaBaseUrl, model: llmConfig.ollamaModel }
        : { provider: llmConfig.provider, apiKey: llmConfig.apiKey, model: llmConfig.model || undefined },
    }),
  }

  const { messages, append, isLoading, setMessages } = useChat({ api: "/api/chat", body: chatBody })

  const typedMessages = messages.map((m) => {
    let content = ""
    if (typeof m.content === "string") content = m.content
    else if (Array.isArray(m.content))
      content = (m.content as { type: string; text?: string }[]).filter((p) => p.type === "text" && p.text).map((p) => p.text).join("")
    let toolInvocations: { toolName: string; state: "call" | "result" | "partial-call"; result?: unknown }[] | undefined
      = m.toolInvocations as typeof toolInvocations
    if (!toolInvocations?.length && m.annotations?.length) {
      const ann = (m.annotations as unknown[]).filter((a): a is { toolName: string; result: unknown } =>
        typeof a === "object" && a !== null && "toolName" in a)
      if (ann.length) toolInvocations = ann.map((a) => ({ toolName: a.toolName, state: "result" as const, result: a.result }))
    }
    return { id: m.id, role: m.role as "user" | "assistant", content, toolInvocations }
  })

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [input])

  const showWalletWarning = useCallback((text: string) => {
    setMessages([...messages,
      { id: `local-${Date.now()}-u`, role: "user",      content: text },
      { id: `local-${Date.now()}-a`, role: "assistant", content: "Please connect your wallet first — click CONNECT WALLET in the top bar." },
    ])
  }, [messages, setMessages])

  async function handleSend() {
    const t = input.trim(); if (!t || isLoading) return
    setInput("")
    if (!connected || !publicKey) { showWalletWarning(t); return }
    await append({ role: "user", content: t })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function handleChip(prompt: string) {
    if (isLoading) return
    if (!connected || !publicKey) { showWalletWarning(prompt); return }
    await append({ role: "user", content: prompt })
  }

  const llmLabel = llmConfig?.mode === "api"
    ? (llmConfig.provider === "anthropic" ? `ANTHROPIC — ${llmConfig.model || "DEFAULT"}` : `OPENAI — ${llmConfig.model || "DEFAULT"}`)
    : `OLLAMA — ${llmConfig?.ollamaModel ?? "llama3.1:8b"}`

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "MAINNET" : "DEVNET"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;background:#0E0E0E}

        .msym{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;line-height:1;font-family:'Material Symbols Outlined';display:inline-block}

        .hud-grid{
          background-size:32px 32px;
          background-image:
            linear-gradient(to right,rgba(160,142,122,0.055) 1px,transparent 1px),
            linear-gradient(to bottom,rgba(160,142,122,0.055) 1px,transparent 1px);
        }

        @keyframes blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
        @keyframes scan{0%{top:-4px}100%{top:calc(100vh + 4px)}}
        @keyframes bar-fill{from{width:0}to{width:var(--w)}}
        @keyframes fade-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}

        /* Scrollbar */
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#0E0E0E}
        ::-webkit-scrollbar-thumb{background:#534434;border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:#FFC174}
        ::selection{background:rgba(255,193,116,0.22)}

        .nav-link{
          font-family:'Space Grotesk',sans-serif;font-size:.65rem;font-weight:700;
          letter-spacing:.18em;text-transform:uppercase;
          color:rgba(229,226,225,.42);text-decoration:none;
          padding-bottom:3px;border-bottom:1.5px solid transparent;
          transition:color .2s,border-color .2s;
        }
        .nav-link.active{color:#F59E0B;border-bottom-color:#F59E0B}
        .nav-link:hover:not(.active){color:rgba(229,226,225,.75)}

        .sidebar-nav-item{
          display:flex;align-items:center;gap:14px;
          padding:11px 24px;
          font-family:'Space Grotesk',sans-serif;font-size:.65rem;font-weight:700;
          letter-spacing:.18em;text-transform:uppercase;
          text-decoration:none;transition:all .18s;
          border-left:3px solid transparent;
          color:rgba(229,226,225,.3);
        }
        .sidebar-nav-item.active{
          color:#F59E0B;
          background:rgba(245,158,11,.07);
          border-left-color:#F59E0B;
        }
        .sidebar-nav-item:hover:not(.active){
          color:rgba(229,226,225,.65);
          background:rgba(255,255,255,.03);
        }

        .chip{
          font-family:'Space Grotesk',sans-serif;font-size:.6rem;font-weight:600;
          letter-spacing:.16em;text-transform:uppercase;
          color:rgba(229,226,225,.38);
          background:#1C1B1B;
          border:1px solid rgba(83,68,52,.35);
          border-radius:2px;padding:7px 14px;cursor:pointer;
          transition:all .18s;
        }
        .chip:hover{color:#FFC174;background:#252423;border-color:rgba(255,193,116,.28)}

        .send-btn{
          width:38px;height:38px;border-radius:2px;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,#FFC174,#F59E0B);
          color:#472A00;
          box-shadow:0 0 14px rgba(245,158,11,.28);
          transition:transform .15s,opacity .15s;
          flex-shrink:0;
        }
        .send-btn:hover:not(:disabled){transform:scale(1.08)}
        .send-btn:disabled{opacity:.28;cursor:not-allowed}

        .footer-btn{
          display:flex;align-items:center;gap:12px;
          width:100%;padding:10px 24px;
          background:none;border:none;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-size:.62rem;font-weight:700;
          letter-spacing:.18em;text-transform:uppercase;
          color:rgba(229,226,225,.25);transition:color .18s;text-align:left;
        }
        .footer-btn:hover{color:rgba(229,226,225,.6)}
        .footer-btn.danger:hover{color:#FFB4AB}

        .cam-screen{
          background:#0A0A0A;border-radius:3px;position:relative;overflow:hidden;
          aspect-ratio:16/10;
        }
        .scanlines{
          position:absolute;inset:0;pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.12) 2px,rgba(0,0,0,.12) 4px);
        }
        .cta-small{
          font-family:'Space Grotesk',sans-serif;font-size:.6rem;font-weight:700;
          letter-spacing:.2em;text-transform:uppercase;
          color:#3D2200;
          background:linear-gradient(135deg,#FFC174,#F59E0B);
          border:none;border-radius:2px;cursor:pointer;
          padding:8px 18px;
          box-shadow:0 0 16px rgba(245,158,11,.3);
          transition:transform .15s,box-shadow .2s;
          width:100%;
        }
        .cta-small:hover{transform:scale(1.03);box-shadow:0 0 24px rgba(245,158,11,.45)}
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0E0E0E", position:"relative", overflow:"hidden" }}>

        {/* Holographic grid — full page bg */}
        <div className="hud-grid" style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:.7 }} />

        {/* Ambient orb */}
        <div style={{
          position:"fixed", top:"40%", left:"50%", transform:"translate(-50%,-50%)",
          width:700, height:700, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(245,158,11,.04) 0%,transparent 65%)",
          filter:"blur(60px)", pointerEvents:"none", zIndex:0,
        }} />

        {/* ══════════ TOP NAV ══════════ */}
        <nav style={{
          height:68, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2rem",
          background:"rgba(8,6,3,.55)",
          backdropFilter:"blur(24px)",
          WebkitBackdropFilter:"blur(24px)",
          borderBottom:"1px solid rgba(255,193,116,.09)",
          boxShadow:"0 16px 40px rgba(0,0,0,.4)",
          position:"relative", zIndex:40,
        }}>
          {/* Left */}
          <div style={{ display:"flex", alignItems:"center", gap:"2.2rem" }}>
            <a href="/" style={{
              fontFamily:"'Noto Serif',serif", fontWeight:700, fontSize:"1.3rem",
              letterSpacing:"-.02em", color:"#F59E0B", textDecoration:"none",
              textShadow:"0 0 8px rgba(245,158,11,.55),0 0 20px rgba(245,158,11,.18)",
              userSelect:"none",
            }}>
              DOMINUS
            </a>
            <a href="/chat" className="nav-link active">ORACLE COMMAND</a>
          </div>

          {/* Right */}
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(229,226,225,.35)", display:"flex", padding:4, transition:"color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,193,116,.85)" }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(229,226,225,.35)" }}
            >
              <span className="msym" style={{ fontSize:20 }}>settings</span>
            </button>

            {connected && publicKey ? (
              <button
                onClick={() => disconnect()}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"7px 16px", borderRadius:2, border:"1px solid rgba(255,193,116,.2)",
                  background:"rgba(255,193,116,.07)", cursor:"pointer",
                  fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:700,
                  letterSpacing:".18em", textTransform:"uppercase", color:"#FFC174",
                  transition:"background .18s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,193,116,.14)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,193,116,.07)" }}
              >
                <span className="msym" style={{ fontSize:16 }}>account_balance_wallet</span>
                {shortenAddress(publicKey.toString())}
              </button>
            ) : (
              <button
                onClick={() => setVisible(true)}
                className="cta-small"
                style={{ width:"auto", padding:"7px 20px" }}
              >
                CONNECT WALLET
              </button>
            )}
          </div>
        </nav>

        {/* ══════════ BODY ══════════ */}
        <div style={{ display:"flex", flex:1, overflow:"hidden", position:"relative", zIndex:1 }}>

          {/* ── LEFT SIDEBAR ── */}
          <aside style={{
            width:240, flexShrink:0,
            display:"flex", flexDirection:"column",
            background:"rgba(8,6,3,.6)",
            backdropFilter:"blur(28px)",
            WebkitBackdropFilter:"blur(28px)",
            borderRight:"1px solid rgba(255,193,116,.07)",
            overflowY:"auto",
          }}>

            {/* Agent block */}
            <div style={{ padding:"28px 24px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                {/* Avatar */}
                <div style={{
                  width:34, height:34, borderRadius:3, flexShrink:0, overflow:"hidden",
                  border:"1px solid rgba(255,193,116,.22)",
                  background:"rgba(255,193,116,.08)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {!avatarErr
                    ? <img src={AETHER_AVATAR} alt="Aether" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={() => setAvatarErr(true)} />
                    : <span className="msym" style={{ fontSize:18, color:"#FFC174" }}>smart_toy</span>
                  }
                </div>
                <div>
                  <p style={{ fontFamily:"'Noto Serif',serif", fontSize:".75rem", fontWeight:700, color:"#FFC174", letterSpacing:".15em", textTransform:"uppercase" }}>AETHER-01</p>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", color:"rgba(229,226,225,.28)", letterSpacing:".18em", textTransform:"uppercase", marginTop:2 }}>AI AGENT ACTIVE</p>
                </div>
              </div>

              {/* Pulse dot */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#FFC174", animation:"blink 2s ease-in-out infinite", flexShrink:0 }} />
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", color:"rgba(255,193,116,.5)", letterSpacing:".16em", textTransform:"uppercase" }}>ONLINE · SOLANA</span>
              </div>

              {/* Initiate scan button */}
              <button className="cta-small" onClick={() => handleChip("Check Portfolio")}>
                INITIATE SCAN
              </button>
            </div>

            {/* Divider */}
            <div style={{ height:1, background:"rgba(255,193,116,.07)", margin:"0 0 6px" }} />

            {/* Nav items — only real routes */}
            <nav style={{ flex:1 }}>
              {NAV_ITEMS.map(({ icon, label, href, active }) => (
                <a key={label} href={href} className={`sidebar-nav-item${active ? " active" : ""}`}>
                  <span className="msym" style={{ fontSize:19 }}>{icon}</span>
                  {label}
                </a>
              ))}
            </nav>

            {/* Divider */}
            <div style={{ height:1, background:"rgba(255,193,116,.07)", margin:"6px 0" }} />

            {/* Footer actions */}
            <div style={{ paddingBottom:8 }}>
              <button className="footer-btn" onClick={() => setIsSettingsOpen(true)}>
                <span className="msym" style={{ fontSize:18 }}>terminal</span>
                Diagnostics
              </button>
              {connected && (
                <button className="footer-btn danger" onClick={() => disconnect()}>
                  <span className="msym" style={{ fontSize:18 }}>power_settings_new</span>
                  Disconnect
                </button>
              )}
            </div>
          </aside>

          {/* ── MAIN CHAT COLUMN ── */}
          <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

            {/* Page header */}
            <div style={{ padding:"22px 32px 14px", flexShrink:0 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".58rem", fontWeight:600, letterSpacing:".4em", textTransform:"uppercase", color:"#FFC174", marginBottom:6 }}>
                PHASE 04 // DEPLOYMENT
              </p>
              <h2 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, letterSpacing:"-.02em", lineHeight:.9 }}>
                <span style={{ fontSize:"clamp(2rem,4vw,3.2rem)", color:"#E5E2E1" }}>Oracle </span>
                <span style={{ fontSize:"clamp(2rem,4vw,3.2rem)", color:"#F59E0B" }}>Command</span>
              </h2>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".72rem", color:"rgba(229,226,225,.38)", marginTop:8, lineHeight:1.5 }}>
                {connected
                  ? `Agent active · ${shortenAddress(publicKey!.toString())} connected`
                  : "Connect your wallet to execute on-chain actions"}
              </p>
            </div>

            {/* Hairline divider */}
            <div style={{ height:1, background:"linear-gradient(to right,transparent,rgba(83,68,52,.4),transparent)", margin:"0 32px 0", flexShrink:0 }} />

            {/* Chat window — scrollable */}
            <ChatWindow messages={typedMessages} isLoading={isLoading} />

            {/* Suggestion chips */}
            {messages.length === 0 && (
              <div style={{ display:"flex", gap:8, padding:"0 32px 12px", flexWrap:"wrap", flexShrink:0 }}>
                {CHIPS.map((chip) => (
                  <button key={chip} className="chip" onClick={() => handleChip(chip)}>{chip}</button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding:"8px 32px 20px", flexShrink:0 }}>
              <div
                style={{
                  display:"flex", alignItems:"flex-end", gap:10,
                  padding:"12px 16px",
                  background:"#0A0A0A",
                  borderRadius:2,
                  border:"1px solid rgba(83,68,52,.25)",
                  transition:"border-color .2s, box-shadow .2s",
                }}
                onFocusCapture={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = "rgba(255,193,116,.3)"
                  el.style.boxShadow = "0 0 0 3px rgba(255,193,116,.06)"
                }}
                onBlurCapture={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = "rgba(83,68,52,.25)"
                  el.style.boxShadow = "none"
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={connected ? "Describe what you want to do with your crypto..." : "Connect your wallet to get started..."}
                  rows={1}
                  style={{
                    flex:1, background:"transparent", border:"none", outline:"none", resize:"none",
                    fontFamily:"'Space Grotesk',sans-serif", fontSize:".8rem",
                    color:"#E5E2E1", lineHeight:1.5,
                    maxHeight:120, overflowY:"auto",
                  }}
                />
                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <span className="msym" style={{ fontSize:18 }}>send</span>
                </button>
              </div>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(229,226,225,.18)", textAlign:"center", marginTop:8 }}>
                DOMINUS NEVER EXECUTES WITHOUT YOUR EXPLICIT CONFIRMATION
              </p>
            </div>
          </main>

          {/* ── RIGHT PANEL ── */}
          <aside style={{
            width:288, flexShrink:0,
            display:"flex", flexDirection:"column",
            background:"rgba(8,6,3,.4)",
            backdropFilter:"blur(20px)",
            WebkitBackdropFilter:"blur(20px)",
            borderLeft:"1px solid rgba(255,193,116,.07)",
            overflowY:"auto",
          }}>

            {/* Live cam */}
            <div style={{ padding:16, borderBottom:"1px solid rgba(255,193,116,.07)" }}>
              <div className="cam-screen">
                <div className="hud-grid" style={{ position:"absolute", inset:0, opacity:.9 }} />
                <div className="scanlines" />
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span className="msym" style={{ fontSize:36, color:"#1a1a1a" }}>videocam</span>
                </div>
                {/* Live badge */}
                <div style={{ position:"absolute", bottom:10, left:12, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"#B1CFF6", animation:"blink 2s ease-in-out infinite" }} />
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", letterSpacing:".16em", color:"#B1CFF6" }}>LIVE FEED / CAM-04</span>
                </div>
                {/* Clock */}
                <div style={{ position:"absolute", top:10, right:12 }}>
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", color:"rgba(229,226,225,.25)", letterSpacing:".1em" }}>{clock}</span>
                </div>
                {/* Corner brackets on cam */}
                {[
                  { top:8, left:8, borderTop:"1px solid rgba(255,193,116,0.3)", borderLeft:"1px solid rgba(255,193,116,0.3)" },
                  { top:8, right:8, borderTop:"1px solid rgba(255,193,116,0.3)", borderRight:"1px solid rgba(255,193,116,0.3)" },
                  { bottom:8, left:8, borderBottom:"1px solid rgba(255,193,116,0.3)", borderLeft:"1px solid rgba(255,193,116,0.3)" },
                  { bottom:8, right:8, borderBottom:"1px solid rgba(255,193,116,0.3)", borderRight:"1px solid rgba(255,193,116,0.3)" },
                ].map((s, i) => (
                  <div key={i} style={{ position:"absolute", width:12, height:12, ...s, pointerEvents:"none" }} />
                ))}
              </div>
            </div>

            {/* Live Protocol Feed */}
            <div style={{ padding:"18px 20px", borderBottom:"1px solid rgba(255,193,116,.07)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".58rem", fontWeight:700, letterSpacing:".22em", textTransform:"uppercase", color:"#FFC174" }}>
                  LIVE PROTOCOL FEED
                </span>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#FFC174", animation:"blink 2.5s ease-in-out infinite" }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                {[
                  { label:"SYNC",    value:"94.2%" },
                  { label:"LATENCY", value:"0.02ms"},
                  { label:"STATUS",  value:"ACTIVE"},
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", letterSpacing:".18em", textTransform:"uppercase", color:"rgba(229,226,225,.28)", marginBottom:4 }}>{label}</p>
                    <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.1rem", color:"#E5E2E1", lineHeight:1 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Neural Feedback */}
            <div style={{ padding:"18px 20px", borderBottom:"1px solid rgba(255,193,116,.07)" }}>
              <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1rem", color:"#E5E2E1", marginBottom:16, lineHeight:1 }}>Neural Feedback</p>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {NEURAL_METRICS.map(({ label, value, pct }) => (
                  <div key={label}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", letterSpacing:".18em", textTransform:"uppercase", color:"rgba(229,226,225,.28)" }}>{label}</span>
                      <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700, letterSpacing:".12em", color:"#FFC174" }}>{value}</span>
                    </div>
                    <div style={{ height:2, background:"rgba(83,68,52,.4)", borderRadius:1 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(to right,#FFC174,#F59E0B)", borderRadius:1, transition:"width 1.2s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol Archive */}
            <div style={{ padding:"18px 20px", flex:1 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".55rem", fontWeight:700, letterSpacing:".22em", textTransform:"uppercase", color:"rgba(229,226,225,.25)", marginBottom:14 }}>
                PROTOCOL ARCHIVE
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {PROTOCOL_LOG.map(({ time, desc }) => (
                  <div key={time + desc}>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".55rem", fontWeight:700, color:"rgba(255,193,116,.45)", letterSpacing:".1em" }}>[{time}]</span>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".65rem", color:"rgba(229,226,225,.28)", marginTop:3, lineHeight:1.45 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ══════════ BOTTOM STATUS BAR ══════════ */}
        <div style={{
          height:40, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2rem",
          background:"rgba(6,4,2,.9)",
          backdropFilter:"blur(16px)",
          WebkitBackdropFilter:"blur(16px)",
          borderTop:"1px solid rgba(255,193,116,.07)",
          position:"relative", zIndex:40,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background: connected ? "#FFC174" : "#3a3a3a", flexShrink:0, animation: connected ? "blink 2.5s ease-in-out infinite" : "none", boxShadow: connected ? "0 0 7px rgba(255,193,116,0.85)" : "none" }} />
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", fontWeight:600, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(229,226,225,.35)" }}>
              {connected ? "CORE PRIME CONNECTED" : "WALLET NOT CONNECTED"}
            </span>
            <div style={{ width:1, height:14, background:"rgba(255,193,116,.12)" }} />
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", letterSpacing:".15em", textTransform:"uppercase", color:"rgba(229,226,225,.22)" }}>
              {llmLabel}
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <div style={{ display:"flex", gap:4 }}>
              {[true, true, false].map((a, i) => (
                <div key={i} style={{ width:28, height:2, borderRadius:1, background: a ? "rgba(255,193,116,.65)" : "rgba(255,193,116,.16)" }} />
              ))}
            </div>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", fontWeight:600, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(229,226,225,.3)" }}>
              v1.0.0 — {network}
            </span>
          </div>
        </div>

        {/* LLM Settings panel */}
        <LLMSettings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(cfg) => { setLLMConfig(cfg); setIsSettingsOpen(false) }}
        />
      </div>
    </>
  )
}
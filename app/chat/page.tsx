"use client"

import { useChat } from "ai/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useState, useRef, useEffect, useCallback } from "react"
import ChatWindow from "@/components/ChatWindow"
import LLMSettings, { LLMSettingsConfig, loadLLMConfig } from "@/components/LLMSettings"
import { shortenAddress } from "@/lib/solana"

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const AETHER_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

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

/* ─── CSS ───────────────────────────────────────────────────────────────────── */

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .msym {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    line-height: 1; display: inline-block;
    font-family: 'Material Symbols Outlined';
  }

  .hud-grid {
    background-size: 32px 32px;
    background-image:
      linear-gradient(to right,  rgba(255,180,60,.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,180,60,.05) 1px, transparent 1px);
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: #0A0A0A; }
  ::-webkit-scrollbar-thumb { background: #3a2e20; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: #FFC060; }
  ::selection { background: rgba(255,185,60,.2); }

  @keyframes blink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.28;transform:scale(.58)} }
  @keyframes scan  { 0%{top:-4px} 100%{top:calc(100vh + 4px)} }
  @keyframes rise  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

  .rise { animation: rise .7s ease-out both; }

  /* Nav wordmark */
  .wm {
    font-family:'Noto Serif',serif; font-weight:700; font-size:1.3rem;
    letter-spacing:-.02em; color:#F59E0B; text-decoration:none;
    text-shadow:0 0 10px rgba(245,158,11,.65),0 0 22px rgba(245,130,10,.28);
    user-select:none;
  }

  /* Nav link */
  .nav-lnk {
    font-family:'Space Grotesk',sans-serif; font-size:.66rem; font-weight:700;
    letter-spacing:.18em; text-transform:uppercase; text-decoration:none;
    color:rgba(255,210,130,.5); background:none; border:none;
    padding-bottom:3px; border-bottom:1.5px solid transparent;
    transition:color .2s, border-color .2s; cursor:pointer;
  }
  .nav-lnk.active { color:#F59E0B; border-bottom-color:#F59E0B; }
  .nav-lnk:hover:not(.active) { color:rgba(255,185,70,.85); }

  /* Sidebar nav item */
  .snav {
    display:flex; align-items:center; gap:13px;
    padding:11px 22px;
    font-family:'Space Grotesk',sans-serif; font-size:.64rem; font-weight:700;
    letter-spacing:.17em; text-transform:uppercase; text-decoration:none;
    color:rgba(255,200,120,.28); background:none; border:none;
    border-left:3px solid transparent;
    transition:all .18s; cursor:pointer; width:100%; text-align:left;
  }
  .snav.active {
    color:#F59E0B; background:rgba(245,158,11,.08); border-left-color:#F59E0B;
  }
  .snav:hover:not(.active) { color:rgba(255,200,100,.65); background:rgba(255,255,255,.028); }

  /* Footer action */
  .ftr-btn {
    display:flex; align-items:center; gap:13px;
    padding:10px 22px; width:100%; background:none; border:none; cursor:pointer;
    font-family:'Space Grotesk',sans-serif; font-size:.62rem; font-weight:700;
    letter-spacing:.17em; text-transform:uppercase;
    color:rgba(255,200,120,.22); text-align:left; transition:color .18s;
  }
  .ftr-btn:hover { color:rgba(255,200,100,.6); }
  .ftr-btn.danger:hover { color:#FFB4AB; }

  /* Suggestion chip */
  .chip {
    font-family:'Space Grotesk',sans-serif; font-size:.58rem; font-weight:600;
    letter-spacing:.15em; text-transform:uppercase;
    color:rgba(255,200,120,.38); background:#181614;
    border:1px solid rgba(255,180,60,.15); border-radius:2px;
    padding:7px 14px; cursor:pointer; transition:all .18s;
  }
  .chip:hover { color:#FFC060; background:#211d18; border-color:rgba(255,185,60,.35); }

  /* Send button */
  .send-btn {
    width:38px; height:38px; flex-shrink:0; border-radius:2px; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,#FFD080,#F59E0B);
    color:#2A1400;
    box-shadow:0 0 16px rgba(245,158,11,.35);
    transition:transform .14s, opacity .14s;
  }
  .send-btn:hover:not(:disabled) { transform:scale(1.08); }
  .send-btn:active:not(:disabled) { transform:scale(.96); }
  .send-btn:disabled { opacity:.25; cursor:not-allowed; }

  /* Wallet button */
  .wallet-btn {
    display:flex; align-items:center; gap:6px;
    padding:7px 16px; border-radius:2px; border:none; cursor:pointer;
    font-family:'Space Grotesk',sans-serif; font-size:.6rem; font-weight:700;
    letter-spacing:.17em; text-transform:uppercase; transition:all .18s;
    border:1px solid rgba(255,185,60,.22);
    background:rgba(255,185,60,.08); color:#FFC060;
  }
  .wallet-btn:hover { background:rgba(255,185,60,.16); }

  /* Primary CTA */
  .cta-sm {
    font-family:'Space Grotesk',sans-serif; font-size:.6rem; font-weight:700;
    letter-spacing:.2em; text-transform:uppercase;
    color:#2A1400; background:linear-gradient(135deg,#FFD080,#F59E0B);
    border:none; border-radius:2px; cursor:pointer;
    padding:9px 20px;
    box-shadow:0 0 18px rgba(245,158,11,.35);
    transition:transform .14s, box-shadow .2s; white-space:nowrap;
  }
  .cta-sm:hover { transform:scale(1.04); box-shadow:0 0 28px rgba(245,158,11,.55); }
  .cta-sm:active { transform:scale(.97); }

  /* Initiate scan button */
  .scan-btn {
    width:100%; padding:9px 0; border-radius:2px;
    font-family:'Space Grotesk',sans-serif; font-size:.6rem; font-weight:700;
    letter-spacing:.2em; text-transform:uppercase;
    color:#FFC060; cursor:pointer; transition:all .18s;
    background:rgba(255,185,60,.07);
    border:1px solid rgba(255,185,60,.2);
  }
  .scan-btn:hover { background:rgba(255,185,60,.14); border-color:rgba(255,185,60,.35); }

  /* Camera screen */
  .cam {
    aspect-ratio:16/10; border-radius:3px;
    background:#080604; position:relative; overflow:hidden;
  }
  .scanlines {
    position:absolute; inset:0; pointer-events:none;
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.1) 2px,rgba(0,0,0,.1) 4px);
  }

  /* Input area */
  .input-wrap {
    display:flex; align-items:flex-end; gap:10px;
    padding:12px 16px; border-radius:2px;
    background:#0C0A08;
    border:1px solid rgba(255,180,60,.14);
    transition:border-color .2s, box-shadow .2s;
  }
  .input-wrap:focus-within {
    border-color:rgba(255,185,60,.32);
    box-shadow:0 0 0 3px rgba(255,185,60,.06);
  }
  textarea {
    flex:1; background:transparent; border:none; outline:none; resize:none;
    font-family:'Space Grotesk',sans-serif; font-size:.78rem;
    color:#E5E2E1; line-height:1.55; max-height:120px; overflow-y:auto;
  }
  textarea::placeholder { color:rgba(255,200,120,.28); }

  /* Stat label / value */
  .stat-lbl { font-family:'Space Grotesk',sans-serif; font-size:.5rem; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,200,120,.28); display:block; margin-bottom:4px; }
  .stat-val { font-family:'Noto Serif',serif; font-size:1.1rem; color:#E5E2E1; line-height:1; }

  /* Status bar text */
  .sb-txt { font-family:'Space Grotesk',sans-serif; font-size:.52rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,200,120,.38); }

  /* Hide wallet adapter auto button */
  .wallet-adapter-dropdown,
  .wallet-adapter-button-trigger,
  [class*="wallet-adapter-dropdown"] { display:none !important; }
`

/* ─── Component ─────────────────────────────────────────────────────────────── */

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
    const tick = () => setClock(
      new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false })
    )
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  const chatBody = {
    walletAddress: publicKey?.toString(),
    ...(llmConfig && {
      llmOverride: llmConfig.mode === "ollama"
        ? { provider:"ollama" as const, baseUrl:llmConfig.ollamaBaseUrl, model:llmConfig.ollamaModel }
        : { provider:llmConfig.provider, apiKey:llmConfig.apiKey, model:llmConfig.model || undefined },
    }),
  }

  const { messages, append, isLoading, setMessages } = useChat({ api:"/api/chat", body:chatBody })

  const typedMessages = messages.map((m) => {
    let content = ""
    if (typeof m.content === "string") content = m.content
    else if (Array.isArray(m.content))
      content = (m.content as { type:string; text?:string }[])
        .filter((p) => p.type === "text" && p.text).map((p) => p.text).join("")
    let toolInvocations: { toolName:string; state:"call"|"result"|"partial-call"; result?:unknown }[] | undefined
      = m.toolInvocations as typeof toolInvocations
    if (!toolInvocations?.length && m.annotations?.length) {
      const ann = (m.annotations as unknown[]).filter(
        (a): a is { toolName:string; result:unknown } => typeof a === "object" && a !== null && "toolName" in a
      )
      if (ann.length) toolInvocations = ann.map((a) => ({ toolName:a.toolName, state:"result" as const, result:a.result }))
    }
    return { id:m.id, role:m.role as "user"|"assistant", content, toolInvocations }
  })

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [input])

  const showWalletWarning = useCallback((text: string) => {
    setMessages([...messages,
      { id:`local-${Date.now()}-u`, role:"user",      content:text },
      { id:`local-${Date.now()}-a`, role:"assistant", content:"Please connect your wallet first — click CONNECT WALLET in the top bar." },
    ])
  }, [messages, setMessages])

  async function handleSend() {
    const t = input.trim(); if (!t || isLoading) return
    setInput("")
    if (!connected || !publicKey) { showWalletWarning(t); return }
    await append({ role:"user", content:t })
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  async function handleChip(prompt: string) {
    if (isLoading) return
    if (!connected || !publicKey) { showWalletWarning(prompt); return }
    await append({ role:"user", content:prompt })
  }

  const llmLabel = llmConfig?.mode === "api"
    ? (llmConfig.provider === "anthropic" ? `ANTHROPIC — ${llmConfig.model || "DEFAULT"}` : `OPENAI — ${llmConfig.model || "DEFAULT"}`)
    : `OLLAMA — ${llmConfig?.ollamaModel ?? "llama3.1:8b"}`
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "MAINNET" : "DEVNET"

  return (
    <>
      <style>{CSS}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0C0A08", position:"relative", overflow:"hidden" }}>

        {/* Full-page HUD grid */}
        <div className="hud-grid" style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:.8 }} />

        {/* Subtle ambient orb — top center */}
        <div style={{
          position:"fixed", top:"-10%", left:"50%", transform:"translateX(-50%)",
          width:700, height:400, borderRadius:"50%",
          background:"radial-gradient(ellipse, rgba(245,158,11,.06) 0%, transparent 65%)",
          filter:"blur(50px)", pointerEvents:"none", zIndex:0,
        }} />

        {/* Scanline */}
        <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:1 }}>
          <div style={{
            position:"absolute", left:0, right:0, height:2,
            background:"linear-gradient(to bottom,transparent,rgba(255,180,30,.03),transparent)",
            animation:"scan 18s linear infinite",
          }} />
        </div>

        {/* ════ TOP NAV ════ */}
        <nav style={{
          height:66, flexShrink:0, position:"relative", zIndex:40,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2rem",
          background:"rgba(8,5,2,.6)",
          backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
          borderBottom:"1px solid rgba(255,180,50,.1)",
          boxShadow:"0 1px 30px rgba(0,0,0,.5)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"2.2rem" }}>
            <a href="/" className="wm">DOMINUS</a>
            <a href="/chat" className="nav-lnk active">ORACLE COMMAND</a>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,200,120,.35)", display:"flex", padding:4, transition:"color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,185,60,.9)" }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,200,120,.35)" }}
            >
              <span className="msym" style={{ fontSize:20 }}>settings</span>
            </button>
            {connected && publicKey ? (
              <button className="wallet-btn" onClick={() => disconnect()}>
                <span className="msym" style={{ fontSize:16 }}>account_balance_wallet</span>
                {shortenAddress(publicKey.toString())}
              </button>
            ) : (
              <button className="cta-sm" onClick={() => setVisible(true)}>CONNECT WALLET</button>
            )}
          </div>
        </nav>

        {/* ════ BODY ════ */}
        <div style={{ display:"flex", flex:1, overflow:"hidden", position:"relative", zIndex:2 }}>

          {/* ── SIDEBAR ── */}
          <aside style={{
            width:220, flexShrink:0,
            display:"flex", flexDirection:"column",
            background:"rgba(8,5,2,.65)",
            backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
            borderRight:"1px solid rgba(255,180,50,.08)",
          }}>
            {/* Agent block */}
            <div style={{ padding:"24px 20px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <div style={{
                  width:34, height:34, borderRadius:3, flexShrink:0, overflow:"hidden",
                  border:"1px solid rgba(255,185,60,.25)",
                  background:"rgba(255,185,60,.08)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {!avatarErr
                    ? <img src={AETHER_AVATAR} alt="Aether" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={() => setAvatarErr(true)} />
                    : <span className="msym" style={{ fontSize:18, color:"#FFC060" }}>smart_toy</span>
                  }
                </div>
                <div>
                  <p style={{ fontFamily:"'Noto Serif',serif", fontSize:".72rem", fontWeight:700, color:"#FFC060", letterSpacing:".14em", textTransform:"uppercase" }}>AETHER-01</p>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", color:"rgba(255,200,120,.3)", letterSpacing:".16em", textTransform:"uppercase", marginTop:2 }}>AI AGENT ACTIVE</p>
                </div>
              </div>

              {/* Status dot */}
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#FFC060", boxShadow:"0 0 7px rgba(255,185,60,.85)", animation:"blink 2.5s ease-in-out infinite", flexShrink:0 }} />
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", color:"rgba(255,185,60,.55)", letterSpacing:".16em", textTransform:"uppercase" }}>ONLINE · SOLANA</span>
              </div>

              <button className="scan-btn" onClick={() => handleChip("Check Portfolio")}>INITIATE SCAN</button>
            </div>

            {/* Divider */}
            <div style={{ height:1, background:"rgba(255,180,50,.07)", margin:"0 0 4px" }} />

            {/* Nav — only real routes */}
            <nav style={{ flex:1 }}>
              <a href="/chat" className="snav active">
                <span className="msym" style={{ fontSize:18 }}>psychology</span>
                Neural Link
              </a>
            </nav>

            {/* Divider */}
            <div style={{ height:1, background:"rgba(255,180,50,.07)", margin:"4px 0" }} />

            {/* Footer */}
            <div style={{ paddingBottom:10 }}>
              <button className="ftr-btn" onClick={() => setIsSettingsOpen(true)}>
                <span className="msym" style={{ fontSize:18 }}>terminal</span>
                Diagnostics
              </button>
              {connected && (
                <button className="ftr-btn danger" onClick={() => disconnect()}>
                  <span className="msym" style={{ fontSize:18 }}>power_settings_new</span>
                  Disconnect
                </button>
              )}
            </div>
          </aside>

          {/* ── MAIN CHAT ── */}
          <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

            {/* Page header */}
            <div style={{ padding:"20px 28px 12px", flexShrink:0 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".56rem", fontWeight:600, letterSpacing:".38em", textTransform:"uppercase", color:"rgba(255,185,60,.7)", marginBottom:6 }}>
                PHASE 04 // DEPLOYMENT
              </p>
              <h2 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, letterSpacing:"-.02em", lineHeight:.92, marginBottom:8 }}>
                <span style={{ color:"#E5E2E1", fontSize:"clamp(1.8rem,3.8vw,3rem)" }}>Oracle </span>
                <span style={{ color:"#F59E0B", fontSize:"clamp(1.8rem,3.8vw,3rem)", textShadow:"0 0 20px rgba(245,158,11,.4)" }}>Command</span>
              </h2>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".7rem", color:"rgba(255,200,120,.35)", lineHeight:1.5 }}>
                {connected
                  ? `Agent active · ${shortenAddress(publicKey!.toString())} connected`
                  : "Connect your wallet to execute on-chain actions"}
              </p>
            </div>

            {/* Hairline */}
            <div style={{ height:1, background:"linear-gradient(to right,transparent,rgba(255,180,50,.2),transparent)", margin:"0 28px 0", flexShrink:0 }} />

            {/* Chat */}
            <ChatWindow messages={typedMessages} isLoading={isLoading} />

            {/* Chips */}
            {messages.length === 0 && (
              <div style={{ display:"flex", gap:7, padding:"0 28px 10px", flexWrap:"wrap", flexShrink:0 }}>
                {CHIPS.map((c) => <button key={c} className="chip" onClick={() => handleChip(c)}>{c}</button>)}
              </div>
            )}

            {/* Input */}
            <div style={{ padding:"8px 28px 18px", flexShrink:0 }}>
              <div className="input-wrap">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={connected ? "Describe what you want to do with your crypto..." : "Connect your wallet to get started..."}
                  rows={1}
                />
                <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isLoading}>
                  <span className="msym" style={{ fontSize:18 }}>send</span>
                </button>
              </div>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", fontWeight:600, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,200,120,.18)", textAlign:"center", marginTop:7 }}>
                DOMINUS NEVER EXECUTES WITHOUT YOUR EXPLICIT CONFIRMATION
              </p>
            </div>
          </main>

          {/* ── RIGHT PANEL ── */}
          <aside style={{
            width:276, flexShrink:0,
            display:"flex", flexDirection:"column",
            background:"rgba(8,5,2,.4)",
            backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
            borderLeft:"1px solid rgba(255,180,50,.07)",
            overflowY:"auto",
          }}>

            {/* Cam feed */}
            <div style={{ padding:14, borderBottom:"1px solid rgba(255,180,50,.07)" }}>
              <div className="cam">
                <div className="hud-grid" style={{ position:"absolute", inset:0, opacity:1 }} />
                <div className="scanlines" />
                {/* Corner brackets on cam */}
                {[
                  { top:7, left:7, borderTop:"1px solid rgba(255,185,60,.3)", borderLeft:"1px solid rgba(255,185,60,.3)" },
                  { top:7, right:7, borderTop:"1px solid rgba(255,185,60,.3)", borderRight:"1px solid rgba(255,185,60,.3)" },
                  { bottom:7, left:7, borderBottom:"1px solid rgba(255,185,60,.3)", borderLeft:"1px solid rgba(255,185,60,.3)" },
                  { bottom:7, right:7, borderBottom:"1px solid rgba(255,185,60,.3)", borderRight:"1px solid rgba(255,185,60,.3)" },
                ].map((s, i) => (
                  <div key={i} style={{ position:"absolute", width:11, height:11, ...s, pointerEvents:"none" }} />
                ))}
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span className="msym" style={{ fontSize:32, color:"rgba(255,185,60,.08)" }}>videocam</span>
                </div>
                {/* Live badge */}
                <div style={{ position:"absolute", bottom:9, left:11, display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"#B1CFF6", animation:"blink 2s ease-in-out infinite" }} />
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", letterSpacing:".14em", color:"#B1CFF6" }}>LIVE FEED / CAM-04</span>
                </div>
                <div style={{ position:"absolute", top:9, right:11 }}>
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", color:"rgba(255,200,120,.25)", letterSpacing:".08em" }}>{clock}</span>
                </div>
              </div>
            </div>

            {/* Live Protocol Feed */}
            <div style={{ padding:"16px 18px", borderBottom:"1px solid rgba(255,180,50,.07)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".55rem", fontWeight:700, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,185,60,.75)" }}>
                  LIVE PROTOCOL FEED
                </span>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#FFC060", boxShadow:"0 0 6px rgba(255,185,60,.8)", animation:"blink 3s ease-in-out infinite" }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[
                  { label:"SYNC",    value:"94.2%" },
                  { label:"LATENCY", value:"0.02ms"},
                  { label:"STATUS",  value:"ACTIVE"},
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="stat-lbl">{label}</span>
                    <span className="stat-val">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Neural Feedback */}
            <div style={{ padding:"16px 18px", borderBottom:"1px solid rgba(255,180,50,.07)" }}>
              <p style={{ fontFamily:"'Noto Serif',serif", fontSize:".95rem", color:"#D8C3AD", marginBottom:14, lineHeight:1 }}>
                Neural Feedback
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                {NEURAL_METRICS.map(({ label, value, pct }) => (
                  <div key={label}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,200,120,.28)" }}>{label}</span>
                      <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700, letterSpacing:".1em", color:"rgba(255,185,60,.8)" }}>{value}</span>
                    </div>
                    <div style={{ height:2, background:"rgba(255,180,50,.12)", borderRadius:1 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(to right,#FFC060,#F59E0B)", borderRadius:1 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol Archive */}
            <div style={{ padding:"16px 18px", flex:1 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:700, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,200,120,.25)", marginBottom:12 }}>
                PROTOCOL ARCHIVE
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {PROTOCOL_LOG.map(({ time, desc }) => (
                  <div key={time + desc}>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".52rem", fontWeight:700, color:"rgba(255,185,60,.42)", letterSpacing:".08em" }}>[{time}]</span>
                    <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".62rem", color:"rgba(255,200,120,.28)", marginTop:3, lineHeight:1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ════ STATUS BAR ════ */}
        <div style={{
          height:38, flexShrink:0, position:"relative", zIndex:40,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2rem",
          background:"rgba(5,3,1,.92)",
          backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)",
          borderTop:"1px solid rgba(255,180,50,.08)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <span style={{
              width:6, height:6, borderRadius:"50%", flexShrink:0,
              background: connected ? "#FFC060" : "#2a2520",
              boxShadow: connected ? "0 0 8px rgba(255,185,60,.85)" : "none",
              animation: connected ? "blink 3s ease-in-out infinite" : "none",
            }} />
            <span className="sb-txt">{connected ? "CORE PRIME CONNECTED" : "WALLET NOT CONNECTED"}</span>
            <div style={{ width:1, height:12, background:"rgba(255,180,50,.14)" }} />
            <span className="sb-txt" style={{ opacity:.7 }}>{llmLabel}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <div style={{ display:"flex", gap:4 }}>
              {[true, true, false].map((a, i) => (
                <div key={i} style={{ width:26, height:2, borderRadius:1, background: a ? "rgba(255,185,60,.65)" : "rgba(255,185,60,.15)" }} />
              ))}
            </div>
            <span className="sb-txt">v1.0.0 — {network}</span>
          </div>
        </div>

        <LLMSettings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(cfg) => { setLLMConfig(cfg); setIsSettingsOpen(false) }}
        />
      </div>
    </>
  )
}
"use client"

// app/chat/page.tsx — Oracle Command
// Full chat interface: sidebar + chat + dynamic RightPanel

import { useEffect, useState, useRef, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useRouter } from "next/navigation"
import { useChat } from "ai/react"
import type { Message } from "@/lib/types"
import ChatWindow from "@/components/ChatWindow"
import LLMSettings, { loadLLMConfig, LLMSettingsConfig } from "@/components/LLMSettings"
import RightPanel from "@/components/RightPanel"

const AETHER =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

const NAV_ITEMS = [
  { icon: "psychology",       label: "Neural Link",  path: "/chat"      },
  { icon: "sensors",          label: "Pulse",        path: "/pulse"     },
  { icon: "query_stats",      label: "Tactical",     path: "/tactical"  },
  { icon: "inventory_2",      label: "Logistics",    path: "/logistics" },
  { icon: "blur_on",          label: "Void Shell",   path: "/void"      },
]

const SUGGESTIONS = [
  "What's my portfolio worth?",
  "Swap 0.5 SOL to USDC",
  "Stake my idle SOL with Jito",
  "Stream $20 USDC weekly",
]

export default function ChatPage() {
  const { publicKey, connected, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const router = useRouter()

  const [mounted,        setMounted]        = useState(false)
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [llmConfig,      setLlmConfig]      = useState<LLMSettingsConfig | null>(null)
  const [sidebarOpen,    setSidebarOpen]    = useState(false) // mobile
  const [activityLog,    setActivityLog]    = useState<Array<{ time: string; message: string }>>([])
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const chatBottom = useRef<HTMLDivElement>(null)

  const walletAddress = publicKey?.toString() ?? ""
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "MAINNET" : "DEVNET"

  // Build llmOverride from stored config
  const llmOverride = llmConfig
    ? llmConfig.mode === "ollama"
      ? { provider: "ollama" as const, baseUrl: llmConfig.ollamaBaseUrl, model: llmConfig.ollamaModel }
      : { provider: llmConfig.provider, apiKey: llmConfig.apiKey, model: llmConfig.model }
    : undefined

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, append } = useChat({
    api: "/api/chat",
    body: { walletAddress, llmOverride },
    onFinish: (msg) => {
      const t = new Date()
      const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`
      setActivityLog(prev => [{ time: ts, message: "AI response complete" }, ...prev].slice(0, 30))
    },
  })

  useEffect(() => { setMounted(true); setLlmConfig(loadLLMConfig()) }, [])

  // Auto-scroll
  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // Log user messages to activity
  const handleSend = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return

    if (!connected) {
      const ts = new Date()
      const t  = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`
      setMessages([
        ...messages,
        { id:`local-u-${Date.now()}`, role:"user",      content: input } as Message,
        { id:`local-a-${Date.now()}`, role:"assistant", content: "Please connect your wallet first to use Dominus. Click **CONNECT WALLET** in the top nav." } as Message,
      ])
      return
    }

    const ts = new Date()
    const t  = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`
    setActivityLog(prev => [{ time:t, message:`User: ${input.slice(0,42)}…` }, ...prev].slice(0,30))
    handleSubmit(e as React.FormEvent<HTMLFormElement>)
  }, [input, connected, messages, handleSubmit, setMessages])

  const handleSuggestion = useCallback((text: string) => {
    if (!connected) { setVisible(true); return }
    const ts = new Date()
    const t  = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`
    setActivityLog(prev => [{ time:t, message:`User: ${text}` }, ...prev].slice(0,30))
    append({ role:"user", content: text })
  }, [connected, append, setVisible])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!mounted) return <div style={{ background:"#060300", width:"100vw", height:"100vh" }} />

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;background:#060300}

        .ms{
          font-family:'Material Symbols Outlined';
          font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;
          line-height:1;user-select:none;display:inline-block;
        }

        /* Animations */
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.14}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmerSweep{0%{background-position:-250% 0}100%{background-position:250% 0}}
        @keyframes msgIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes beamPulse{0%,100%{opacity:.2}50%{opacity:.65}}
        @keyframes msg-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scanLine{0%{top:-2px}100%{top:calc(100% + 2px)}}

        /* Nav glass */
        .nav-glass{
          background:linear-gradient(180deg,rgba(5,2,0,.88) 0%,rgba(3,1,0,.72) 100%);
          backdrop-filter:blur(32px) saturate(1.8);
          -webkit-backdrop-filter:blur(32px) saturate(1.8);
          border-bottom:1px solid rgba(255,185,60,.1);
          box-shadow:0 1px 0 rgba(255,255,255,.035),0 18px 55px rgba(0,0,0,.62);
        }

        /* Sidebar */
        .sidebar{
          background:linear-gradient(180deg,rgba(8,5,1,.96) 0%,rgba(5,3,0,.98) 100%);
          border-right:1px solid rgba(255,185,60,.08);
          box-shadow:4px 0 30px rgba(0,0,0,.55),inset -1px 0 0 rgba(255,185,60,.04);
        }

        /* Chat area */
        .chat-bg{
          background:
            radial-gradient(ellipse 65% 45% at 50% 30%,rgba(255,120,10,.042) 0%,transparent 68%),
            linear-gradient(180deg,#060300 0%,#060200 100%);
        }

        /* Message glass — AI */
        .msg-ai{
          background:linear-gradient(135deg,rgba(28,22,14,.94) 0%,rgba(20,15,9,.97) 100%);
          border:1px solid rgba(255,185,60,.15);
          border-top:1px solid rgba(255,185,60,.25);
          border-left:2.5px solid rgba(255,185,60,.35);
          border-radius:0 12px 12px 12px;
          box-shadow:
            0 4px 8px rgba(0,0,0,.62),
            0 14px 36px rgba(0,0,0,.75),
            0 28px 60px rgba(0,0,0,.5),
            0 0 0 1px rgba(0,0,0,.35),
            0 0 24px rgba(245,158,11,.055),
            inset 0 1px 0 rgba(255,200,80,.07);
          position:relative;overflow:hidden;
        }
        .msg-ai::before{
          content:'';position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(108deg,transparent 22%,rgba(255,255,255,.055) 50%,transparent 78%);
          background-size:250% 100%;animation:shimmerSweep 12s ease-in-out infinite;
        }

        /* Message glass — User */
        .msg-user{
          background:linear-gradient(135deg,rgba(38,30,20,.92) 0%,rgba(28,22,14,.95) 100%);
          border:1px solid rgba(160,142,122,.18);
          border-top:1px solid rgba(255,255,255,.08);
          border-right:2.5px solid rgba(255,185,60,.28);
          border-radius:12px 0 12px 12px;
          box-shadow:
            0 4px 8px rgba(0,0,0,.58),
            0 14px 36px rgba(0,0,0,.72),
            0 0 0 1px rgba(0,0,0,.3);
          position:relative;overflow:hidden;
        }

        /* Input field */
        .chat-input{
          background:rgba(14,10,6,.85);
          border:1px solid rgba(255,185,60,.12);
          border-radius:12px;
          color:#E5E2E1;
          font-family:'Space Grotesk',sans-serif;
          font-size:.8rem;
          line-height:1.55;
          outline:none;
          resize:none;
          transition:border-color .2s,box-shadow .2s;
          box-shadow:0 4px 18px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.03);
        }
        .chat-input:focus{
          border-color:rgba(255,185,60,.35);
          box-shadow:0 0 0 3px rgba(255,193,116,.08),0 4px 18px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.03);
        }
        .chat-input::placeholder{color:rgba(229,226,225,.2)}

        /* Send button */
        .send-btn{
          background:linear-gradient(135deg,#FFD060,#F59E0B 55%,#D97706);
          border:none;border-radius:10px;cursor:pointer;
          width:42px;height:42px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          box-shadow:0 0 20px rgba(245,158,11,.55),0 4px 14px rgba(0,0,0,.6);
          transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s;
        }
        .send-btn:hover{transform:scale(1.08);box-shadow:0 0 32px rgba(255,185,10,.85),0 6px 18px rgba(0,0,0,.65)}
        .send-btn:active{transform:scale(.94)}
        .send-btn:disabled{opacity:.38;cursor:not-allowed;transform:none}

        /* Sidebar nav item */
        .nav-item{
          display:flex;align-items:center;gap:14px;
          padding:10px 20px;cursor:pointer;
          transition:background .18s,color .18s;border-left:3px solid transparent;
        }
        .nav-item:hover{background:rgba(255,185,60,.06)}
        .nav-item.active{
          background:rgba(255,185,60,.09);
          border-left-color:rgba(255,185,60,.8);
        }
        .nav-item.active .nav-icon{color:rgba(255,185,60,.92)}
        .nav-item.active .nav-label{color:rgba(255,185,60,.95)}
        .nav-icon{
          font-family:'Material Symbols Outlined';
          font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;
          font-size:20px;line-height:1;color:rgba(255,215,150,.3);
          transition:color .18s,transform .18s;
        }
        .nav-item:hover .nav-icon{color:rgba(255,215,150,.65);transform:scale(1.1)}
        .nav-label{
          font-family:'Space Grotesk',sans-serif;font-size:.6rem;font-weight:700;
          letter-spacing:.18em;text-transform:uppercase;color:rgba(255,215,150,.3);
          transition:color .18s;
        }
        .nav-item:hover .nav-label{color:rgba(255,215,150,.65)}

        /* Initiate scan button */
        .scan-btn{
          display:flex;align-items:center;justify-content:center;gap:7px;
          padding:9px 0;width:calc(100% - 32px);margin:0 16px;
          background:rgba(255,185,60,.07);
          border:1px solid rgba(255,185,60,.18);
          border-radius:8px;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-size:.54rem;font-weight:700;
          letter-spacing:.2em;text-transform:uppercase;color:rgba(255,185,60,.65);
          transition:all .2s;
          box-shadow:0 0 16px rgba(245,158,11,.06),inset 0 1px 0 rgba(255,200,80,.07);
        }
        .scan-btn:hover{background:rgba(255,185,60,.12);border-color:rgba(255,185,60,.3);color:rgba(255,185,60,.9);box-shadow:0 0 24px rgba(245,158,11,.12)}

        /* Suggestion chip */
        .chip{
          display:inline-flex;align-items:center;gap:6px;
          padding:6px 14px;
          background:rgba(255,185,60,.05);
          border:1px solid rgba(255,185,60,.12);
          border-radius:8px;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-size:.54rem;font-weight:500;
          letter-spacing:.12em;text-transform:uppercase;color:rgba(255,215,150,.38);
          transition:all .18s;white-space:nowrap;
        }
        .chip:hover{background:rgba(255,185,60,.1);border-color:rgba(255,185,60,.28);color:rgba(255,185,60,.85)}

        /* Status bar */
        .status-bar{
          background:linear-gradient(0deg,rgba(3,1,0,.97) 0%,rgba(5,2,0,.88) 100%);
          backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
          border-top:1px solid rgba(255,185,60,.08);
          box-shadow:0 -12px 40px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.025);
        }

        /* Connect wallet button */
        .connect-btn{
          display:inline-flex;align-items:center;gap:6px;
          padding:.36rem 1.1rem;
          background:linear-gradient(135deg,#FFD060,#F59E0B 55%,#D97706);
          border:none;border-radius:8px;cursor:pointer;
          font-family:'Space Grotesk',sans-serif;font-size:.56rem;font-weight:700;
          letter-spacing:.2em;text-transform:uppercase;color:#120700;
          box-shadow:0 0 22px rgba(245,158,11,.5),0 4px 14px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.38);
          transition:transform .18s,box-shadow .18s;
          text-shadow:0 1px 0 rgba(255,255,255,.28);
        }
        .connect-btn:hover{transform:scale(1.04);box-shadow:0 0 36px rgba(255,185,10,.8),0 6px 18px rgba(0,0,0,.6)}

        /* Wallet chip (connected) */
        .wallet-chip{
          display:inline-flex;align-items:center;gap:7px;
          padding:.32rem .9rem;
          background:rgba(255,185,60,.08);
          border:1px solid rgba(255,185,60,.2);border-radius:8px;
          font-family:'Space Grotesk',sans-serif;font-size:.5rem;font-weight:700;
          letter-spacing:.14em;text-transform:uppercase;color:rgba(255,185,60,.72);
          box-shadow:0 2px 10px rgba(0,0,0,.42);cursor:default;
        }

        /* Scrollbar */
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,185,60,.18);border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,185,60,.4)}
        ::selection{background:rgba(255,193,116,.22)}

        /* Hide wallet adapter default UI */
        .wallet-adapter-dropdown,.wallet-adapter-button-trigger,[class*="wallet-adapter-dropdown"]{display:none!important}
      `}</style>

      {/* ══ ROOT ══════════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#060300", overflow:"hidden" }}>

        {/* Scan line */}
        <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:100 }}>
          <div style={{ position:"absolute", left:0, right:0, height:2, top:0,
            background:"linear-gradient(180deg,transparent,rgba(255,185,40,.028),transparent)",
            animation:"scanLine 32s linear infinite" }} />
        </div>

        {/* ══ TOP NAV ═══════════════════════════════════════════════════════ */}
        <nav className="nav-glass" style={{
          height: 60, flexShrink: 0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 1.4rem", zIndex:50,
        }}>
          {/* Left */}
          <div style={{ display:"flex", alignItems:"center", gap:"1.6rem" }}>
            {/* Mobile sidebar toggle */}
            <button onClick={() => setSidebarOpen(o=>!o)}
              style={{ display:"none", background:"none", border:"none", cursor:"pointer",
                color:"rgba(255,185,60,.5)", padding:4 }}
              className="mobile-menu-btn">
              <span className="ms" style={{ fontSize:22 }}>menu</span>
            </button>

            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:26, height:26, borderRadius:8, overflow:"hidden", flexShrink:0,
                border:"1px solid rgba(255,185,60,.32)", boxShadow:"0 0 10px rgba(245,158,11,.42)" }}>
                <img src={AETHER} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display="none" }} />
              </div>
              <button onClick={() => router.push("/")} style={{ background:"none", border:"none", cursor:"pointer" }}>
                <span style={{ fontFamily:"'Noto Serif',serif", fontWeight:700, fontSize:"1.15rem",
                  letterSpacing:"-.022em", color:"#F59E0B", userSelect:"none",
                  textShadow:"0 0 12px rgba(245,158,11,.9),0 0 32px rgba(245,130,10,.38)" }}>DOMINUS</span>
              </button>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:5, padding:".28rem .7rem",
              background:"rgba(255,185,60,.06)", border:"1px solid rgba(255,185,60,.1)", borderRadius:20 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#FFAD10",
                boxShadow:"0 0 6px rgba(255,185,60,.8)", display:"inline-block",
                animation:"blink 2.4s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
                letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,185,60,.6)" }}>
                ORACLE COMMAND
              </span>
            </div>
          </div>

          {/* Right */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => setSettingsOpen(true)}
              style={{ background:"none", border:"none", cursor:"pointer",
                color:"rgba(255,200,120,.3)", padding:4, transition:"color .2s", display:"flex" }}
              onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,185,60,.85)")}
              onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,200,120,.3)")}>
              <span className="ms" style={{ fontSize:19 }}>settings</span>
            </button>

            {connected && walletAddress ? (
              <div className="wallet-chip">
                <span style={{ width:6, height:6, borderRadius:"50%", background:"rgba(100,220,120,.8)",
                  boxShadow:"0 0 6px rgba(80,255,130,.7)", display:"inline-block",
                  animation:"blink 2.8s ease-in-out infinite" }} />
                {walletAddress.slice(0,5)}…{walletAddress.slice(-4)}
              </div>
            ) : (
              <button className="connect-btn" onClick={() => setVisible(true)}>
                <span className="ms" style={{ fontSize:14 }}>account_balance_wallet</span>
                CONNECT WALLET
              </button>
            )}
          </div>
        </nav>

        {/* ══ BODY ═══════════════════════════════════════════════════════════ */}
        <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }}>

          {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
          <aside className="sidebar" style={{
            width: 220, flexShrink:0, display:"flex", flexDirection:"column",
            height:"100%", overflowY:"auto", paddingTop:8, paddingBottom:16,
            zIndex:40,
          }}>
            {/* Agent identity */}
            <div style={{ padding:"16px 20px 14px", borderBottom:"1px solid rgba(255,185,60,.06)", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <div style={{ width:32, height:32, borderRadius:8, overflow:"hidden", flexShrink:0,
                  border:"1px solid rgba(255,185,60,.28)", boxShadow:"0 0 10px rgba(245,158,11,.35)" }}>
                  <img src={AETHER} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display="none" }} />
                </div>
                <div>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".68rem", fontWeight:700,
                    letterSpacing:".12em", textTransform:"uppercase", color:"rgba(255,185,60,.92)", margin:0 }}>
                    AETHER-01
                  </p>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
                    letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,215,150,.28)", margin:0 }}>
                    AI AGENT ACTIVE
                  </p>
                </div>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:connected?"#55FF88":"#FF6B6B",
                  boxShadow:`0 0 5px ${connected?"rgba(80,255,130,.8)":"rgba(255,100,80,.6)"}`,
                  display:"inline-block", animation:"blink 2.2s ease-in-out infinite" }} />
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
                  letterSpacing:".16em", textTransform:"uppercase",
                  color: connected ? "rgba(100,220,120,.6)" : "rgba(255,100,80,.55)" }}>
                  {connected ? "ONLINE · SOLANA" : "NO WALLET"}
                </span>
              </div>

              <button className="scan-btn">
                <span className="ms" style={{ fontSize:15, color:"inherit" }}>radar</span>
                INITIATE SCAN
              </button>
            </div>

            {/* Nav items */}
            <nav style={{ flex:1 }}>
              {NAV_ITEMS.map(({ icon, label, path }) => (
                <div key={label} className={`nav-item${path === "/chat" ? " active" : ""}`}
                  onClick={() => router.push(path)}>
                  <span className="nav-icon">{icon}</span>
                  <span className="nav-label">{label}</span>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div style={{ borderTop:"1px solid rgba(255,185,60,.06)", paddingTop:8 }}>
              <div className="nav-item" onClick={() => router.push("/diagnostics")}>
                <span className="nav-icon">terminal</span>
                <span className="nav-label">Diagnostics</span>
              </div>
              {connected && (
                <div className="nav-item" onClick={() => disconnect()}
                  style={{ color:"rgba(255,120,100,.4)" }}>
                  <span className="nav-icon" style={{ color:"rgba(255,120,100,.4)" }}>power_settings_new</span>
                  <span className="nav-label" style={{ color:"rgba(255,120,100,.45)" }}>Disconnect</span>
                </div>
              )}
            </div>
          </aside>

          {/* ══ MAIN CHAT ════════════════════════════════════════════════════ */}
          <main className="chat-bg" style={{
            flex:1, display:"flex", flexDirection:"column",
            height:"100%", overflow:"hidden", minWidth:0,
            position:"relative",
          }}>
            {/* Page header */}
            <div style={{ padding:"20px 28px 0", flexShrink:0 }}>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem", fontWeight:600,
                letterSpacing:".4em", textTransform:"uppercase", color:"rgba(255,185,60,.45)", marginBottom:6 }}>
                PHASE 04 // DEPLOYMENT
              </p>
              <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:4 }}>
                <h1 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, fontSize:"clamp(2rem,4vw,3.2rem)",
                  letterSpacing:"-.02em", color:"rgba(229,226,225,.9)", lineHeight:1 }}>
                  Oracle{" "}
                  <span style={{
                    background:"linear-gradient(135deg,#FFD060,#F59E0B 55%,#D97706)",
                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                    textShadow:"none",
                  }}>Command</span>
                </h1>
              </div>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".65rem",
                color:"rgba(229,226,225,.28)", letterSpacing:".04em", marginBottom:0 }}>
                Agent active ·{" "}
                {walletAddress
                  ? <span style={{ color:"rgba(255,185,60,.45)" }}>{walletAddress.slice(0,8)}…{walletAddress.slice(-6)} connected</span>
                  : <span style={{ color:"rgba(255,100,80,.4)" }}>No wallet connected</span>
                }
              </p>
              {/* Hairline */}
              <div style={{ height:1, marginTop:14,
                background:"linear-gradient(90deg,transparent,rgba(255,185,60,.15),transparent)" }} />
            </div>

            {/* Chat window — scrollable */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 28px", display:"flex", flexDirection:"column", gap:20 }}>
              <ChatWindow messages={messages as unknown as Parameters<typeof ChatWindow>[0]["messages"]} isLoading={isLoading} />
              <div ref={chatBottom} />
            </div>

            {/* Suggestion chips — only when no messages */}
            {messages.length === 0 && (
              <div style={{ padding:"0 28px 14px", display:"flex", gap:7, flexWrap:"wrap" }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="chip" onClick={() => handleSuggestion(s)}>
                    <span style={{ color:"rgba(255,185,60,.4)", fontSize:".6rem", lineHeight:1 }}>›</span>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Chat input bar */}
            <div style={{
              flexShrink:0, padding:"10px 28px 14px",
              borderTop:"1px solid rgba(255,185,60,.06)",
              background:"rgba(6,3,0,.6)", backdropFilter:"blur(20px)",
            }}>
              <form onSubmit={handleSend} style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want to do with your crypto…"
                  rows={1}
                  disabled={isLoading}
                  style={{ flex:1, padding:"12px 16px", minHeight:46, maxHeight:140 }}
                />
                <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
                  {isLoading
                    ? <span style={{ width:16, height:16, border:"2px solid rgba(26,12,0,.3)",
                        borderTop:"2px solid rgba(26,12,0,.9)", borderRadius:"50%",
                        display:"inline-block", animation:"spin .8s linear infinite" }} />
                    : <span className="ms" style={{ fontSize:18, color:"#150800", fontVariationSettings:"'FILL' 1,'wght' 500,'GRAD' 0,'opsz' 24" }}>send</span>
                  }
                </button>
              </form>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".4rem", fontWeight:600,
                letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,215,150,.16)",
                textAlign:"center", marginTop:8 }}>
                DOMINUS NEVER EXECUTES WITHOUT YOUR EXPLICIT CONFIRMATION
              </p>
            </div>
          </main>

          {/* ══ RIGHT PANEL — dynamic, replaces static Neural Feedback etc ══ */}
          <div style={{
            width: 300, flexShrink:0, height:"100%", overflowY:"auto",
            borderLeft:"1px solid rgba(255,185,60,.07)",
            background:"rgba(4,2,0,.65)", backdropFilter:"blur(16px)",
          }}>
            <RightPanel
              walletAddress={walletAddress || undefined}
              activityLog={activityLog}
            />
          </div>

        </div>

        {/* ══ STATUS BAR ═══════════════════════════════════════════════════ */}
        <div className="status-bar" style={{
          height:36, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 1.4rem",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#FFC060",
                boxShadow:"0 0 7px rgba(255,185,60,.95)", display:"inline-block",
                animation:"blink 2.9s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
                letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,210,130,.34)" }}>
                CORE PRIME CONNECTED
              </span>
            </div>
            <div style={{ width:1, height:10, background:"rgba(255,180,50,.12)" }} />
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
              letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,210,130,.28)" }}>
              {llmConfig?.mode === "ollama"
                ? `OLLAMA — ${(llmConfig.ollamaModel ?? "llama3.1:8b").toUpperCase()}`
                : llmConfig?.mode === "api"
                  ? `${llmConfig.provider?.toUpperCase() ?? "API"} — ${llmConfig.model || "DEFAULT"}`
                  : "OLLAMA — LLAMA3.1:8B"}
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
              letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,215,140,.2)" }}>
              {network}
            </span>
            <div style={{ width:1, height:10, background:"rgba(255,180,50,.12)" }} />
            <div style={{ display:"flex", gap:3, alignItems:"center" }}>
              {[22,9,16].map((w,i) => (
                <div key={i} style={{ width:w, height:2, borderRadius:1,
                  background: i!==1 ? "rgba(255,185,60,.6)" : "rgba(255,185,60,.16)",
                  boxShadow: i!==1 ? "0 0 4px rgba(245,158,11,.4)" : "none" }} />
              ))}
            </div>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
              letterSpacing:".16em", textTransform:"uppercase", color:"rgba(255,210,130,.28)" }}>
              V2.4.9-SECURE
            </span>
          </div>
        </div>

      </div>

      {/* ══ LLM SETTINGS PANEL ════════════════════════════════════════════ */}
      <LLMSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(cfg) => { setLlmConfig(cfg); setSettingsOpen(false) }}
      />
    </>
  )
}

function pad(n: number) { return n.toString().padStart(2, "0") }
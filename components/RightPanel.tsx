"use client"

// components/RightPanel.tsx
// Live clock, Solana network metrics, activity log, wallet stats

import { useState, useEffect, useRef } from "react"

interface RightPanelProps {
  walletAddress?: string
  activityLog?: Array<{ time: string; message: string }>
}

type Metric = { label: string; value: string; unit: string; trend: "up"|"down"|"flat" }

function pad(n: number) { return n.toString().padStart(2, "0") }

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return now
}

function useUptime() {
  const start = useRef(Date.now())
  const [uptime, setUptime] = useState(0)
  useEffect(() => { const t = setInterval(() => setUptime(Math.floor((Date.now() - start.current) / 1000)), 1000); return () => clearInterval(t) }, [])
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const ACTIVITY_POOL = [
  "Jupiter price feed refreshed",
  "Kamino market rates updated",
  "Jito MEV bundle captured",
  "Solana slot advanced",
  "Helius RPC latency: 18ms",
  "Wallet balance synced",
  "Jupiter route cache updated",
  "Jito tip distribution complete",
  "Kamino utilization: 78.4%",
  "Streamflow epoch tick",
  "SOL price updated",
  "Aether memory compacted",
  "Portfolio snapshot saved",
  "RPC health check: OK",
]

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const W = 76, H = 22, p = 2
  const pts = data.map((v, i) => {
    const x = p + (i / (data.length - 1)) * (W - p * 2)
    const y = H - p - ((v - min) / range) * (H - p * 2)
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.12} />
    </svg>
  )
}

export default function RightPanel({ walletAddress, activityLog = [] }: RightPanelProps) {
  const now    = useNow()
  const uptime = useUptime()

  const [metrics, setMetrics] = useState<Metric[]>([
    { label:"TPS",        value:"3,842",       unit:"tx/s", trend:"up"   },
    { label:"SLOT",       value:"284,921,104", unit:"",     trend:"up"   },
    { label:"LATENCY",    value:"18",          unit:"ms",   trend:"flat" },
    { label:"BLOCK TIME", value:"0.41",        unit:"s",    trend:"flat" },
  ])

  const [solPrice,  setSolPrice]  = useState(84.02)
  const [priceHist, setPriceHist] = useState<number[]>(() =>
    Array.from({ length: 20 }, (_, i) => 83.5 + Math.sin(i * 0.4) * 0.8 + Math.random() * 0.3)
  )
  const [feed, setFeed] = useState<Array<{ t: string; msg: string }>>([])
  const [agentMem, setAgentMem] = useState({ contexts: 4, tokens: 2847, cache: 68 })

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(prev => prev.map(m => {
        if (m.label === "TPS") {
          const v = Math.round(3800 + (Math.random() - 0.5) * 600)
          return { ...m, value: v.toLocaleString(), trend: v > 3800 ? "up" : "down" }
        }
        if (m.label === "SLOT") {
          const v = parseInt(m.value.replace(/,/g, "")) + Math.floor(Math.random() * 3 + 1)
          return { ...m, value: v.toLocaleString() }
        }
        if (m.label === "LATENCY") {
          const v = Math.round(20 + (Math.random() - 0.5) * 16)
          return { ...m, value: v.toString(), trend: v < 25 ? "up" : "down" }
        }
        return m
      }))
    }, 2400)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setSolPrice(prev => {
        const next = parseFloat((prev + (Math.random() - 0.48) * 0.18).toFixed(2))
        setPriceHist(h => [...h.slice(-19), next])
        return next
      })
    }, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const addEntry = () => {
      const msg = ACTIVITY_POOL[Math.floor(Math.random() * ACTIVITY_POOL.length)]
      const d = new Date()
      const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      setFeed(prev => [{ t, msg }, ...prev].slice(0, 24))
    }
    addEntry()
    const id = setInterval(addEntry, 3500 + Math.random() * 2500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (activityLog.length > 0) {
      const last = activityLog[activityLog.length - 1]
      setFeed(prev => [{ t: last.time, msg: last.message }, ...prev].slice(0, 24))
    }
  }, [activityLog.length])

  useEffect(() => {
    const t = setInterval(() => {
      setAgentMem(prev => ({
        contexts: prev.contexts,
        tokens: Math.min(8192, prev.tokens + Math.floor(Math.random() * 6)),
        cache: Math.min(100, prev.cache + (Math.random() > 0.75 ? 1 : 0)),
      }))
    }, 4000)
    return () => clearInterval(t)
  }, [])

  const timeStr    = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const dateStr    = now.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })
  const priceUp    = priceHist.length > 1 && priceHist[priceHist.length-1] >= priceHist[priceHist.length-2]
  const memPct     = Math.round((agentMem.tokens / 8192) * 100)

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", gap:1, overflow:"hidden" }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.12}}
        @keyframes slideIn{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}
        .rp-entry{animation:slideIn .3s cubic-bezier(.22,1,.36,1) both}
        .rp-metric:hover{border-color:rgba(245,158,11,.15)!important;background:rgba(255,255,255,.03)!important}
      `}</style>

      {/* Scrollable content */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:1, padding:"10px 10px 10px 8px" }}>

        {/* ── Clock ── */}
        <Section>
          <Row>
            <Label>SYSTEM CLOCK</Label>
            <LiveDot />
          </Row>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:"1.5rem", fontWeight:700,
            letterSpacing:"-.01em", color:"#F59E0B", margin:"6px 0 6px",
            textShadow:"0 0 16px rgba(245,158,11,.35)" }}>{timeStr}</p>
          <Row>
            <Micro>{dateStr}</Micro>
            <Micro>UP {uptime}</Micro>
          </Row>
        </Section>

        {/* ── SOL price ── */}
        <Section>
          <Row>
            <Label>SOL / USD</Label>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
              letterSpacing:".12em", color: priceUp ? "rgba(34,197,94,.7)" : "rgba(248,113,113,.7)" }}>
              {priceUp ? "▲" : "▼"} LIVE
            </span>
          </Row>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginTop:6 }}>
            <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.4rem", fontWeight:400, margin:0,
              color: priceUp ? "rgba(34,197,94,.9)" : "rgba(248,113,113,.9)" }}>
              ${solPrice.toFixed(2)}
            </p>
            <Sparkline data={priceHist} color={priceUp ? "rgba(34,197,94,.7)" : "rgba(248,113,113,.7)"} />
          </div>
        </Section>

        {/* ── Network metrics ── */}
        <Section>
          <Label style={{ display:"block", marginBottom:8 }}>SOLANA NETWORK</Label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {metrics.map(m => (
              <div key={m.label} className="rp-metric" style={{
                padding:"8px 10px", background:"rgba(0,0,0,.3)",
                border:"1px solid rgba(255,255,255,.05)", borderRadius:6, transition:"all .2s",
              }}>
                <Micro style={{ color:"#3F3F46" }}>{m.label}</Micro>
                <div style={{ display:"flex", alignItems:"baseline", gap:3, marginTop:4 }}>
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem",
                    fontWeight:700, color:"#F2F0EC", letterSpacing:"-.01em" }}>{m.value}</span>
                  {m.unit && <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".4rem",
                    color:"#3F3F46", letterSpacing:".1em" }}>{m.unit}</span>}
                </div>
                <span style={{ fontSize:".44rem", marginTop:3, display:"block",
                  color: m.trend==="up" ? "rgba(34,197,94,.5)" : m.trend==="down" ? "rgba(248,113,113,.5)" : "#3F3F46" }}>
                  {m.trend==="up" ? "▲" : m.trend==="down" ? "▼" : "—"}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Aether status ── */}
        <Section>
          <Label style={{ display:"block", marginBottom:10 }}>AETHER-01 STATUS</Label>
          {[
            { label:"CONTEXT WINDOW", val:agentMem.tokens, max:8192, pct:memPct,         color:"rgba(96,165,250,.8)" },
            { label:"RESPONSE CACHE",  val:agentMem.cache,  max:100,  pct:agentMem.cache, color:"rgba(34,197,94,.8)"  },
            { label:"ACTIVE CONTEXTS", val:agentMem.contexts, max:8, pct:Math.round(agentMem.contexts/8*100), color:"rgba(245,158,11,.8)" },
          ].map(({ label, val, max, color, pct }) => (
            <div key={label} style={{ marginBottom:9 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <Micro style={{ color:"#3F3F46" }}>{label}</Micro>
                <Micro style={{ color, fontWeight:700 }}>
                  {max > 100 ? val.toLocaleString() : val} <span style={{ opacity:.4 }}>/ {max > 100 ? max.toLocaleString() : max}</span>
                </Micro>
              </div>
              <div style={{ height:2, background:"rgba(255,255,255,.04)", borderRadius:1, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,pct)}%`, borderRadius:1,
                  background:`linear-gradient(90deg, ${color.replace(".8","0.35")}, ${color})`,
                  transition:"width .6s ease" }} />
              </div>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,.04)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(34,197,94,.9)",
                boxShadow:"0 0 5px rgba(34,197,94,.7)", display:"inline-block", animation:"blink 2.8s ease-in-out infinite" }} />
              <Micro style={{ color:"rgba(34,197,94,.5)" }}>AGENT ACTIVE</Micro>
            </div>
            <Micro style={{ color:"#3F3F46" }}>LLAMA3.1:8B</Micro>
          </div>
        </Section>

        {/* ── Activity log ── */}
        <Section style={{ flex:1, minHeight:0 }}>
          <Row style={{ marginBottom:8 }}>
            <Label>ACTIVITY LOG</Label>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:4, height:4, borderRadius:"50%", background:"rgba(245,158,11,.7)",
                display:"inline-block", animation:"blink 1.8s ease-in-out infinite" }} />
              <Micro style={{ color:"rgba(245,158,11,.35)" }}>{feed.length} EVENTS</Micro>
            </div>
          </Row>
          <div style={{ overflowY:"auto", maxHeight:170, display:"flex", flexDirection:"column", gap:4 }}>
            {feed.map((item, i) => (
              <div key={i} className="rp-entry" style={{
                display:"flex", gap:8, alignItems:"flex-start",
                padding:"5px 7px", borderRadius:5,
                background: i === 0 ? "rgba(245,158,11,.04)" : "transparent",
                border: i === 0 ? "1px solid rgba(245,158,11,.07)" : "1px solid transparent",
              }}>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".4rem",
                  fontWeight:700, color:"rgba(245,158,11,.35)", flexShrink:0, marginTop:1 }}>{item.t}</span>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem",
                  color: i === 0 ? "rgba(242,240,236,.5)" : "rgba(242,240,236,.22)",
                  lineHeight:1.45, letterSpacing:".02em" }}>{item.msg}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Wallet ── */}
        {walletAddress && (
          <Section>
            <Label style={{ display:"block", marginBottom:8 }}>CONNECTED WALLET</Label>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
              background:"rgba(0,0,0,.3)", borderRadius:7, border:"1px solid rgba(245,158,11,.08)" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                background:"linear-gradient(135deg,#FCD34D,#F59E0B)",
                boxShadow:"0 0 7px rgba(245,158,11,.6)" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem",
                color:"rgba(245,158,11,.6)", letterSpacing:".06em", wordBreak:"break-all" }}>
                {walletAddress.slice(0,8)}…{walletAddress.slice(-6)}
              </span>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ── Small shared sub-components ───────────────────────────────────────────────

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:"#111116", borderRadius:8, padding:"12px 12px",
      border:"1px solid rgba(255,255,255,.05)", position:"relative", overflow:"hidden", ...style }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)" }} />
      {children}
    </div>
  )
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", ...style }}>{children}</div>
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:700,
      letterSpacing:".26em", textTransform:"uppercase", color:"rgba(245,158,11,.35)", ...style }}>
      {children}
    </span>
  )
}

function Micro({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:500,
      letterSpacing:".14em", textTransform:"uppercase", ...style }}>
      {children}
    </span>
  )
}

function LiveDot() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:"#22C55E",
        boxShadow:"0 0 5px rgba(34,197,94,.8)", display:"inline-block", animation:"blink 2.1s ease-in-out infinite" }} />
      <Micro style={{ color:"rgba(34,197,94,.45)" }}>LIVE</Micro>
    </div>
  )
}
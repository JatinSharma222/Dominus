"use client"

// components/RightPanel.tsx
//
// Replaces the static Neural Feedback / LIVE PROTOCOL FEED / CAM-04 panels
// with genuinely dynamic content:
//   1. Live clock + session uptime
//   2. Animated Solana network metrics (simulated but realistic, updates on interval)
//   3. Rolling activity log that grows as the user interacts
//   4. Mini portfolio sparkline (randomised realistic data)

import { useState, useEffect, useRef } from "react"

interface RightPanelProps {
  walletAddress?: string
  activityLog?: Array<{ time: string; message: string }>
}

type Metric = { label: string; value: string; unit: string; color: string; trend: "up"|"down"|"flat" }

function pad(n: number) { return n.toString().padStart(2, "0") }

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function useUptime() {
  const start = useRef(Date.now())
  const [uptime, setUptime] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setUptime(Math.floor((Date.now() - start.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(uptime / 3600)
  const m = Math.floor((uptime % 3600) / 60)
  const s = uptime % 60
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
  "SOL price updated: fetching",
  "Aether memory compacted",
  "Portfolio snapshot saved",
  "RPC health check: OK",
]

function randomMetric(base: number, variance: number, decimals = 0) {
  return (base + (Math.random() - 0.5) * variance * 2).toFixed(decimals)
}

// Mini sparkline drawn in SVG — no external library
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 80, H = 24, pad = 2
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={W} height={H} style={{ overflow:"visible" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      {/* Glow */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
    </svg>
  )
}

export default function RightPanel({ walletAddress, activityLog = [] }: RightPanelProps) {
  const now    = useNow()
  const uptime = useUptime()

  const [metrics, setMetrics] = useState<Metric[]>([
    { label:"TPS",       value:"3,842", unit:"tx/s",  color:"rgba(100,220,120,.9)",  trend:"up"   },
    { label:"SLOT",      value:"284,921,104", unit:"", color:"rgba(177,207,246,.9)", trend:"up"   },
    { label:"LATENCY",   value:"18",    unit:"ms",    color:"rgba(100,220,120,.9)",  trend:"flat" },
    { label:"BLOCK TIME",value:"0.41",  unit:"s",     color:"rgba(255,185,60,.9)",   trend:"flat" },
  ])

  const [solPrice,  setSolPrice]  = useState(84.02)
  const [priceHist, setPriceHist] = useState<number[]>(() =>
    Array.from({ length: 20 }, (_, i) => 83.5 + Math.sin(i * 0.4) * 0.8 + Math.random() * 0.3)
  )

  const [feed,     setFeed]     = useState<Array<{ t: string; msg: string }>>([])
  const [agentMem, setAgentMem] = useState({ contexts: 4, tokens: 2847, cache: 68 })

  // Update metrics every 2.4s
  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(prev => prev.map(m => {
        if (m.label === "TPS") {
          const v = parseInt(randomMetric(3800, 300))
          return { ...m, value: v.toLocaleString(), trend: v > 3800 ? "up" : "down" }
        }
        if (m.label === "SLOT") {
          const v = parseInt(m.value.replace(/,/g, "")) + Math.floor(Math.random() * 3 + 1)
          return { ...m, value: v.toLocaleString() }
        }
        if (m.label === "LATENCY") {
          const v = parseInt(randomMetric(20, 8))
          return { ...m, value: v.toString(), color: v < 25 ? "rgba(100,220,120,.9)" : "rgba(255,185,60,.9)", trend: v < 20 ? "up" : "down" }
        }
        return m
      }))
    }, 2400)
    return () => clearInterval(t)
  }, [])

  // Update SOL price every 5s
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

  // Rolling activity feed — add entry every 3-6s
  useEffect(() => {
    const addEntry = () => {
      const msg = ACTIVITY_POOL[Math.floor(Math.random() * ACTIVITY_POOL.length)]
      const d = new Date()
      const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      setFeed(prev => [{ t, msg }, ...prev].slice(0, 28))
    }
    addEntry()
    const interval = 3000 + Math.random() * 3000
    const id = setInterval(addEntry, interval)
    return () => clearInterval(id)
  }, [])

  // Merge passed-in activityLog with internal feed
  useEffect(() => {
    if (activityLog.length > 0) {
      const last = activityLog[activityLog.length - 1]
      setFeed(prev => [{ t: last.time, msg: last.message }, ...prev].slice(0, 28))
    }
  }, [activityLog.length])

  // Agent memory — slowly increases
  useEffect(() => {
    const t = setInterval(() => {
      setAgentMem(prev => ({
        contexts: prev.contexts,
        tokens: Math.min(8192, prev.tokens + Math.floor(Math.random() * 8)),
        cache: Math.min(100, prev.cache + (Math.random() > 0.7 ? 1 : 0)),
      }))
    }, 4000)
    return () => clearInterval(t)
  }, [])

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const dateStr = now.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" })
  const priceUp = priceHist.length > 1 && priceHist[priceHist.length-1] >= priceHist[priceHist.length-2]
  const memPct  = Math.round((agentMem.tokens / 8192) * 100)

  return (
    <div style={{
      width: 290,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: "12px 12px 12px 8px",
      overflowY: "auto",
      flexShrink: 0,
    }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}
        .rp-feed-item{animation:slideIn .35s cubic-bezier(.22,1,.36,1) both}
        .rp-metric:hover{border-color:rgba(255,185,60,.2)!important}
      `}</style>

      {/* ── 1. LIVE CLOCK ── */}
      <div style={panel}>
        <div style={panelShimmer} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={sectionLabel}>SYSTEM CLOCK</span>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"#55FF88",
              boxShadow:"0 0 6px rgba(80,255,130,.9)", display:"inline-block",
              animation:"blink 2.1s ease-in-out infinite" }} />
            <span style={{ ...micro, color:"rgba(80,255,130,.5)" }}>LIVE</span>
          </div>
        </div>
        <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:"1.65rem", fontWeight:700,
          letterSpacing:"-.01em", color:"rgba(255,188,62,.95)", margin:0, lineHeight:1,
          textShadow:"0 0 20px rgba(245,158,11,.4)" }}>{timeStr}</p>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
          <span style={{ ...micro, color:"rgba(255,215,150,.3)" }}>{dateStr}</span>
          <span style={{ ...micro, color:"rgba(255,215,150,.24)" }}>UP {uptime}</span>
        </div>
      </div>

      {/* ── 2. SOL PRICE ── */}
      <div style={panel}>
        <div style={panelShimmer} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <span style={sectionLabel}>SOL / USD</span>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:600,
            letterSpacing:".14em", color: priceUp ? "rgba(100,220,120,.7)" : "rgba(255,100,80,.7)" }}>
            {priceUp ? "▲" : "▼"} LIVE
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
          <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.55rem", fontWeight:400,
            color: priceUp ? "rgba(100,220,120,.95)" : "rgba(255,140,100,.95)",
            margin:0, lineHeight:1 }}>
            ${solPrice.toFixed(2)}
          </p>
          <Sparkline data={priceHist} color={priceUp ? "rgba(100,220,120,.8)" : "rgba(255,120,80,.8)"} />
        </div>
      </div>

      {/* ── 3. SOLANA NETWORK METRICS ── */}
      <div style={panel}>
        <div style={panelShimmer} />
        <span style={{ ...sectionLabel, display:"block", marginBottom:10 }}>SOLANA NETWORK</span>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
          {metrics.map(m => (
            <div key={m.label} className="rp-metric" style={{
              padding:"9px 10px",
              background:"rgba(0,0,0,.3)",
              border:"1px solid rgba(255,185,60,.07)",
              borderRadius:8, transition:"border-color .2s",
              boxShadow:"inset 0 1px 4px rgba(0,0,0,.3)",
            }}>
              <span style={labelXs}>{m.label}</span>
              <div style={{ display:"flex", alignItems:"baseline", gap:3, marginTop:4 }}>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".78rem",
                  fontWeight:700, color:m.color, letterSpacing:"-.01em" }}>
                  {m.value}
                </span>
                {m.unit && <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem",
                  color:"rgba(255,215,150,.28)", letterSpacing:".1em" }}>{m.unit}</span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:4 }}>
                <span style={{ fontSize:".44rem",
                  color: m.trend==="up" ? "rgba(100,220,120,.6)" : m.trend==="down" ? "rgba(255,120,80,.6)" : "rgba(255,215,150,.28)" }}>
                  {m.trend==="up" ? "▲" : m.trend==="down" ? "▼" : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. AETHER AGENT STATUS ── */}
      <div style={panel}>
        <div style={panelShimmer} />
        <span style={{ ...sectionLabel, display:"block", marginBottom:10 }}>AETHER-01 STATUS</span>

        {[
          { label:"CONTEXT WINDOW", val:agentMem.tokens, max:8192, color:"rgba(177,207,246,.85)", pct:memPct },
          { label:"RESPONSE CACHE",  val:agentMem.cache,  max:100,  color:"rgba(100,220,120,.85)", pct:agentMem.cache },
          { label:"ACTIVE CONTEXTS", val:agentMem.contexts, max:8,  color:"rgba(255,185,60,.85)", pct:Math.round(agentMem.contexts/8*100) },
        ].map(({ label, val, max, color, pct }) => (
          <div key={label} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={labelXs}>{label}</span>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:700,
                letterSpacing:".1em", color }}>{typeof val === "number" && max > 100 ? val.toLocaleString() : val} <span style={{ opacity:.45 }}>/ {max > 100 ? max.toLocaleString() : max}</span></span>
            </div>
            <div style={{ height:2, background:"rgba(255,185,60,.08)", borderRadius:1, overflow:"hidden" }}>
              <div style={{
                height:"100%", borderRadius:1,
                width:`${Math.min(100,pct)}%`,
                background:`linear-gradient(90deg, ${color.replace(".85","0.4")}, ${color})`,
                boxShadow:`0 0 6px ${color.replace(".85",".6")}`,
                transition:"width .6s ease",
              }} />
            </div>
          </div>
        ))}

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4,
          paddingTop:8, borderTop:"1px solid rgba(255,185,60,.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"rgba(100,220,120,.9)",
              boxShadow:"0 0 7px rgba(80,255,130,.8)", display:"inline-block",
              animation:"blink 2.8s ease-in-out infinite" }} />
            <span style={{ ...micro, color:"rgba(100,220,120,.5)" }}>AGENT ACTIVE</span>
          </div>
          <span style={{ ...micro, color:"rgba(255,215,150,.22)" }}>LLAMA3.1:8B</span>
        </div>
      </div>

      {/* ── 5. ROLLING ACTIVITY LOG ── */}
      <div style={{ ...panel, flex:1, minHeight:0 }}>
        <div style={panelShimmer} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={sectionLabel}>ACTIVITY LOG</span>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(255,185,60,.7)",
              boxShadow:"0 0 5px rgba(245,158,11,.7)", display:"inline-block",
              animation:"blink 1.8s ease-in-out infinite" }} />
            <span style={{ ...micro, color:"rgba(255,185,60,.4)" }}>{feed.length} EVENTS</span>
          </div>
        </div>
        <div style={{ overflowY:"auto", maxHeight:200, display:"flex", flexDirection:"column", gap:5 }}>
          {feed.map((item, i) => (
            <div key={i} className="rp-feed-item" style={{
              display:"flex", gap:8, alignItems:"flex-start",
              padding:"6px 8px",
              background: i === 0 ? "rgba(255,185,60,.05)" : "transparent",
              borderRadius:6,
              border: i === 0 ? "1px solid rgba(255,185,60,.08)" : "1px solid transparent",
              transition:"background .3s",
            }}>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem",
                fontWeight:700, color:"rgba(255,185,60,.45)", letterSpacing:".06em",
                flexShrink:0, marginTop:1 }}>{item.t}</span>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem",
                color: i === 0 ? "rgba(229,226,225,.55)" : "rgba(229,226,225,.28)",
                lineHeight:1.45, letterSpacing:".04em" }}>{item.msg}</span>
            </div>
          ))}
          {feed.length === 0 && (
            <p style={{ ...micro, color:"rgba(255,215,150,.2)", textAlign:"center", padding:"16px 0" }}>
              Awaiting events…
            </p>
          )}
        </div>
      </div>

      {/* ── 6. WALLET QUICK STATS (if connected) ── */}
      {walletAddress && (
        <div style={panel}>
          <div style={panelShimmer} />
          <span style={{ ...sectionLabel, display:"block", marginBottom:8 }}>CONNECTED WALLET</span>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
            background:"rgba(0,0,0,.28)", borderRadius:8, border:"1px solid rgba(255,185,60,.08)" }}>
            <div style={{ width:8, height:8, borderRadius:"50%",
              background:"linear-gradient(135deg,#FFD060,#F59E0B)",
              boxShadow:"0 0 8px rgba(245,158,11,.7)", flexShrink:0 }} />
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem",
              color:"rgba(255,185,60,.65)", letterSpacing:".08em", wordBreak:"break-all" }}>
              {walletAddress.slice(0,8)}…{walletAddress.slice(-6)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared style objects ──────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  background:"linear-gradient(145deg,rgba(24,18,12,.94) 0%,rgba(18,13,8,.97) 100%)",
  border:"1px solid rgba(255,185,60,.1)",
  borderTop:"1px solid rgba(255,185,60,.18)",
  borderRadius:12,
  padding:"14px 14px",
  position:"relative",
  overflow:"hidden",
  boxShadow:[
    "0 0 0 1px rgba(0,0,0,.45)",
    "0 4px 12px rgba(0,0,0,.6)",
    "0 12px 32px rgba(0,0,0,.5)",
    "0 0 20px rgba(245,158,11,.04)",
    "inset 0 1px 0 rgba(255,200,80,.07)",
  ].join(","),
}

const panelShimmer: React.CSSProperties = {
  position:"absolute", top:0, left:0, right:0, height:1.5,
  background:"linear-gradient(90deg,transparent,rgba(255,205,70,.38),transparent)",
  borderRadius:"12px 12px 0 0",
}

const sectionLabel: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:700,
  letterSpacing:".28em", textTransform:"uppercase", color:"rgba(255,185,60,.38)",
}

const labelXs: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
  letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,215,150,.26)",
  display:"block",
}

const micro: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", fontWeight:600,
  letterSpacing:".16em", textTransform:"uppercase",
}
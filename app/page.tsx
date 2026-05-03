"use client"

import { useEffect, useState, useRef } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useRouter } from "next/navigation"

const GATE_BG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD0DyECvfMshIBB_dQU2p7bwdv_6ciBkR_fClpDFWWyuX3T3LrbaOwAuFm9R-DYe0yvgKJsCHZrHbjdbyVku3ne6V7justI9SrkT88q4MMJXwVHLGqoyaCqUAKIiYDtQAFc9kfWsgNfN3baZDZ00gvgTbjEPke_NBcSxl-Y5yw9FCEoKk7y3EQ_FeIAMBCVHJNuOTfK0tQ5kWy26klZjWFr5n2fv_SGMcQSFse2FjSvnWHZRTAU8P47wGGv0NrgzLd5PPtp007K4f2G"

export default function LandingPage() {
  const { connected } = useWallet()
  const { setVisible } = useWalletModal()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [epoch, setEpoch] = useState(1492.0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (connected) router.push("/chat") }, [connected, router])

  // Animated epoch counter
  useEffect(() => {
    const id = setInterval(() => setEpoch((p) => parseFloat((p + 0.01).toFixed(2))), 80)
    return () => clearInterval(id)
  }, [])

  // Floating particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize)
    type Particle = { x: number; y: number; r: number; vx: number; vy: number; alpha: number }
    const pts: Particle[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(Math.random() * 0.35 + 0.08),
      alpha: Math.random() * 0.35 + 0.05,
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach((p) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245,158,11,${p.alpha})`; ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width }
        if (p.x < -10) p.x = canvas.width + 10
        if (p.x > canvas.width + 10) p.x = -10
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])

  if (!mounted) return <div style={{ background: "#050302", width: "100vw", height: "100vh" }} />

  const fmtEpoch = `${epoch.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.ALPHA`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .msym { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; line-height:1; font-family:'Material Symbols Outlined'; }
        .hud-grid {
          background-size:32px 32px;
          background-image:
            linear-gradient(to right,rgba(160,142,122,0.065) 1px,transparent 1px),
            linear-gradient(to bottom,rgba(160,142,122,0.065) 1px,transparent 1px);
        }
        .vig { background:radial-gradient(ellipse 90% 85% at 50% 50%,transparent 35%,rgba(4,2,1,0.82) 100%); }

        @keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.88}94%{opacity:1}97%{opacity:.92}98%{opacity:1}}
        @keyframes scan{0%{top:-4px}100%{top:calc(100vh + 4px)}}
        @keyframes blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}
        @keyframes glow{0%,100%{text-shadow:0 0 40px rgba(245,158,11,.42),0 0 90px rgba(245,158,11,.16),0 0 150px rgba(245,158,11,.06)}50%{text-shadow:0 0 55px rgba(245,158,11,.62),0 0 110px rgba(245,158,11,.24),0 0 180px rgba(245,158,11,.1)}}
        @keyframes rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes borderShimmer{0%,100%{opacity:.55}50%{opacity:1}}

        .glow-text{animation:glow 4.5s ease-in-out infinite}
        .r0{animation:rise .9s ease-out both}
        .r1{animation:rise .9s ease-out .15s both}
        .r2{animation:rise .9s ease-out .3s both}
        .r3{animation:rise .9s ease-out .5s both}
        .r4{animation:rise .9s ease-out .7s both}

        .cta{
          position:relative;display:inline-flex;align-items:center;justify-content:center;
          padding:1.1rem 3.8rem;
          font-family:'Space Grotesk',sans-serif;font-size:.72rem;font-weight:700;
          letter-spacing:.28em;text-transform:uppercase;
          color:#2A1500;
          background:linear-gradient(140deg,#FFD08A 0%,#FFC174 25%,#F59E0B 65%,#D97706 100%);
          border-radius:2px;border:none;cursor:pointer;overflow:hidden;
          box-shadow:0 0 40px rgba(245,158,11,.55),0 0 80px rgba(245,158,11,.18),inset 0 1px 0 rgba(255,255,255,.3),inset 0 -1px 0 rgba(0,0,0,.15);
          transition:transform .15s ease,box-shadow .25s ease;
          text-shadow:0 1px 0 rgba(255,255,255,.2);
        }
        .cta::before{
          content:'';position:absolute;inset:-3px;border:1px solid rgba(255,193,116,.5);
          border-radius:3px;filter:blur(3px);pointer-events:none;
          animation:borderShimmer 3.5s ease-in-out infinite;
        }
        .cta::after{content:'';position:absolute;inset:0;background:transparent;transition:background .2s}
        .cta:hover{transform:scale(1.04);box-shadow:0 0 60px rgba(245,158,11,.7),0 0 110px rgba(245,158,11,.25),inset 0 1px 0 rgba(255,255,255,.3),inset 0 -1px 0 rgba(0,0,0,.15)}
        .cta:hover::after{background:rgba(255,255,255,.12)}
        .cta:active{transform:scale(.97)}

        .ghost{
          font-family:'Space Grotesk',sans-serif;font-size:.6rem;font-weight:500;
          letter-spacing:.25em;text-transform:uppercase;
          color:rgba(229,226,225,.28);background:none;border:none;
          border-bottom:1px solid transparent;padding-bottom:2px;cursor:pointer;
          transition:color .2s,border-color .2s;
        }
        .ghost:hover{color:rgba(255,193,116,.7);border-bottom-color:rgba(255,193,116,.28)}

        .nav-a{
          font-family:'Space Grotesk',sans-serif;font-size:.68rem;font-weight:700;
          letter-spacing:.18em;text-transform:uppercase;
          color:rgba(229,226,225,.5);text-decoration:none;background:none;border:none;
          padding-bottom:3px;border-bottom:1.5px solid transparent;
          transition:color .2s,border-color .2s;cursor:pointer;
        }
        .nav-a.active{color:#F59E0B;border-bottom-color:#F59E0B}
        .nav-a:hover{color:rgba(255,193,116,.85)}

        .hl{font-family:'Space Grotesk',sans-serif;font-size:.52rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(229,226,225,.26);margin-bottom:3px;display:block}
        .hv{font-family:'Space Grotesk',sans-serif;font-size:.68rem;font-weight:700;letter-spacing:.15em;color:rgba(255,193,116,.72)}

        .sb-txt{font-family:'Space Grotesk',sans-serif;font-size:.52rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(229,226,225,.38)}
      `}</style>

      <div style={{ position:"fixed", inset:0, background:"#050302", overflow:"hidden" }}>

        {/* Sides fill — visible when image doesn't cover full width */}
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse 130% 100% at 50% 60%, #1a0c02 0%, #050302 60%)",
        }} />

        {/* Gate image */}
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:`url('${GATE_BG}')`,
          backgroundSize:"85% auto",
          backgroundPosition:"center 52%",
          backgroundRepeat:"no-repeat",
          animation:"flicker 9s ease-in-out infinite",
        }} />

        {/* Multi-layer gradient */}
        <div style={{
          position:"absolute", inset:0,
          background:"linear-gradient(to bottom,rgba(4,2,1,.55) 0%,rgba(5,3,1,.04) 25%,rgba(5,3,1,.04) 70%,rgba(4,2,1,.82) 100%)",
        }} />

        {/* Vignette */}
        <div className="vig" style={{ position:"absolute", inset:0 }} />

        {/* Grid */}
        <div className="hud-grid" style={{ position:"absolute", inset:0, opacity:.55 }} />

        {/* Central amber orb */}
        <div style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-54%)",
          width:900, height:900, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(245,158,11,.07) 0%,rgba(245,158,11,.025) 38%,transparent 68%)",
          filter:"blur(70px)", pointerEvents:"none",
        }} />

        {/* Particles */}
        <canvas ref={canvasRef} style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:2 }} />

        {/* Scanline */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:3 }}>
          <div style={{
            position:"absolute", left:0, right:0, height:3,
            background:"linear-gradient(to bottom,transparent,rgba(245,158,11,.025),transparent)",
            animation:"scan 14s linear infinite",
          }} />
        </div>

        {/* Corner brackets */}
        {[
          { top:84, left:24, borderTop:1, borderLeft:1 },
          { top:84, right:24, borderTop:1, borderRight:1 },
          { bottom:52, left:24, borderBottom:1, borderLeft:1 },
          { bottom:52, right:24, borderBottom:1, borderRight:1 },
        ].map((s, i) => (
          <div key={i} style={{
            position:"fixed", width:32, height:32,
            ...s,
            ...(s.borderTop    ? { borderTop:   "1px solid rgba(255,193,116,0.22)" } : {}),
            ...(s.borderLeft   ? { borderLeft:  "1px solid rgba(255,193,116,0.22)" } : {}),
            ...(s.borderRight  ? { borderRight: "1px solid rgba(255,193,116,0.22)" } : {}),
            ...(s.borderBottom ? { borderBottom:"1px solid rgba(255,193,116,0.22)" } : {}),
            pointerEvents:"none", zIndex:5,
          }} />
        ))}

        {/* Decorative diamond */}
        <div style={{ position:"fixed", top:"40%", left:56, width:18, height:18, border:"1px solid rgba(255,193,116,0.18)", transform:"rotate(45deg)", pointerEvents:"none", zIndex:5 }} />
        {/* Vertical light beam */}
        <div style={{
          position:"fixed", right:76, top:"28%",
          width:1, height:200,
          background:"linear-gradient(to bottom,transparent,rgba(255,193,116,0.28),transparent)",
          pointerEvents:"none", zIndex:5,
        }} />

        {/* ── TOP NAV ─────────────────────────────────── */}
        <nav style={{
          position:"fixed", top:0, left:0, right:0, zIndex:50,
          height:68,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2.25rem",
          background:"rgba(4,2,1,.52)",
          backdropFilter:"blur(22px)",
          WebkitBackdropFilter:"blur(22px)",
          borderBottom:"1px solid rgba(255,193,116,0.1)",
        }}>
          {/* Wordmark */}
          <div style={{ display:"flex", alignItems:"center", gap:"2.5rem" }}>
            <span style={{
              fontFamily:"'Noto Serif',serif", fontWeight:700, fontSize:"1.35rem",
              letterSpacing:"-0.02em", color:"#F59E0B", userSelect:"none",
              textShadow:"0 0 8px rgba(245,158,11,.6),0 0 22px rgba(245,158,11,.2)",
            }}>
              DOMINUS
            </span>

            {/* Only the ONE working link */}
            <a href="/chat" className="nav-a active">ORACLE COMMAND</a>
          </div>

          {/* Right */}
          <div style={{ display:"flex", alignItems:"center", gap:"1.2rem" }}>
            <button
              style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(229,226,225,.38)", display:"flex", alignItems:"center", justifyContent:"center", padding:4, transition:"color .2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,193,116,.85)" }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(229,226,225,.38)" }}
            >
              <span className="msym" style={{ fontSize:20 }}>settings</span>
            </button>

            <button className="cta" style={{ padding:".5rem 1.5rem", fontSize:".6rem" }} onClick={() => setVisible(true)}>
              CONNECT WALLET
            </button>
          </div>
        </nav>

        {/* ── HUD LEFT ──────────────────────────────────── */}
        <div className="r1" style={{
          position:"fixed", left:"2.4rem", top:"50%", transform:"translateY(-50%)",
          zIndex:10, display:"flex", flexDirection:"column", gap:"1.8rem",
          paddingLeft:"1rem", paddingTop:"2rem", paddingBottom:"2rem",
          borderLeft:"1px solid rgba(255,193,116,0.18)",
        }}>
          {[
            { label:"LATITUDE",       value:"24.1412.88.1"  },
            { label:"ATMOSPHERE",     value:"STABLE_OXY"    },
            { label:"ARTIFACT COUNT", value:"312 / 5,000"   },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="hl">{label}</span>
              <span className="hv">{value}</span>
            </div>
          ))}
        </div>

        {/* ── HUD RIGHT ─────────────────────────────────── */}
        <div className="r1" style={{
          position:"fixed", right:"2.4rem", top:"50%", transform:"translateY(-50%)",
          zIndex:10, display:"flex", flexDirection:"column", gap:"1.8rem",
          paddingRight:"1rem", paddingTop:"2rem", paddingBottom:"2rem",
          borderRight:"1px solid rgba(255,193,116,0.18)",
          alignItems:"flex-end",
        }}>
          <div>
            <span className="hl" style={{ display:"block", textAlign:"right" }}>SIGNAL STRENGTH</span>
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, justifyContent:"flex-end", marginTop:4 }}>
              {[7,11,15,19,15].map((h, i) => (
                <div key={i} style={{
                  width:5, height:h, borderRadius:1,
                  background: i < 4 ? "rgba(255,193,116,.72)" : "rgba(255,193,116,.2)",
                }} />
              ))}
            </div>
          </div>
          {[
            { label:"TRANSMISSION", value:"ENCRYPTED_S" },
            { label:"PROTOCOL",     value:"v2.4.9"       },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign:"right" }}>
              <span className="hl">{label}</span>
              <span className="hv">{value}</span>
            </div>
          ))}
        </div>

        {/* ── CENTER HERO ───────────────────────────────── */}
        <div style={{
          position:"absolute", inset:0, zIndex:8,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          textAlign:"center", paddingTop:68,
        }}>
          {/* Eyebrow */}
          <p className="r0" style={{
            fontFamily:"'Space Grotesk',sans-serif",
            fontSize:".58rem", fontWeight:500, letterSpacing:".38em",
            textTransform:"uppercase", color:"rgba(229,226,225,.5)",
            marginBottom:"2.4rem", marginTop:0,
          }}>
            SYSTEM STATUS: CONVERGENCE DETECTED
          </p>

          {/* DOMINUS */}
          <h1 className="glow-text r1" style={{
            fontFamily:"'Noto Serif',serif", fontWeight:400,
            lineHeight:.88, letterSpacing:"-.02em", color:"#F59E0B",
            fontSize:"clamp(6rem,19vw,13.5rem)",
            margin:0, userSelect:"none",
          }}>
            DOMINUS
          </h1>

          {/* Italic subtitle */}
          <p className="r2" style={{
            fontFamily:"'Noto Serif',serif", fontStyle:"italic",
            fontSize:"clamp(.85rem,1.8vw,1.2rem)",
            letterSpacing:".22em", color:"rgba(150,179,217,.48)",
            marginTop:"1.5rem", marginBottom:"3.2rem",
          }}>
            Sanctum of the Eternal Gate
          </p>

          {/* CTA group */}
          <div className="r3" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"1.4rem" }}>
            <button className="cta" onClick={() => setVisible(true)}>
              CONNECT WALLET
            </button>
            <button className="ghost" onClick={() => router.push("/chat")}>
              ENTER VIA GUEST PROTOCOL
            </button>
          </div>
        </div>

        {/* ── BOTTOM STATUS BAR ─────────────────────────── */}
        <div style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:50,
          height:42,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2.25rem",
          background:"rgba(4,2,1,.88)",
          backdropFilter:"blur(16px)",
          WebkitBackdropFilter:"blur(16px)",
          borderTop:"1px solid rgba(255,193,116,0.08)",
        }}>
          {/* Left cluster */}
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <span style={{
                width:7, height:7, borderRadius:"50%",
                background:"#FFC174", display:"inline-block",
                boxShadow:"0 0 8px rgba(255,193,116,0.9)",
                animation:"blink 2s ease-in-out infinite",
              }} />
              <span className="sb-txt">CORE PRIME CONNECTED</span>
            </div>
            <div style={{ width:1, height:14, background:"rgba(255,193,116,0.15)" }} />
            <span className="sb-txt">
              EPOCH:{" "}
              <strong style={{ color:"rgba(255,193,116,0.72)", fontWeight:700 }}>{fmtEpoch}</strong>
            </span>
          </div>

          {/* Right cluster */}
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:30, height:2, background:"rgba(255,193,116,0.7)", borderRadius:1 }} />
              <div style={{ width:16, height:2, background:"rgba(255,193,116,0.3)", borderRadius:1 }} />
              <div style={{ width:24, height:2, background:"rgba(255,193,116,0.7)", borderRadius:1 }} />
            </div>
            <span className="sb-txt">V2.4.9-SECURE</span>
          </div>
        </div>

      </div>
    </>
  )
}
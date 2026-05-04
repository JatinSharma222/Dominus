"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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

  // DOM refs for direct 60fps manipulation (no React re-render per frame)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const bgRef        = useRef<HTMLDivElement>(null)
  const gridRef      = useRef<HTMLDivElement>(null)
  const orbRef       = useRef<HTMLDivElement>(null)
  const heroRef      = useRef<HTMLDivElement>(null)
  const leftHudRef   = useRef<HTMLDivElement>(null)
  const rightHudRef  = useRef<HTMLDivElement>(null)
  const ringRef      = useRef<HTMLDivElement>(null)
  const rafRef       = useRef<number>(0)

  // Smooth mouse state: current + target
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (connected) router.push("/chat") }, [connected, router])

  // Epoch counter
  useEffect(() => {
    const id = setInterval(() => setEpoch((p) => parseFloat((p + 0.01).toFixed(2))), 80)
    return () => clearInterval(id)
  }, [])

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth  - 0.5) * 2  // -1 → 1
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2  // -1 → 1
    }
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  // ── 60fps RAF parallax loop ──────────────────────────────────────────────
  const startParallax = useCallback(() => {
    const tick = () => {
      const m = mouse.current
      // Lerp toward target — smooth, not snappy
      m.x += (m.tx - m.x) * 0.055
      m.y += (m.ty - m.y) * 0.055

      // Background: deepest layer, moves slowest opposite to mouse
      if (bgRef.current)
        bgRef.current.style.transform = `translate(${m.x * -22}px, ${m.y * -22}px) scale(1.08)`

      // Grid: mid-deep layer
      if (gridRef.current)
        gridRef.current.style.transform = `translate(${m.x * -10}px, ${m.y * -10}px)`

      // Ambient orb: mid layer
      if (orbRef.current)
        orbRef.current.style.transform = `translate(calc(-50% + ${m.x * 30}px), calc(-50% + ${m.y * 30}px))`

      // Hero text: 3D perspective tilt toward mouse
      if (heroRef.current)
        heroRef.current.style.transform =
          `perspective(1600px) rotateX(${-m.y * 6}deg) rotateY(${m.x * 6}deg) translateZ(30px)`

      // Left HUD: foreground, moves most (creates depth illusion)
      if (leftHudRef.current)
        leftHudRef.current.style.transform =
          `translateY(-50%) translate(${m.x * 18}px, ${m.y * 12}px)`

      // Right HUD
      if (rightHudRef.current)
        rightHudRef.current.style.transform =
          `translateY(-50%) translate(${m.x * 18}px, ${m.y * 12}px)`

      // Portal rings — subtle counter-rotation to mouse
      if (ringRef.current)
        ringRef.current.style.transform =
          `translate(-50%, -50%) rotateX(${m.y * 8}deg) rotateY(${-m.x * 8}deg)`

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => startParallax(), [startParallax])

  // ── Canvas: depth-aware particle field ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize, { passive: true })

    type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; depth: number }
    const pts: P[] = Array.from({ length: 100 }, () => {
      const depth = Math.random() // 0 = far, 1 = close
      return {
        x:     Math.random() * window.innerWidth,
        y:     Math.random() * window.innerHeight,
        r:     depth * 2.2 + 0.2,
        vx:    (Math.random() - 0.5) * (depth * 0.5 + 0.08),
        vy:    -(Math.random() * 0.4 + 0.05) * (depth + 0.3),
        a:     depth * 0.55 + 0.05,
        depth,
      }
    })

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const mx = mouse.current.x
      const my = mouse.current.y

      pts.forEach((p) => {
        // Parallax offset by depth
        const px = p.x + mx * p.depth * -15
        const py = p.y + my * p.depth * -15

        // Glow for closer particles
        if (p.depth > 0.6) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, p.r * 3)
          g.addColorStop(0, `rgba(255,185,40,${p.a * 0.8})`)
          g.addColorStop(1, "transparent")
          ctx.beginPath()
          ctx.arc(px, py, p.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(px, py, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,185,40,${p.a})`
        ctx.fill()

        p.x += p.vx; p.y += p.vy
        if (p.y < -10)                   { p.y = canvas.height + 10; p.x = Math.random() * canvas.width }
        if (p.x < -10)                    p.x = canvas.width + 10
        if (p.x > canvas.width  + 10)    p.x = -10
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])

  if (!mounted) return <div style={{ background: "#080400", width: "100vw", height: "100vh" }} />

  const fmtEpoch = `${epoch.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.ALPHA`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

        *, *::before, *::after { box-sizing: border-box; }
        .msym {
          font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
          line-height:1; font-family:'Material Symbols Outlined'; user-select:none;
        }

        /* ── Keyframes ─────────────────────────────────────── */
        @keyframes flicker {
          0%,100%{opacity:1} 91%{opacity:1} 92%{opacity:.88} 93%{opacity:1} 96%{opacity:.95} 97%{opacity:1}
        }
        @keyframes scan {
          0%{transform:translateY(-4px)} 100%{transform:translateY(100vh)}
        }
        @keyframes blink {
          0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.25;transform:scale(.55)}
        }
        @keyframes glow {
          0%,100%{ text-shadow:0 0 30px rgba(245,158,11,.7),0 0 80px rgba(245,120,10,.35),0 0 140px rgba(200,80,0,.15); }
          50%{     text-shadow:0 0 55px rgba(255,190,11,.95),0 0 120px rgba(245,140,10,.5),0 0 200px rgba(220,90,0,.25); }
        }
        @keyframes rise {
          from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes ring-pulse {
          0%  { transform:scale(1);   opacity:.55; }
          60% { transform:scale(1.12); opacity:.18; }
          100%{ transform:scale(1);   opacity:.55; }
        }
        @keyframes ring-rotate {
          0%  { transform:rotate(0deg);   }
          100%{ transform:rotate(360deg); }
        }
        @keyframes ring-rotate-rev {
          0%  { transform:rotate(0deg);   }
          100%{ transform:rotate(-360deg);}
        }
        @keyframes shimmer-border {
          0%,100%{ opacity:.38; } 50%{ opacity:.8; }
        }
        @keyframes hud-float {
          0%,100%{ transform:translateY(0); }
          50%{     transform:translateY(-5px); }
        }
        @keyframes glitch {
          0%,92%,100%{ clip-path:none; transform:none; }
          93%{ clip-path:inset(30% 0 55% 0); transform:translate(-4px, 0) skewX(-1deg); }
          94%{ clip-path:inset(55% 0 15% 0); transform:translate(4px, 0); }
          96%{ clip-path:inset(10% 0 70% 0); transform:translate(-2px, 0); }
          97%{ clip-path:none; transform:none; }
        }
        @keyframes corner-draw {
          from{ opacity:0; transform:scale(0.7); }
          to{   opacity:1; transform:scale(1); }
        }

        /* ── Utility classes ───────────────────────────────── */
        .glow-txt   { animation: glow 4s ease-in-out infinite; }
        .glitch-txt { animation: glitch 12s ease-in-out infinite; }
        .r0 { animation: rise .9s cubic-bezier(.22,1,.36,1) both; }
        .r1 { animation: rise .9s cubic-bezier(.22,1,.36,1) .18s both; }
        .r2 { animation: rise .9s cubic-bezier(.22,1,.36,1) .36s both; }
        .r3 { animation: rise .9s cubic-bezier(.22,1,.36,1) .56s both; }
        .r4 { animation: rise .9s cubic-bezier(.22,1,.36,1) .72s both; }

        /* ── CTA button ────────────────────────────────────── */
        .cta {
          position:relative; display:inline-flex; align-items:center; justify-content:center;
          padding:1.2rem 4.5rem;
          font-family:'Space Grotesk',sans-serif; font-size:.72rem; font-weight:700;
          letter-spacing:.3em; text-transform:uppercase; color:#1A0A00;
          background: linear-gradient(135deg, #FFE080 0%, #FFC844 25%, #F59E0B 60%, #D97706 100%);
          border:none; border-radius:2px; cursor:pointer; overflow:hidden;
          box-shadow:
            0 0 0 1px rgba(255,200,80,.25),
            0 0 30px rgba(245,158,11,.55),
            0 0 80px rgba(245,130,10,.22),
            0 8px 32px rgba(0,0,0,.6),
            inset 0 1px 0 rgba(255,255,255,.4),
            inset 0 -1px 0 rgba(0,0,0,.25);
          transition:transform .18s cubic-bezier(.22,1,.36,1), box-shadow .22s ease;
          text-shadow: 0 1px 0 rgba(255,255,255,.3);
        }
        .cta::before {
          content:''; position:absolute; inset:-2px;
          border:1px solid rgba(255,210,80,.6); border-radius:3px;
          filter:blur(3px); pointer-events:none;
          animation: shimmer-border 2.8s ease-in-out infinite;
        }
        .cta::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(to bottom, rgba(255,255,255,.25) 0%, transparent 50%);
          pointer-events:none;
        }
        .cta-flash { position:absolute; inset:0; background:transparent; transition:background .18s; pointer-events:none; z-index:1; }
        .cta:hover {
          transform:scale(1.06) translateY(-2px);
          box-shadow:
            0 0 0 1px rgba(255,200,80,.4),
            0 0 50px rgba(255,175,10,.8),
            0 0 120px rgba(245,140,10,.4),
            0 16px 48px rgba(0,0,0,.7),
            inset 0 1px 0 rgba(255,255,255,.4),
            inset 0 -1px 0 rgba(0,0,0,.25);
        }
        .cta:hover .cta-flash { background:rgba(255,255,255,.16); }
        .cta:active { transform:scale(.97) translateY(0); }

        /* ── Ghost link ────────────────────────────────────── */
        .ghost {
          font-family:'Space Grotesk',sans-serif; font-size:.6rem; font-weight:500;
          letter-spacing:.28em; text-transform:uppercase;
          color:rgba(255,220,160,.35); background:none; border:none;
          border-bottom:1px solid transparent; padding-bottom:2px; cursor:pointer;
          transition:color .22s, border-color .22s;
        }
        .ghost:hover { color:rgba(255,205,110,.75); border-bottom-color:rgba(255,185,80,.38); }

        /* ── Nav ───────────────────────────────────────────── */
        .nav-lnk {
          font-family:'Space Grotesk',sans-serif; font-size:.67rem; font-weight:700;
          letter-spacing:.18em; text-transform:uppercase; text-decoration:none;
          color:rgba(255,220,160,.48); background:none; border:none;
          padding-bottom:3px; border-bottom:1.5px solid transparent;
          transition:color .2s, border-color .2s; cursor:pointer;
        }
        .nav-lnk.active { color:#F59E0B; border-bottom-color:#F59E0B; }
        .nav-lnk:hover  { color:rgba(255,205,100,.88); }

        /* ── HUD labels ────────────────────────────────────── */
        .hl { font-family:'Space Grotesk',sans-serif; font-size:.5rem; letter-spacing:.24em; text-transform:uppercase; color:rgba(255,220,160,.3); display:block; margin-bottom:3px; }
        .hv { font-family:'Space Grotesk',sans-serif; font-size:.7rem; font-weight:700; letter-spacing:.14em; color:rgba(255,190,70,.88); }

        /* ── Status bar ────────────────────────────────────── */
        .sb { font-family:'Space Grotesk',sans-serif; font-size:.5rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:rgba(255,215,140,.38); }

        /* ── HUD panel 3D card ─────────────────────────────── */
        .hud-panel {
          background:rgba(6,3,0,.55);
          backdrop-filter:blur(16px);
          -webkit-backdrop-filter:blur(16px);
          border:1px solid rgba(255,185,60,.14);
          border-radius:2px;
          padding: 1.6rem 1.2rem;
          box-shadow:
            0 0 0 1px rgba(255,185,60,.06) inset,
            0 8px 40px rgba(0,0,0,.6),
            0 0 20px rgba(245,158,11,.06);
          transform-style: preserve-3d;
        }

        /* ── Portal ring ───────────────────────────────────── */
        .p-ring {
          position:absolute; border-radius:50%;
          border:1px solid rgba(245,158,11,.22);
          pointer-events:none;
        }

        /* ── Corner brackets ───────────────────────────────── */
        .corner {
          position:fixed; width:32px; height:32px; pointer-events:none; z-index:8;
          animation: corner-draw .8s ease-out both;
        }

        /* ── Glowing grid ──────────────────────────────────── */
        .hud-grid {
          background-size: 36px 36px;
          background-image:
            linear-gradient(to right,  rgba(255,175,50,.055) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,175,50,.055) 1px, transparent 1px);
        }

        /* Suppress wallet adapter trigger */
        .wallet-adapter-dropdown, .wallet-adapter-button-trigger { display:none !important; }
      `}</style>

      {/* ── ROOT ──────────────────────────────────────────────────────── */}
      <div style={{ position:"fixed", inset:0, background:"#060300", overflow:"hidden" }}>

        {/* ── LAYER 0: Background image (deepest, moves slowest) ── */}
        <div
          ref={bgRef}
          style={{
            position:"absolute", inset:"-6%",
            backgroundImage:`url('${GATE_BG}')`,
            backgroundSize:"cover",
            backgroundPosition:"center 38%",
            willChange:"transform",
            animation:"flicker 11s ease-in-out infinite",
          }}
        />

        {/* Top/bottom gradient masks */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(4,2,0,.72) 0%, rgba(4,2,0,.08) 12%, transparent 24%, transparent 68%, rgba(2,1,0,.8) 100%)", zIndex:1 }} />
        {/* Side masks */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, rgba(4,2,0,.52) 0%, transparent 14%, transparent 86%, rgba(4,2,0,.52) 100%)", zIndex:1 }} />

        {/* ── LAYER 1: HUD grid (moves at ~50% bg speed) ── */}
        <div
          ref={gridRef}
          className="hud-grid"
          style={{ position:"absolute", inset:"-4%", opacity:.32, willChange:"transform", zIndex:2 }}
        />

        {/* ── LAYER 2: Ambient atmospheric orb ── */}
        <div
          ref={orbRef}
          style={{
            position:"absolute", top:"42%", left:"50%",
            width:700, height:700, borderRadius:"50%",
            background:"radial-gradient(circle, rgba(255,165,30,.1) 0%, rgba(245,120,10,.05) 40%, transparent 70%)",
            filter:"blur(60px)", pointerEvents:"none", zIndex:3,
            willChange:"transform",
          }}
        />

        {/* ── LAYER 3: Portal energy rings (3D perspective) ── */}
        <div
          ref={ringRef}
          style={{
            position:"absolute", top:"40%", left:"50%",
            willChange:"transform",
            zIndex:4, pointerEvents:"none",
            perspective:"800px",
            perspectiveOrigin:"50% 50%",
          }}
        >
          {[
            { size:260, delay:0,    dur:3.2, rot:"ring-rotate",     opacity:.35 },
            { size:380, delay:.5,   dur:4.8, rot:"ring-rotate-rev", opacity:.22 },
            { size:510, delay:.9,   dur:6.1, rot:"ring-rotate",     opacity:.16 },
            { size:660, delay:1.4,  dur:7.8, rot:"ring-rotate-rev", opacity:.12 },
            { size:840, delay:0,    dur:3.6, rot:"ring-pulse",      opacity:.3  },
            { size:1060,delay:.7,   dur:4.9, rot:"ring-pulse",      opacity:.18 },
          ].map(({ size, delay, dur, rot, opacity }, i) => (
            <div
              key={i}
              className="p-ring"
              style={{
                width:size, height:size,
                top:-size/2, left:-size/2,
                border:`1px solid rgba(245,158,11,${opacity})`,
                animation:`${rot} ${dur}s ease-in-out ${delay}s infinite`,
                boxShadow:`0 0 8px rgba(245,158,11,${opacity * 0.5}) inset`,
              }}
            />
          ))}
          {/* Inner bright glow disc */}
          <div style={{
            position:"absolute",
            width:80, height:80,
            top:-40, left:-40,
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(255,200,80,.18) 0%, transparent 70%)",
            filter:"blur(12px)",
          }} />
        </div>

        {/* ── Particles canvas (depth-aware) ── */}
        <canvas ref={canvasRef} style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:5 }} />

        {/* ── Scan line ── */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:6 }}>
          <div style={{
            position:"absolute", left:0, right:0, height:3,
            background:"linear-gradient(to bottom, transparent, rgba(255,185,40,.06), transparent)",
            animation:"scan 18s linear infinite",
          }} />
        </div>

        {/* ── Corner brackets ── */}
        <div className="corner" style={{ top:80, left:20, borderTop:"1px solid rgba(255,185,60,.32)", borderLeft:"1px solid rgba(255,185,60,.32)", animationDelay:".6s" }} />
        <div className="corner" style={{ top:80, right:20, borderTop:"1px solid rgba(255,185,60,.32)", borderRight:"1px solid rgba(255,185,60,.32)", animationDelay:".7s" }} />
        <div className="corner" style={{ bottom:48, left:20, borderBottom:"1px solid rgba(255,185,60,.32)", borderLeft:"1px solid rgba(255,185,60,.32)", animationDelay:".8s" }} />
        <div className="corner" style={{ bottom:48, right:20, borderBottom:"1px solid rgba(255,185,60,.32)", borderRight:"1px solid rgba(255,185,60,.32)", animationDelay:".9s" }} />

        {/* Decorative diamond — top-left */}
        <div className="r0" style={{ position:"fixed", top:"43%", left:56, width:14, height:14, border:"1px solid rgba(255,185,60,.22)", transform:"rotate(45deg)", pointerEvents:"none", zIndex:8, animation:"hud-float 5s ease-in-out infinite" }} />

        {/* Vertical light beam — right */}
        <div style={{ position:"fixed", right:70, top:"28%", width:1, height:200, background:"linear-gradient(to bottom, transparent, rgba(255,185,60,.4), transparent)", pointerEvents:"none", zIndex:8, animation:"shimmer-border 3s ease-in-out infinite" }} />

        {/* ── TOP NAV ──────────────────────────────────────────── */}
        <nav style={{
          position:"fixed", top:0, left:0, right:0, zIndex:50,
          height:66,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2.25rem",
          background:"rgba(4,2,0,.52)",
          backdropFilter:"blur(24px)",
          WebkitBackdropFilter:"blur(24px)",
          borderBottom:"1px solid rgba(255,180,50,.1)",
          boxShadow:"0 8px 32px rgba(0,0,0,.4)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"2.5rem" }}>
            <span style={{
              fontFamily:"'Noto Serif',serif", fontWeight:700, fontSize:"1.35rem",
              letterSpacing:"-.02em", color:"#F59E0B", userSelect:"none",
              textShadow:"0 0 12px rgba(245,158,11,.8), 0 0 30px rgba(245,130,10,.35)",
            }}>
              DOMINUS
            </span>
            <button className="nav-lnk active" onClick={() => router.push("/chat")}>ORACLE COMMAND</button>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"1.2rem" }}>
            <button
              style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,200,120,.38)", display:"flex", padding:4, transition:"color .2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,185,60,.9)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,200,120,.38)")}
            >
              <span className="msym" style={{ fontSize:20 }}>settings</span>
            </button>
            <button
              className="cta"
              style={{ padding:".52rem 1.6rem", fontSize:".6rem" }}
              onClick={() => setVisible(true)}
            >
              <span className="cta-flash" />
              CONNECT WALLET
            </button>
          </div>
        </nav>

        {/* ── HUD LEFT (foreground — moves most = closest to viewer) ── */}
        <div
          ref={leftHudRef}
          className="r1"
          style={{
            position:"fixed", left:"2.2rem", top:"50%",
            zIndex:20, willChange:"transform",
            display:"flex", flexDirection:"column", gap:"1.8rem",
          }}
        >
          <div className="hud-panel" style={{ display:"flex", flexDirection:"column", gap:"1.6rem" }}>
            {[
              { label:"LATITUDE",       value:"24.1412.88.1" },
              { label:"ATMOSPHERE",     value:"STABLE_OXY"   },
              { label:"ARTIFACT COUNT", value:"312 / 5,000"  },
            ].map(({ label, value }) => (
              <div key={label}>
                <span className="hl">{label}</span>
                <span className="hv">{value}</span>
              </div>
            ))}
            {/* Mini progress bar */}
            <div>
              <span className="hl">SYNC</span>
              <div style={{ width:"100%", height:2, background:"rgba(255,185,60,.12)", borderRadius:1, marginTop:4 }}>
                <div style={{ width:"94%", height:"100%", background:"linear-gradient(to right, #F59E0B, #FFD070)", borderRadius:1, boxShadow:"0 0 6px rgba(245,158,11,.6)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── HUD RIGHT ── */}
        <div
          ref={rightHudRef}
          className="r1"
          style={{
            position:"fixed", right:"2.2rem", top:"50%",
            zIndex:20, willChange:"transform",
            display:"flex", flexDirection:"column", gap:"1.8rem",
          }}
        >
          <div className="hud-panel" style={{ display:"flex", flexDirection:"column", gap:"1.6rem", alignItems:"flex-end" }}>
            <div>
              <span className="hl" style={{ textAlign:"right" }}>SIGNAL STRENGTH</span>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, justifyContent:"flex-end", marginTop:5 }}>
                {[7,11,15,18,14].map((h, i) => (
                  <div key={i} style={{
                    width:5, height:h, borderRadius:1,
                    background: i < 4 ? "rgba(255,185,60,.88)" : "rgba(255,185,60,.2)",
                    boxShadow: i < 4 ? "0 0 4px rgba(245,158,11,.5)" : "none",
                    transition:"height .3s",
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
            {/* Live dot indicator */}
            <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", letterSpacing:".22em", textTransform:"uppercase", color:"rgba(255,185,60,.45)" }}>LIVE</span>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#FFC060", boxShadow:"0 0 6px rgba(255,185,60,.9)", display:"inline-block", animation:"blink 2.5s ease-in-out infinite" }} />
            </div>
          </div>
        </div>

        {/* ── HERO (3D perspective tilt) ── */}
        <div style={{ position:"absolute", inset:0, zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", paddingTop:66 }}>
          <div
            ref={heroRef}
            style={{
              display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center",
              willChange:"transform",
              transformStyle:"preserve-3d",
              gap:0,
            }}
          >
            {/* System status eyebrow */}
            <p className="r0" style={{
              fontFamily:"'Space Grotesk',sans-serif", fontSize:".57rem", fontWeight:500,
              letterSpacing:".42em", textTransform:"uppercase",
              color:"rgba(255,235,185,.52)", marginBottom:"2rem",
              textShadow:"0 1px 10px rgba(0,0,0,.9)",
            }}>
              SYSTEM STATUS: CONVERGENCE DETECTED
            </p>

            {/* Main wordmark */}
            <h1
              className="glow-txt glitch-txt r1"
              style={{
                fontFamily:"'Noto Serif',serif", fontWeight:400,
                lineHeight:.86, letterSpacing:"-.025em",
                color:"#F5A010",
                fontSize:"clamp(5.5rem,17vw,12.5rem)",
                margin:0, userSelect:"none",
                filter:"drop-shadow(0 4px 80px rgba(0,0,0,.8))",
              }}
            >
              DOMINUS
            </h1>

            {/* Subtitle */}
            <p className="r2" style={{
              fontFamily:"'Noto Serif',serif", fontStyle:"italic",
              fontSize:"clamp(.8rem,1.7vw,1.15rem)",
              letterSpacing:".24em", color:"rgba(180,215,255,.52)",
              marginTop:"1.4rem", marginBottom:"3rem",
              textShadow:"0 2px 16px rgba(0,0,0,.9)",
            }}>
              Sanctum of the Eternal Gate
            </p>

            {/* CTAs */}
            <div className="r3" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"1.5rem" }}>
              <button className="cta" onClick={() => setVisible(true)}>
                <span className="cta-flash" />
                CONNECT WALLET
              </button>
              <button className="ghost" onClick={() => router.push("/chat")}>
                ENTER VIA GUEST PROTOCOL
              </button>
            </div>

            {/* Tiny stat row below CTAs */}
            <div className="r4" style={{
              display:"flex", alignItems:"center", gap:"2rem",
              marginTop:"2.8rem",
              padding:".8rem 2rem",
              borderTop:"1px solid rgba(255,185,60,.12)",
              borderBottom:"1px solid rgba(255,185,60,.12)",
            }}>
              {[
                { label:"PROTOCOLS", value:"4" },
                { label:"CHAINS",    value:"1" },
                { label:"EXECUTION", value:"<1s" },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign:"center" }}>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".48rem", letterSpacing:".24em", textTransform:"uppercase", color:"rgba(255,215,140,.3)", marginBottom:3 }}>{label}</p>
                  <p style={{ fontFamily:"'Noto Serif',serif", fontSize:"1.2rem", fontWeight:700, color:"rgba(255,185,60,.88)", textShadow:"0 0 12px rgba(245,158,11,.4)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BOTTOM STATUS BAR ──────────────────────────────── */}
        <div style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:50,
          height:42,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 2.25rem",
          background:"rgba(4,2,0,.88)",
          backdropFilter:"blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          borderTop:"1px solid rgba(255,180,50,.09)",
          boxShadow:"0 -8px 32px rgba(0,0,0,.5)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1.1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.55rem" }}>
              <span style={{
                width:6, height:6, borderRadius:"50%", display:"inline-block",
                background:"#FFC060",
                boxShadow:"0 0 8px rgba(255,190,60,.95), 0 0 18px rgba(245,158,11,.45)",
                animation:"blink 2.8s ease-in-out infinite",
              }} />
              <span className="sb">CORE PRIME CONNECTED</span>
            </div>
            <div style={{ width:1, height:13, background:"rgba(255,180,50,.15)" }} />
            <span className="sb">
              EPOCH:{" "}
              <strong style={{ color:"rgba(255,185,60,.75)", fontWeight:700 }}>{fmtEpoch}</strong>
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"1.1rem" }}>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              {[30, 16, 24].map((w, i) => (
                <div key={i} style={{ width:w, height:2, borderRadius:1, background: i !== 1 ? "rgba(255,185,60,.68)" : "rgba(255,185,60,.25)" }} />
              ))}
            </div>
            <span className="sb">V2.4.9-SECURE</span>
          </div>
        </div>

      </div>
    </>
  )
}
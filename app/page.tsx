"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useRouter } from "next/navigation"

const GATE_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD0DyECvfMshIBB_dQU2p7bwdv_6ciBkR_fClpDFWWyuX3T3LrbaOwAuFm9R-DYe0yvgKJsCHZrHbjdbyVku3ne6V7justI9SrkT88q4MMJXwVHLGqoyaCqUAKIiYDtQAFc9kfWsgNfN3baZDZ00gvgTbjEPke_NBcSxl-Y5yw9FCEoKk7y3EQ_FeIAMBCVHJNuOTfK0tQ5kWy26klZjWFr5n2fv_SGMcQSFse2FjSvnWHZRTAU8P47wGGv0NrgzLd5PPtp007K4f2G"

const AETHER_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA8O-jxGq9p6pB2fhiscu4C-DTKs4C09K8meX9zguYmeMrhNe6q4QM7dv5QfDXGYL6uAgpBKmN5Q2tGcJlPM1OkJlkQuWjeWiqkoq2pGJLrSy6daejDBvONTDqOdDuCtB8yp73cQFNewH5t4Rz-5l6N9L8864wZTLKGb8MC5nNSnfwqh4xDTrnheF1zQE5gaeZ4B-jYEVJh0lgNIbtHmXSvZFtMgQ1z3pmXqf7-8swJqWCH5CePQ1A2sfZV_EMt13kNd1Uq2KdYqqZk"

function buildFirePalette(): Uint32Array {
  const p = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = 0, g = 0, b = 0
    if (i < 64)       { r = i * 3 }
    else if (i < 128) { r = 192 + (i - 64); g = (i - 64) * 2 }
    else if (i < 192) { r = 255; g = 128 + (i - 128) * 2 }
    else              { r = 255; g = 255; b = (i - 192) * 4 }
    p[i] = (255 << 24) | (b << 16) | (g << 8) | r
  }
  return p
}

export default function LandingPage() {
  const { connected } = useWallet()
  const { setVisible } = useWalletModal()
  const router = useRouter()

  const [mounted,   setMounted]   = useState(false)
  const [epoch,     setEpoch]     = useState(1492.05)
  const [latency,   setLatency]   = useState(0.021)
  const [imgLoaded, setImgLoaded] = useState(false)

  const fireRef     = useRef<HTMLCanvasElement>(null)
  const particleRef = useRef<HTMLCanvasElement>(null)
  const portalRef   = useRef<HTMLDivElement>(null)
  const heroTextRef = useRef<HTMLDivElement>(null)
  const lHudRef     = useRef<HTMLDivElement>(null)
  const rHudRef     = useRef<HTMLDivElement>(null)
  const mouse       = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const rafRef      = useRef<number>(0)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { if (connected) router.push("/chat") }, [connected, router])

  useEffect(() => {
    const e = setInterval(() => setEpoch(p => parseFloat((p + 0.01).toFixed(2))), 90)
    const l = setInterval(() => setLatency(parseFloat((0.018 + Math.random() * 0.008).toFixed(3))), 2400)
    return () => { clearInterval(e); clearInterval(l) }
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth  - 0.5) * 2
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", fn, { passive: true })
    return () => window.removeEventListener("mousemove", fn)
  }, [])

  const startRAF = useCallback(() => {
    const tick = () => {
      const m = mouse.current
      m.x += (m.tx - m.x) * 0.04
      m.y += (m.ty - m.y) * 0.04
      if (portalRef.current)
        portalRef.current.style.transform = `perspective(1800px) rotateX(${m.y * -7}deg) rotateY(${m.x * 7}deg) translateZ(0)`
      if (heroTextRef.current)
        heroTextRef.current.style.transform = `perspective(1800px) rotateX(${m.y * -3}deg) rotateY(${m.x * 3}deg)`
      if (lHudRef.current)
        lHudRef.current.style.transform = `translateY(-50%) translate(${m.x * 9}px,${m.y * 6}px)`
      if (rHudRef.current)
        rHudRef.current.style.transform = `translateY(-50%) translate(${m.x * 9}px,${m.y * 6}px)`
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => startRAF(), [startRAF])

  // Doom fire
  useEffect(() => {
    const canvas = fireRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = 400, H = 160
    canvas.width = W; canvas.height = H
    const palette = buildFirePalette()
    const fire    = new Uint8Array(W * H)
    const imgData = ctx.createImageData(W, H)
    const buf32   = new Uint32Array(imgData.data.buffer)
    const seed = () => {
      const cx = Math.floor(W / 2), hw = Math.floor(W * 0.42)
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - cx) / hw
        const h = d < 1 ? Math.floor(255 * Math.pow(1 - d * d, 0.5)) : 0
        fire[(H - 1) * W + x] = h
        fire[(H - 2) * W + x] = Math.max(0, h - 10)
      }
    }
    const step = () => {
      seed()
      for (let y = 0; y < H - 1; y++)
        for (let x = 0; x < W; x++) {
          const src   = (y + 1) * W + x
          const decay = Math.floor(Math.random() * 3)
          const dx    = Math.random() < 0.5 ? -1 : 0
          fire[y * W + ((x + dx + W) % W)] = Math.max(0, fire[src] - decay)
        }
    }
    let raf: number
    const loop = () => {
      step()
      for (let i = 0; i < W * H; i++) buf32[i] = palette[fire[i]]
      ctx.putImageData(imgData, 0, 0)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  // Particles
  useEffect(() => {
    const canvas = particleRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener("resize", resize, { passive: true })
    type P = { x:number;y:number;vx:number;vy:number;r:number;op:number;life:number;maxLife:number;ember:boolean }
    const pts: P[] = Array.from({ length: 90 }, (_, i) => {
      const ember = i < 55
      return {
        x: 0, y: 0, vx: (Math.random() - 0.5) * (ember ? 0.9 : 0.3),
        vy: ember ? -(Math.random() * 1.8 + 0.5) : (Math.random() - 0.5) * 0.2,
        r: Math.random() * (ember ? 2.2 : 1.3) + 0.4,
        op: Math.random() * 0.7 + 0.15,
        life: Math.random() * 160, maxLife: 130 + Math.random() * 130, ember,
      }
    })
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cx = canvas.width * 0.5, cy = canvas.height * 0.5
      const mx = mouse.current.x, my = mouse.current.y
      pts.forEach(p => {
        if (p.life === 0 || p.life > p.maxLife) {
          p.x = cx + (Math.random() - 0.5) * (p.ember ? 200 : 480)
          p.y = cy + (p.ember ? 80 + Math.random() * 100 : (Math.random() - 0.5) * 280)
          p.life = 0
        }
        p.life++
        const frac = p.life / p.maxLife
        const fade = frac < 0.15 ? frac / 0.15 : frac > 0.75 ? 1 - (frac - 0.75) / 0.25 : 1
        const al   = p.op * fade
        p.x += p.vx + mx * 0.007 + (Math.random() - 0.5) * 0.14
        p.y += p.vy + my * 0.005
        if (p.ember && p.r > 1.2) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
          g.addColorStop(0, `rgba(255,200,60,${al * 0.5})`); g.addColorStop(1, "transparent")
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.ember ? `rgba(255,${180 + Math.floor(frac * 60)},${Math.floor(frac * 80)},${al})` : `rgba(255,185,60,${al * 0.4})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])

  if (!mounted) return <div style={{ background: "#060300", width: "100vw", height: "100vh" }} />

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "MAINNET" : "DEVNET"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        .ms{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;line-height:1;user-select:none;display:inline-block}

        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowPulse{
          0%,100%{filter:drop-shadow(0 0 22px rgba(245,158,11,.8)) drop-shadow(0 0 65px rgba(245,120,10,.32))}
          50%{filter:drop-shadow(0 0 48px rgba(255,205,20,1)) drop-shadow(0 0 115px rgba(245,140,10,.52))}
        }
        @keyframes portalAura{
          0%,100%{box-shadow:0 0 90px rgba(245,130,10,.4),0 0 220px rgba(245,100,5,.2),inset 0 0 70px rgba(255,150,20,.1)}
          50%{box-shadow:0 0 140px rgba(255,165,20,.58),0 0 340px rgba(245,120,10,.3),inset 0 0 110px rgba(255,185,35,.16)}
        }
        @keyframes ringCW{to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes ringCCW{to{transform:translate(-50%,-50%) rotate(-360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.14}}
        @keyframes beamPulse{0%,100%{opacity:.22}50%{opacity:.72}}
        @keyframes floatY{0%,100%{transform:translateY(0) rotate(45deg)}50%{transform:translateY(-11px) rotate(45deg)}}
        @keyframes scanLine{0%{top:-3px}100%{top:calc(100% + 3px)}}
        @keyframes glitch{
          0%,88%,100%{clip-path:none;transform:none}
          89%{clip-path:inset(26% 0 54% 0);transform:translate(-7px,0) skewX(-2deg)}
          90%{clip-path:inset(54% 0 16% 0);transform:translate(7px,0)}
          91%{clip-path:inset(8% 0 70% 0);transform:translate(-3px,0)}
          92%{clip-path:none;transform:none}
        }
        @keyframes shimmerSweep{0%{background-position:-250% 0}100%{background-position:250% 0}}
        @keyframes dataScroll{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}
        @keyframes cornerIn{from{opacity:0;transform:scale(.35)}to{opacity:1;transform:scale(1)}}

        .a0{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) both}
        .a1{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .12s both}
        .a2{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .26s both}
        .a3{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .42s both}
        .a4{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .58s both}
        .a5{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .76s both}

        .glass{
          background:linear-gradient(135deg,rgba(255,255,255,.07) 0%,rgba(255,185,55,.025) 50%,rgba(255,255,255,.044) 100%);
          backdrop-filter:blur(28px) saturate(1.6) brightness(1.06);
          -webkit-backdrop-filter:blur(28px) saturate(1.6) brightness(1.06);
          border:1px solid rgba(255,185,60,.2);
          border-top:1px solid rgba(255,255,255,.14);
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.09),inset 0 -1px 0 rgba(0,0,0,.18),0 10px 50px rgba(0,0,0,.68),0 0 32px rgba(245,158,11,.055);
          position:relative;overflow:hidden;border-radius:3px;
        }
        .glass::before{
          content:'';position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(108deg,transparent 24%,rgba(255,255,255,.062) 50%,transparent 76%);
          background-size:250% 100%;animation:shimmerSweep 11s ease-in-out infinite;
        }
        .glass-top{position:absolute;top:0;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent,rgba(255,205,70,.58),transparent)}
        .glass-bot{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,185,60,.22),transparent)}

        .nav-glass{
          background:linear-gradient(180deg,rgba(5,2,0,.84) 0%,rgba(3,1,0,.65) 100%);
          backdrop-filter:blur(32px) saturate(1.8);-webkit-backdrop-filter:blur(32px) saturate(1.8);
          border-bottom:1px solid rgba(255,185,60,.09);
          box-shadow:0 1px 0 rgba(255,255,255,.034),0 20px 58px rgba(0,0,0,.6);
        }
        .sb-glass{
          background:linear-gradient(0deg,rgba(3,1,0,.96) 0%,rgba(5,2,0,.84) 100%);
          backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
          border-top:1px solid rgba(255,185,60,.08);
          box-shadow:0 -14px 46px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.027);
        }

        .btn-cta{
          position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
          font-family:'Space Grotesk',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
          color:#120700;
          background:linear-gradient(135deg,#FFE980 0%,#FFD060 16%,#FFAC10 55%,#F59E0B 74%,#D97706 100%);
          border:none;border-radius:2px;cursor:pointer;overflow:hidden;
          box-shadow:0 0 0 1px rgba(255,215,80,.28),0 0 44px rgba(245,158,11,.72),0 0 95px rgba(245,128,10,.28),0 6px 30px rgba(0,0,0,.72),inset 0 1.5px 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(0,0,0,.22);
          transition:transform .22s cubic-bezier(.22,1,.36,1),box-shadow .22s;
          text-shadow:0 1px 0 rgba(255,255,255,.38);
        }
        .btn-cta::before{content:'';position:absolute;inset:-3px;border:1px solid rgba(255,220,80,.7);border-radius:4px;filter:blur(5px);pointer-events:none;animation:beamPulse 2.8s ease-in-out infinite}
        .btn-cta:hover{transform:scale(1.058) translateY(-2px);box-shadow:0 0 0 1px rgba(255,220,80,.5),0 0 62px rgba(255,185,10,.98),0 0 145px rgba(245,140,10,.44),0 20px 55px rgba(0,0,0,.75),inset 0 1.5px 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(0,0,0,.22)}
        .btn-cta:active{transform:scale(.97)}
        .btn-shine{position:absolute;inset:0;background:linear-gradient(108deg,transparent 28%,rgba(255,255,255,.26) 50%,transparent 72%);background-size:250% 100%;background-position:250% 0;transition:background-position .5s}
        .btn-cta:hover .btn-shine{background-position:-250% 0}

        .btn-ghost{font-family:'Space Grotesk',sans-serif;font-size:.58rem;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,210,140,.3);background:none;border:none;border-bottom:1px solid transparent;padding-bottom:2px;cursor:pointer;transition:color .2s,border-color .2s}
        .btn-ghost:hover{color:rgba(255,195,90,.72);border-bottom-color:rgba(255,185,60,.35)}

        .nav-lnk{font-family:'Space Grotesk',sans-serif;font-size:.64rem;font-weight:700;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,220,160,.38);background:none;border:none;border-bottom:1.5px solid transparent;padding-bottom:3px;cursor:pointer;transition:color .2s,border-color .2s;text-decoration:none}
        .nav-lnk:hover,.nav-lnk.on{color:#F59E0B;border-bottom-color:rgba(245,158,11,.72)}

        .hl{font-family:'Space Grotesk',sans-serif;font-size:.42rem;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,215,150,.24);display:block;margin-bottom:4px}
        .hv{font-family:'Space Grotesk',sans-serif;font-size:.65rem;font-weight:700;letter-spacing:.12em;color:rgba(255,188,68,.88)}
        .sb{font-family:'Space Grotesk',sans-serif;font-size:.43rem;font-weight:600;letter-spacing:.19em;text-transform:uppercase;color:rgba(255,210,130,.34)}

        .proto{
          display:flex;flex-direction:column;gap:5px;padding:.68rem .95rem;
          background:linear-gradient(135deg,rgba(255,255,255,.05) 0%,rgba(255,185,55,.02) 100%);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border:1px solid rgba(255,185,60,.12);border-top:1px solid rgba(255,255,255,.08);
          border-radius:2px;transition:border-color .25s,box-shadow .25s,transform .25s cubic-bezier(.22,1,.36,1);
        }
        .proto:hover{border-color:rgba(255,185,60,.3);box-shadow:0 0 22px rgba(245,158,11,.1),0 6px 30px rgba(0,0,0,.5);transform:translateY(-2px)}

        .stat-pill{display:flex;flex-direction:column;align-items:center;gap:4px;padding:.65rem 1.3rem;background:rgba(255,185,60,.038);border:1px solid rgba(255,185,60,.1);border-radius:2px;transition:border-color .2s,background .2s}
        .stat-pill:hover{border-color:rgba(255,185,60,.24);background:rgba(255,185,60,.062)}

        .feed-wrap{height:90px;overflow:hidden;position:relative}
        .feed-wrap::before,.feed-wrap::after{content:'';position:absolute;left:0;right:0;height:22px;z-index:2;pointer-events:none}
        .feed-wrap::before{top:0;background:linear-gradient(180deg,rgba(4,2,0,.95),transparent)}
        .feed-wrap::after{bottom:0;background:linear-gradient(0deg,rgba(4,2,0,.95),transparent)}
        .feed-inner{animation:dataScroll 17s linear infinite}
        .feed-inner:hover{animation-play-state:paused}

        .hud-grid{
          background-size:42px 42px;
          background-image:linear-gradient(to right,rgba(255,175,50,.038) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,175,50,.038) 1px,transparent 1px);
        }
        .floor-grid{
          background-size:70px 70px;
          background-image:linear-gradient(to right,rgba(245,158,11,.1) 1px,transparent 1px),linear-gradient(to bottom,rgba(245,158,11,.07) 1px,transparent 1px);
          transform:perspective(540px) rotateX(74deg) translateY(-8%);
          transform-origin:50% 100%;
        }

        /* Portal image wrapper */
        .portal-img-wrap{
          position:relative;overflow:hidden;border-radius:4px;
          border:1.5px solid rgba(255,175,50,.22);
          animation:portalAura 5.5s ease-in-out infinite;
        }
        /* Rings absolutely positioned around the portal */
        .ring{position:absolute;border-radius:50%;top:50%;left:50%;pointer-events:none}

        .wallet-adapter-dropdown,.wallet-adapter-button-trigger,[class*="wallet-adapter-dropdown"]{display:none!important}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#0a0600}
        ::-webkit-scrollbar-thumb{background:#534434;border-radius:1px}
        ::-webkit-scrollbar-thumb:hover{background:#FFC174}
        ::selection{background:rgba(255,193,116,.22)}
      `}</style>

      {/* ══════════════ ROOT */}
      <div style={{ position:"fixed", inset:0, background:"#060300", overflow:"hidden" }}>

        {/* Sky */}
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 75% 55% at 50% 36%,#2c1500 0%,#190e00 28%,#0e0700 52%,#050200 75%,#020100 100%)" }} />

        {/* HUD grid */}
        <div className="hud-grid" style={{ position:"absolute", inset:0, opacity:.15, pointerEvents:"none", zIndex:1 }} />

        {/* Floor grid */}
        <div style={{ position:"absolute", bottom:0, left:"-8%", right:"-8%", height:"44vh", zIndex:2, pointerEvents:"none", opacity:.2 }}>
          <div className="floor-grid" style={{ position:"absolute", inset:0 }} />
        </div>

        {/* Radial vignette */}
        <div style={{ position:"absolute", inset:0, zIndex:3, pointerEvents:"none",
          background:"radial-gradient(ellipse 62% 60% at 50% 44%,transparent 0%,transparent 22%,rgba(3,1,0,.62) 68%,rgba(2,1,0,.94) 100%)" }} />

        {/* Top/bottom overlays */}
        <div style={{ position:"absolute", inset:0, zIndex:4, pointerEvents:"none",
          background:"linear-gradient(180deg,rgba(4,1,0,.92) 0%,rgba(4,1,0,.14) 11%,transparent 30%,transparent 58%,rgba(3,1,0,.78) 100%)" }} />

        {/* Scan line */}
        <div style={{ position:"absolute", inset:0, overflow:"hidden", zIndex:5, pointerEvents:"none" }}>
          <div style={{ position:"absolute", left:0, right:0, height:2, top:0,
            background:"linear-gradient(180deg,transparent,rgba(255,185,40,.036),transparent)",
            animation:"scanLine 30s linear infinite" }} />
        </div>

        {/* Particle canvas */}
        <canvas ref={particleRef} style={{ position:"absolute", inset:0, zIndex:10, pointerEvents:"none" }} />

        {/* Decorative geometry */}
        <div style={{ position:"fixed", top:"43%", left:46, width:13, height:13, border:"1px solid rgba(255,185,60,.28)", pointerEvents:"none", zIndex:11, animation:"floatY 5.8s ease-in-out infinite" }} />
        <div style={{ position:"fixed", top:"29%", left:76, width:7, height:7, border:"1px solid rgba(255,185,60,.15)", transform:"rotate(22deg)", pointerEvents:"none", zIndex:11, animation:"floatY 7.4s ease-in-out .9s infinite" }} />
        <div style={{ position:"fixed", right:62, top:"25%", width:1, height:155, background:"linear-gradient(180deg,transparent,rgba(255,185,60,.48),transparent)", pointerEvents:"none", zIndex:11, animation:"beamPulse 3.5s ease-in-out infinite" }} />
        <div style={{ position:"fixed", right:90, top:"40%", width:1, height:76, background:"linear-gradient(180deg,transparent,rgba(255,185,60,.22),transparent)", pointerEvents:"none", zIndex:11, animation:"beamPulse 4.7s ease-in-out 1.4s infinite" }} />
        <div style={{ position:"fixed", left:0, top:"63%", width:84, height:1, background:"linear-gradient(90deg,transparent,rgba(255,185,60,.24),transparent)", pointerEvents:"none", zIndex:11, animation:"beamPulse 4.1s ease-in-out .6s infinite" }} />

        {/* Corner brackets */}
        {[
          { t:62,  l:14, bt:true, bl:true, dt:".4s" },
          { t:62,  r:14, bt:true, br:true, dt:".5s" },
          { b:38, l:14, bb:true, bl:true, dt:".6s" },
          { b:38, r:14, bb:true, br:true, dt:".7s" },
        ].map((c, i) => (
          <div key={i} style={{
            position:"fixed", width:22, height:22, pointerEvents:"none", zIndex:15,
            animation:`cornerIn .7s ease-out ${c.dt} both`,
            top:    "t" in c ? c.t : undefined,
            bottom: "b" in c ? c.b : undefined,
            left:   "l" in c ? c.l : undefined,
            right:  "r" in c ? c.r : undefined,
            borderTop:    c.bt ? "1px solid rgba(255,185,60,.38)" : undefined,
            borderBottom: c.bb ? "1px solid rgba(255,185,60,.38)" : undefined,
            borderLeft:   c.bl ? "1px solid rgba(255,185,60,.38)" : undefined,
            borderRight:  c.br ? "1px solid rgba(255,185,60,.38)" : undefined,
          }} />
        ))}

        {/* ══ NAV */}
        <nav className="nav-glass" style={{
          position:"fixed", top:0, left:0, right:0, zIndex:50,
          height:60, display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 1.6rem",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1.8rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <div style={{ width:27, height:27, borderRadius:3, overflow:"hidden", flexShrink:0,
                border:"1px solid rgba(255,185,60,.36)", boxShadow:"0 0 11px rgba(245,158,11,.48)" }}>
                <img src={AETHER_IMG} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display="none" }} />
              </div>
              <span style={{ fontFamily:"'Noto Serif',serif", fontWeight:700, fontSize:"1.18rem",
                letterSpacing:"-.022em", color:"#F59E0B", userSelect:"none",
                textShadow:"0 0 13px rgba(245,158,11,.92),0 0 36px rgba(245,130,10,.4)" }}>DOMINUS</span>
            </div>
            <button className="nav-lnk on" onClick={() => router.push("/chat")}>ORACLE COMMAND</button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:".28rem .72rem",
              background:"rgba(255,185,60,.06)", border:"1px solid rgba(255,185,60,.11)", borderRadius:2 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#55FF88",
                boxShadow:"0 0 7px rgba(80,255,130,.92)", display:"inline-block", animation:"blink 2.2s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".43rem", fontWeight:600,
                letterSpacing:".18em", textTransform:"uppercase", color:"rgba(255,215,140,.46)" }}>{latency}ms</span>
            </div>
            <button onClick={() => router.push("/chat")} style={{ background:"none", border:"none", cursor:"pointer",
              color:"rgba(255,200,120,.3)", display:"flex", padding:4, transition:"color .2s" }}
              onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,185,60,.85)")}
              onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,200,120,.3)")}>
              <span className="ms" style={{ fontSize:18 }}>settings</span>
            </button>
            <button className="btn-cta" style={{ padding:".38rem 1.15rem", fontSize:".55rem", letterSpacing:".21em" }}
              onClick={() => setVisible(true)}>
              <span className="btn-shine" />
              <span className="ms" style={{ fontSize:14 }}>account_balance_wallet</span>
              CONNECT
            </button>
          </div>
        </nav>

        {/* ══ LEFT HUD */}
        <div ref={lHudRef} className="a1" style={{
          position:"fixed", left:"1.15rem", top:"50%", zIndex:20, willChange:"transform",
        }}>
          <div className="glass" style={{ padding:"1.25rem 1.05rem", minWidth:138, display:"flex", flexDirection:"column", gap:"1.15rem" }}>
            <div className="glass-top" />
            {[
              { l:"LATITUDE",       v:"24.1412.88.1" },
              { l:"ATMOSPHERE",     v:"STABLE_OXY"   },
              { l:"ARTIFACT COUNT", v:"312 / 5,000"  },
            ].map(({l,v}) => <div key={l}><span className="hl">{l}</span><span className="hv">{v}</span></div>)}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span className="hl" style={{ marginBottom:0 }}>SYNC RATIO</span>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".43rem", fontWeight:700, letterSpacing:".12em", color:"rgba(255,188,60,.65)" }}>94.2%</span>
              </div>
              <div style={{ height:2, background:"rgba(255,185,60,.1)", borderRadius:1 }}>
                <div style={{ width:"94.2%", height:"100%", borderRadius:1,
                  background:"linear-gradient(90deg,#D97706,#F59E0B,#FFD060)",
                  boxShadow:"0 0 7px rgba(245,158,11,.6)" }} />
              </div>
            </div>
            <div>
              <span className="hl" style={{ marginBottom:7 }}>LIVE FEED</span>
              <div className="feed-wrap">
                <div className="feed-inner" style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {["[14:22] Jupiter 8-hop route","[14:19] Kamino APY 5.8%","[14:15] Jito MEV +0.003 SOL","[14:08] Streamflow #4421","[14:01] Portfolio: $4,218","[13:55] SOL→USDC OK","[14:22] Jupiter 8-hop route","[14:19] Kamino APY 5.8%"].map((l,i) => (
                    <p key={i} style={{ margin:0, fontFamily:"'Space Grotesk',sans-serif", fontSize:".41rem", letterSpacing:".07em", color:"rgba(255,185,60,.3)", lineHeight:1.44 }}>{l}</p>
                  ))}
                </div>
              </div>
            </div>
            <div className="glass-bot" />
          </div>
        </div>

        {/* ══ RIGHT HUD */}
        <div ref={rHudRef} className="a1" style={{
          position:"fixed", right:"1.15rem", top:"50%", zIndex:20, willChange:"transform",
        }}>
          <div className="glass" style={{ padding:"1.25rem 1.05rem", minWidth:138, display:"flex", flexDirection:"column", gap:"1.15rem", alignItems:"flex-end" }}>
            <div className="glass-top" />
            <div style={{ textAlign:"right" }}>
              <span className="hl">SIGNAL</span>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, justifyContent:"flex-end", marginTop:6 }}>
                {[7,11,16,20,15].map((h,i) => (
                  <div key={i} style={{ width:5, height:h, borderRadius:1,
                    background: i<4 ? "rgba(255,185,60,.88)" : "rgba(255,185,60,.16)",
                    boxShadow: i<4 ? "0 0 5px rgba(245,158,11,.52)" : "none" }} />
                ))}
              </div>
            </div>
            {[{ l:"TRANSMISSION",v:"ENCRYPTED_S" },{ l:"PROTOCOL",v:"v2.4.9" },{ l:"ACTIVE NODES",v:"2,847" }].map(({l,v}) => (
              <div key={l} style={{ textAlign:"right" }}><span className="hl">{l}</span><span className="hv">{v}</span></div>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".42rem", letterSpacing:".22em", textTransform:"uppercase", color:"rgba(255,185,60,.34)" }}>LIVE</span>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#FFC060",
                boxShadow:"0 0 9px rgba(255,185,60,1),0 0 20px rgba(245,158,11,.5)", display:"inline-block", animation:"blink 2.9s ease-in-out infinite" }} />
            </div>
            <div className="glass-bot" />
          </div>
        </div>

        {/* ══ HERO */}
        <div style={{
          position:"absolute", inset:0, zIndex:16,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          paddingTop:60, paddingBottom:38,
        }}>

          {/* Wordmark */}
          <div ref={heroTextRef} style={{ textAlign:"center", willChange:"transform", transformStyle:"preserve-3d", zIndex:2, marginBottom:"1.2rem" }}>

            {/* Status tag */}
            <div className="a0" style={{
              display:"inline-flex", alignItems:"center", gap:9, padding:".36rem .95rem",
              background:"linear-gradient(135deg,rgba(255,255,255,.055),rgba(255,185,55,.02))",
              backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
              border:"1px solid rgba(255,185,60,.15)", borderTop:"1px solid rgba(255,255,255,.11)",
              borderRadius:2, marginBottom:"1.2rem",
              boxShadow:"inset 0 1px 0 rgba(255,255,255,.06),0 4px 20px rgba(0,0,0,.44)",
            }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#66FF99",
                boxShadow:"0 0 7px rgba(80,255,130,.95)", display:"inline-block", animation:"blink 2s ease-in-out infinite" }} />
              <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:600,
                letterSpacing:".33em", textTransform:"uppercase", color:"rgba(255,235,185,.44)" }}>
                SYSTEM STATUS: CONVERGENCE DETECTED
              </span>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#66FF99",
                boxShadow:"0 0 7px rgba(80,255,130,.95)", display:"inline-block", animation:"blink 2s ease-in-out .85s infinite" }} />
            </div>

            {/* DOMINUS */}
            <h1 className="a1" style={{
              fontFamily:"'Noto Serif',serif", fontWeight:400, lineHeight:.86,
              letterSpacing:"-.025em", margin:0, userSelect:"none",
              fontSize:"clamp(4.6rem,12.5vw,9.8rem)",
              background:"linear-gradient(155deg,#FFE988 0%,#FFD060 13%,#F5A814 44%,#F59E0B 60%,#D87706 82%,#FFD060 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
              animation:"glowPulse 4.8s ease-in-out infinite",
            }}>
              <span style={{ display:"inline-block", animation:"glitch 22s ease-in-out infinite" }}>DOMINUS</span>
            </h1>

            {/* Subtitle */}
            <p className="a2" style={{
              fontFamily:"'Noto Serif',serif", fontStyle:"italic",
              fontSize:"clamp(.7rem,1.35vw,.92rem)", letterSpacing:".24em",
              color:"rgba(188,218,255,.4)", marginTop:".9rem",
              textShadow:"0 2px 16px rgba(0,0,0,.95)",
            }}>Sanctum of the Eternal Gate</p>
          </div>

          {/* ══ THE 3D PORTAL */}
          <div className="a2" style={{ position:"relative", zIndex:1, marginBottom:"1.2rem" }}>

            {/* Outer haze glow */}
            <div style={{
              position:"absolute", top:"5%", left:"50%", transform:"translateX(-50%)",
              width:"140%", height:"72%",
              background:"radial-gradient(ellipse,rgba(255,125,18,.24) 0%,rgba(245,100,5,.08) 48%,transparent 72%)",
              filter:"blur(60px)", pointerEvents:"none", zIndex:0,
            }} />

            {/* 3D parallax wrapper */}
            <div ref={portalRef} style={{
              position:"relative", willChange:"transform", transformStyle:"preserve-3d",
            }}>

              {/* Orbital rings — positioned relative to centre of portal image */}
              {[
                { s:300, dur:4,    dir:"ringCW",   op:.44, w:1.5, c:"245,158,11" },
                { s:400, dur:7,    dir:"ringCCW",  op:.26, w:1,   c:"255,180,40" },
                { s:520, dur:11,   dir:"ringCW",   op:.16, w:1,   c:"245,140,10" },
                { s:660, dur:15,   dir:"ringCCW",  op:.09, w:1,   c:"255,165,25" },
              ].map(({ s,dur,dir,op,w,c },i) => (
                <div key={i} className="ring" style={{
                  width:s, height:s, marginTop:-s/2, marginLeft:-s/2,
                  border:`${w}px solid rgba(${c},${op})`,
                  animation:`${dir} ${dur}s linear ${i*.32}s infinite`,
                  boxShadow:`0 0 ${w*6}px rgba(${c},${op*.38})`,
                }} />
              ))}

              {/* Portal image */}
              <div className="portal-img-wrap" style={{
                width:"clamp(240px,30vw,420px)",
                aspectRatio:"3/4",
                boxShadow:"0 0 0 1px rgba(255,200,80,.07),0 0 90px rgba(245,130,10,.42),0 0 230px rgba(245,100,5,.2),0 44px 100px rgba(0,0,0,.88)",
              }}>
                <img
                  src={GATE_IMG}
                  alt="The Eternal Gate"
                  onLoad={() => setImgLoaded(true)}
                  style={{
                    width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 18%",
                    filter:"brightness(1.14) contrast(1.09) saturate(1.18)",
                    display:"block",
                    opacity: imgLoaded ? 1 : 0,
                    transition:"opacity .9s ease",
                  }}
                />
                {/* Radial inner vignette */}
                <div style={{ position:"absolute", inset:0, pointerEvents:"none",
                  background:"radial-gradient(ellipse 58% 52% at 50% 38%,transparent 0%,transparent 32%,rgba(3,1,0,.52) 78%,rgba(2,1,0,.84) 100%)" }} />
                {/* Bottom blend into fire */}
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"44%", pointerEvents:"none",
                  background:"linear-gradient(0deg,rgba(3,1,0,.97) 0%,rgba(6,2,0,.58) 40%,transparent 100%)" }} />
                {/* Top */}
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"18%", pointerEvents:"none",
                  background:"linear-gradient(180deg,rgba(3,1,0,.68) 0%,transparent 100%)" }} />
                {/* Amber screen overlay */}
                <div style={{ position:"absolute", inset:0, pointerEvents:"none",
                  background:"radial-gradient(ellipse 52% 38% at 50% 52%,rgba(255,130,10,.07) 0%,transparent 68%)",
                  mixBlendMode:"screen" }} />
                {/* Loading skeleton */}
                {!imgLoaded && (
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,#0d0800,#1a100a,#0d0800)",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", letterSpacing:".22em",
                      textTransform:"uppercase", color:"rgba(255,185,60,.28)", animation:"blink 1.4s ease-in-out infinite" }}>
                      LOADING GATE...
                    </span>
                  </div>
                )}
              </div>

              {/* Fire canvas — erupts from portal base */}
              <div style={{
                position:"absolute", bottom:-22, left:"50%", transform:"translateX(-50%)",
                width:"clamp(240px,30vw,420px)", height:110,
                pointerEvents:"none", zIndex:5,
              }}>
                <canvas ref={fireRef} style={{
                  width:"100%", height:"100%", imageRendering:"pixelated",
                  opacity:.8, mixBlendMode:"screen",
                  maskImage:"radial-gradient(ellipse 62% 82% at 50% 82%,black 0%,black 28%,transparent 74%)",
                  WebkitMaskImage:"radial-gradient(ellipse 62% 82% at 50% 82%,black 0%,black 28%,transparent 74%)",
                }} />
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="a3" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:".95rem", zIndex:2 }}>
            <button className="btn-cta" style={{ padding:"1.05rem 3.4rem" }} onClick={() => setVisible(true)}>
              <span className="btn-shine" />
              <span className="ms" style={{ fontSize:16 }}>account_balance_wallet</span>
              CONNECT WALLET
            </button>
            <button className="btn-ghost" onClick={() => router.push("/chat")}>ENTER VIA GUEST PROTOCOL</button>
          </div>

          {/* Protocol cards */}
          <div className="a4" style={{
            display:"flex", gap:5, marginTop:"1.4rem", flexWrap:"wrap", justifyContent:"center", maxWidth:540, zIndex:2,
          }}>
            {[
              { p:"JUPITER",    d:"Best-route swaps",  icon:"swap_horiz",  apy:null    },
              { p:"KAMINO",     d:"Yield deposits",     icon:"trending_up", apy:"5.8%" },
              { p:"JITO",       d:"Liquid staking",     icon:"bolt",        apy:"8.2%" },
              { p:"STREAMFLOW", d:"Recurring payments", icon:"stream",      apy:null    },
            ].map(({ p,d,icon,apy }) => (
              <div key={p} className="proto">
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span className="ms" style={{ fontSize:13, color:"rgba(255,185,60,.65)",
                    fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20" }}>{icon}</span>
                  <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:700,
                    letterSpacing:".19em", textTransform:"uppercase", color:"rgba(255,185,60,.68)" }}>{p}</span>
                </div>
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".53rem", color:"rgba(229,226,225,.3)", lineHeight:1.4, margin:0 }}>{d}</p>
                {apy && <span style={{ fontFamily:"'Noto Serif',serif", fontSize:".64rem", color:"rgba(255,185,60,.8)", fontWeight:700 }}>{apy} APY</span>}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="a4" style={{ display:"flex", gap:5, marginTop:"1rem", flexWrap:"wrap", justifyContent:"center", zIndex:2 }}>
            {[{ l:"PROTOCOLS",v:"4" },{ l:"NETWORK",v:"SOLANA" },{ l:"SPEED",v:"< 1s" },{ l:"TVL",v:"$4.2M" }].map(({ l,v }) => (
              <div key={l} className="stat-pill">
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".41rem", letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,210,130,.24)" }}>{l}</span>
                <span style={{ fontFamily:"'Noto Serif',serif", fontSize:".9rem", fontWeight:700, color:"rgba(255,188,62,.86)", textShadow:"0 0 11px rgba(245,158,11,.44)" }}>{v}</span>
              </div>
            ))}
          </div>

          <p className="a5" style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".41rem", letterSpacing:".14em",
            textTransform:"uppercase", color:"rgba(255,215,150,.14)", marginTop:"1.1rem", zIndex:2 }}>
            DOMINUS NEVER EXECUTES WITHOUT YOUR EXPLICIT CONFIRMATION
          </p>
        </div>

        {/* ══ STATUS BAR */}
        <div className="sb-glass" style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:50,
          height:38, display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 1.6rem",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:".82rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#FFC060",
                boxShadow:"0 0 8px rgba(255,185,60,1),0 0 18px rgba(245,158,11,.46)", display:"inline-block",
                animation:"blink 2.9s ease-in-out infinite" }} />
              <span className="sb">CORE PRIME CONNECTED</span>
            </div>
            <div style={{ width:1, height:11, background:"rgba(255,180,50,.13)" }} />
            <span className="sb">EPOCH: <strong style={{ color:"rgba(255,185,60,.7)", fontWeight:700 }}>{epoch.toFixed(2)}.ALPHA</strong></span>
            <div style={{ width:1, height:11, background:"rgba(255,180,50,.13)" }} />
            <span className="sb">LATENCY: <strong style={{ color:"rgba(100,255,155,.54)", fontWeight:700 }}>{latency}ms</strong></span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:".82rem" }}>
            <span className="sb" style={{ color:"rgba(255,215,140,.21)" }}>{network}</span>
            <div style={{ width:1, height:11, background:"rgba(255,180,50,.13)" }} />
            <div style={{ display:"flex", gap:3, alignItems:"center" }}>
              {[24,10,17].map((w,i) => (
                <div key={i} style={{ width:w, height:2, borderRadius:1,
                  background: i!==1 ? "rgba(255,185,60,.65)" : "rgba(255,185,60,.17)",
                  boxShadow: i!==1 ? "0 0 4px rgba(245,158,11,.44)" : "none" }} />
              ))}
            </div>
            <span className="sb">V2.4.9-SECURE</span>
          </div>
        </div>

      </div>
    </>
  )
}
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";

// ── Local images — make sure these exist in /public/images/ ──
const GATE_IMG = "/images/gate-bg.jpg";
const AETHER_IMG = "/images/aether-avatar.jpg";

function buildFirePalette(): Uint32Array {
  const p = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = 0,
      g = 0,
      b = 0;
    if (i < 64) {
      r = i * 3;
    } else if (i < 128) {
      r = 192 + (i - 64);
      g = (i - 64) * 2;
    } else if (i < 192) {
      r = 255;
      g = 128 + (i - 128) * 2;
    } else {
      r = 255;
      g = 255;
      b = (i - 192) * 4;
    }
    p[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return p;
}

function shortenAddress(addr: string, chars = 4) {
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export default function LandingPage() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [epoch, setEpoch] = useState(1492.05);
  const [latency, setLatency] = useState(0.021);
  const [imgLoaded, setImgLoaded] = useState(false);

  const fireRef = useRef<HTMLCanvasElement>(null);
  const particleRef = useRef<HTMLCanvasElement>(null);
  const auroraRef = useRef<HTMLCanvasElement>(null);
  const gateImgRef = useRef<HTMLDivElement>(null); // replaces portalRef
  const heroTextRef = useRef<HTMLDivElement>(null);
  const lHudRef = useRef<HTMLDivElement>(null);
  const rHudRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const e = setInterval(
      () => setEpoch((p) => parseFloat((p + 0.01).toFixed(2))),
      90,
    );
    const l = setInterval(
      () => setLatency(parseFloat((0.018 + Math.random() * 0.008).toFixed(3))),
      2400,
    );
    return () => {
      clearInterval(e);
      clearInterval(l);
    };
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  const startRAF = useCallback(() => {
    const tick = () => {
      const m = mouse.current;
      m.x += (m.tx - m.x) * 0.04;
      m.y += (m.ty - m.y) * 0.04;
      // Gate image: very subtle parallax so the full-screen bg shifts gently
      if (gateImgRef.current)
        gateImgRef.current.style.transform = `scale(1.06) translate(${m.x * -12}px, ${m.y * -8}px)`;
      // Hero wordmark: gentle tilt
      if (heroTextRef.current)
        heroTextRef.current.style.transform = `perspective(1800px) rotateX(${m.y * -2.5}deg) rotateY(${m.x * 2.5}deg)`;
      if (lHudRef.current)
        lHudRef.current.style.transform = `translateY(-50%) translate(${m.x * 9}px,${m.y * 6}px)`;
      if (rHudRef.current)
        rHudRef.current.style.transform = `translateY(-50%) translate(${m.x * 9}px,${m.y * 6}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => startRAF(), [startRAF]);

  // ── AURORA NEBULA ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = auroraRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    type Ribbon = {
      phase: number;
      speed: number;
      amplitude: number;
      yBase: number;
      hue: number;
      alpha: number;
      width: number;
      waveLen: number;
    };
    const ribbons: Ribbon[] = Array.from({ length: 18 }, (_, i) => ({
      phase: Math.random() * Math.PI * 2,
      speed: 0.0004 + Math.random() * 0.0006,
      amplitude: 40 + Math.random() * 120,
      yBase: 0.25 + (i / 18) * 0.55,
      hue: 18 + Math.random() * 26,
      alpha: 0.012 + Math.random() * 0.028,
      width: 60 + Math.random() * 180,
      waveLen: 0.003 + Math.random() * 0.004,
    }));

    type Orb = {
      x: number;
      y: number;
      r: number;
      phase: number;
      speed: number;
      hue: number;
      alpha: number;
    };
    const orbs: Orb[] = Array.from({ length: 6 }, () => ({
      x: 0.2 + Math.random() * 0.6,
      y: 0.2 + Math.random() * 0.6,
      r: 120 + Math.random() * 220,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0003 + Math.random() * 0.0004,
      hue: 16 + Math.random() * 30,
      alpha: 0.04 + Math.random() * 0.06,
    }));

    let t = 0,
      raf: number;
    const draw = () => {
      t++;
      const W = canvas.width,
        H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      orbs.forEach((orb) => {
        const pulse = 0.7 + 0.3 * Math.sin(t * orb.speed * 1000 + orb.phase);
        const r = orb.r * pulse;
        const x = orb.x * W + Math.sin(t * orb.speed * 800 + orb.phase) * 40;
        const y = orb.y * H + Math.cos(t * orb.speed * 600 + orb.phase) * 30;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `hsla(${orb.hue},100%,55%,${orb.alpha * pulse})`);
        g.addColorStop(
          0.4,
          `hsla(${orb.hue},90%,40%,${orb.alpha * 0.5 * pulse})`,
        );
        g.addColorStop(1, `hsla(${orb.hue},80%,20%,0)`);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      ribbons.forEach((rb) => {
        const yc = rb.yBase * H;
        const steps = Math.ceil(W / 6);
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const x = (s / steps) * W;
          const y =
            yc +
            Math.sin(x * rb.waveLen + t * rb.speed * 1000 + rb.phase) *
              rb.amplitude;
          s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${rb.hue},100%,62%,${rb.alpha})`;
        ctx.lineWidth = rb.width;
        ctx.filter = "blur(38px)";
        ctx.stroke();
        ctx.filter = "none";
      });

      ribbons.slice(0, 8).forEach((rb) => {
        const yc = rb.yBase * H;
        ctx.beginPath();
        const steps = Math.ceil(W / 4);
        for (let s = 0; s <= steps; s++) {
          const x = (s / steps) * W;
          const y =
            yc +
            Math.sin(
              x * rb.waveLen * 1.6 + t * rb.speed * 1200 + rb.phase + 0.8,
            ) *
              rb.amplitude *
              0.6;
          s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${rb.hue + 10},100%,78%,${rb.alpha * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.filter = "blur(3px)";
        ctx.stroke();
        ctx.filter = "none";
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ── DOOM FIRE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fireRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 400,
      H = 160;
    canvas.width = W;
    canvas.height = H;
    const palette = buildFirePalette();
    const fire = new Uint8Array(W * H);
    const imgData = ctx.createImageData(W, H);
    const buf32 = new Uint32Array(imgData.data.buffer);
    const seed = () => {
      const cx = Math.floor(W / 2),
        hw = Math.floor(W * 0.42);
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - cx) / hw;
        const h = d < 1 ? Math.floor(255 * Math.pow(1 - d * d, 0.5)) : 0;
        fire[(H - 1) * W + x] = h;
        fire[(H - 2) * W + x] = Math.max(0, h - 10);
      }
    };
    const step = () => {
      seed();
      for (let y = 0; y < H - 1; y++)
        for (let x = 0; x < W; x++) {
          const src = (y + 1) * W + x;
          const decay = Math.floor(Math.random() * 3);
          const dx = Math.random() < 0.5 ? -1 : 0;
          fire[y * W + ((x + dx + W) % W)] = Math.max(0, fire[src] - decay);
        }
    };
    let raf: number;
    const loop = () => {
      step();
      for (let i = 0; i < W * H; i++) buf32[i] = palette[fire[i]];
      ctx.putImageData(imgData, 0, 0);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── PARTICLES ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = particleRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      op: number;
      life: number;
      maxLife: number;
      type: "ember" | "dust" | "spark" | "ring";
      ringR?: number;
      ringMaxR?: number;
      ringAlpha?: number;
    };

    const makeParticle = (i: number): P => {
      const roll = Math.random();
      if (roll < 0.04) {
        // Expanding ring bursts — rare, dramatic
        return {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          r: 0,
          op: 0,
          life: 0,
          maxLife: 1,
          type: "ring",
          ringR: 0,
          ringMaxR: 60 + Math.random() * 120,
          ringAlpha: 0.6,
        };
      }
      if (roll < 0.35) {
        // Sparks — fast, bright, short-lived
        const angle = Math.random() * Math.PI * 2;
        const spd = 0.8 + Math.random() * 2.2;
        return {
          x: 0,
          y: 0,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - Math.random() * 1.5,
          r: Math.random() * 1.4 + 0.4,
          op: 0.9 + Math.random() * 0.1,
          life: Math.random() * 40,
          maxLife: 40 + Math.random() * 60,
          type: "spark",
        };
      }
      if (roll < 0.65) {
        // Embers — rise upward
        return {
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -(Math.random() * 1.8 + 0.4),
          r: Math.random() * 2.4 + 0.5,
          op: Math.random() * 0.7 + 0.25,
          life: Math.random() * 160,
          maxLife: 120 + Math.random() * 140,
          type: "ember",
        };
      }
      // Dust — large, slow, atmospheric
      return {
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 3.5 + 1.2,
        op: Math.random() * 0.18 + 0.04,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
        type: "dust",
      };
    };

    const pts: P[] = Array.from({ length: 160 }, (_, i) => makeParticle(i));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width * 0.5,
        cy = canvas.height * 0.48; // slightly above center (gate portal)
      const mx = mouse.current.x,
        my = mouse.current.y;

      pts.forEach((p, idx) => {
        // Respawn dead particles
        if (p.life === 0 || p.life > p.maxLife) {
          const fresh = makeParticle(idx);
          if (fresh.type === "ring") {
            fresh.x = cx + (Math.random() - 0.5) * 280;
            fresh.y = cy + (Math.random() - 0.5) * 180;
          } else if (fresh.type === "spark") {
            fresh.x = cx + (Math.random() - 0.5) * 160;
            fresh.y = cy + 20 + Math.random() * 80;
          } else if (fresh.type === "ember") {
            fresh.x = cx + (Math.random() - 0.5) * 320;
            fresh.y = cy + 60 + Math.random() * 120;
          } else {
            fresh.x = cx + (Math.random() - 0.5) * 600;
            fresh.y = cy + (Math.random() - 0.5) * 340;
          }
          Object.assign(p, fresh);
          p.life = 1;
          return;
        }
        p.life++;

        if (p.type === "ring") {
          // Expanding ring burst
          const rr = p.ringR ?? 0;
          const rm = p.ringMaxR ?? 80;
          p.ringR = rr + rm * 0.035;
          const frac = (p.ringR ?? 0) / rm;
          const al =
            (p.ringAlpha ?? 0.5) * (1 - frac) * (frac < 0.2 ? frac / 0.2 : 1);
          if (al > 0.005) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.ringR ?? 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(245,158,11,${al})`;
            ctx.lineWidth = 1.5 * (1 - frac);
            ctx.stroke();
          }
          if ((p.ringR ?? 0) >= rm) p.life = p.maxLife + 1;
          return;
        }

        const frac = p.life / p.maxLife;
        const fade =
          frac < 0.12
            ? frac / 0.12
            : frac > 0.72
              ? 1 - (frac - 0.72) / 0.28
              : 1;
        const al = p.op * fade;

        p.x += p.vx + mx * 0.006 + (Math.random() - 0.5) * 0.1;
        p.y += p.vy + my * 0.004;

        if (p.type === "ember" || p.type === "spark") {
          // Glow halo
          const g = ctx.createRadialGradient(
            p.x,
            p.y,
            0,
            p.x,
            p.y,
            p.r * (p.type === "spark" ? 4 : 6),
          );
          const hue =
            p.type === "spark"
              ? `255,${200 + Math.floor(frac * 55)},60`
              : `255,${170 + Math.floor(frac * 70)},${Math.floor(frac * 90)}`;
          g.addColorStop(0, `rgba(${hue},${al * 0.55})`);
          g.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (p.type === "spark" ? 4 : 6), 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          // Core dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle =
            p.type === "spark"
              ? `rgba(255,240,180,${al})`
              : `rgba(255,${180 + Math.floor(frac * 60)},${Math.floor(frac * 80)},${al})`;
          ctx.fill();
        } else {
          // Dust — soft large circle
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          g.addColorStop(0, `rgba(245,168,40,${al})`);
          g.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (!mounted)
    return (
      <div style={{ background: "#09090B", width: "100vw", height: "100vh" }} />
    );

  const network =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
      ? "MAINNET"
      : "DEVNET";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden}
        .ms{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24;line-height:1;user-select:none;display:inline-block}

        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes portalAura{
          0%,100%{box-shadow:0 0 0 1px rgba(255,200,80,.12),0 0 60px 10px rgba(245,130,10,.55),0 0 130px 30px rgba(245,100,5,.3),0 0 260px 60px rgba(220,80,5,.15),0 50px 120px rgba(0,0,0,.9),inset 0 0 60px rgba(255,150,20,.1)}
          50%{box-shadow:0 0 0 1px rgba(255,215,80,.18),0 0 90px 18px rgba(255,165,20,.72),0 0 200px 50px rgba(245,120,10,.4),0 0 380px 80px rgba(220,90,5,.2),0 50px 120px rgba(0,0,0,.9),inset 0 0 100px rgba(255,185,35,.16)}
        }
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
        @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

        .a0{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) both}
        .a1{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .12s both}
        .a2{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .26s both}
        .a3{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .42s both}
        .a4{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .58s both}
        .a5{animation:fadeUp .9s cubic-bezier(.22,1,.36,1) .76s both}

        .glass{
          background:linear-gradient(135deg,rgba(255,255,255,.065) 0%,rgba(245,158,11,.018) 50%,rgba(255,255,255,.042) 100%);
          backdrop-filter:blur(28px) saturate(1.5) brightness(1.04);
          -webkit-backdrop-filter:blur(28px) saturate(1.5) brightness(1.04);
          border:1px solid rgba(255,255,255,.08);
          border-top:1px solid rgba(255,255,255,.12);
          border-left:1px solid rgba(255,255,255,.06);
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.2),0 10px 50px rgba(0,0,0,.72),0 0 28px rgba(245,158,11,.04);
          position:relative;overflow:hidden;border-radius:12px;
        }
        .glass::before{
          content:'';position:absolute;inset:0;pointer-events:none;border-radius:12px;
          background:linear-gradient(108deg,transparent 24%,rgba(255,255,255,.055) 50%,transparent 76%);
          background-size:250% 100%;animation:shimmerSweep 11s ease-in-out infinite;
        }
        .glass-top{position:absolute;top:0;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent,rgba(245,158,11,.45),transparent);border-radius:12px 12px 0 0}
        .glass-bot{position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(245,158,11,.18),transparent);border-radius:0 0 12px 12px}

        .nav-glass{
          background:rgba(9,9,11,.72);
          backdrop-filter:blur(32px) saturate(1.6);-webkit-backdrop-filter:blur(32px) saturate(1.6);
          border-bottom:1px solid rgba(255,255,255,.07);
          box-shadow:0 1px 0 rgba(255,255,255,.03),0 20px 58px rgba(0,0,0,.6);
        }
        .sb-glass{
          background:rgba(9,9,11,.82);
          backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
          border-top:1px solid rgba(255,255,255,.06);
          box-shadow:0 -14px 46px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.025);
        }

        .btn-cta{
          position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
          font-family:'Space Grotesk',sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
          color:#1C0A00;
          background:linear-gradient(135deg,#FCD34D 0%,#F59E0B 55%,#D97706 100%);
          border:none;border-radius:8px;cursor:pointer;overflow:hidden;
          box-shadow:0 0 0 1px rgba(255,215,80,.25),0 0 44px rgba(245,158,11,.65),0 0 90px rgba(245,128,10,.22),0 6px 30px rgba(0,0,0,.7),inset 0 1.5px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.2);
          transition:transform .22s cubic-bezier(.22,1,.36,1),box-shadow .22s;
          text-shadow:0 1px 0 rgba(255,255,255,.35);
        }
        .btn-cta::before{content:'';position:absolute;inset:-3px;border:1px solid rgba(255,220,80,.65);border-radius:11px;filter:blur(5px);pointer-events:none;animation:beamPulse 2.8s ease-in-out infinite}
        .btn-cta:hover{transform:scale(1.055) translateY(-2px);box-shadow:0 0 0 1px rgba(255,220,80,.45),0 0 62px rgba(255,185,10,.95),0 0 140px rgba(245,140,10,.4),0 20px 55px rgba(0,0,0,.72),inset 0 1.5px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.2)}
        .btn-cta:active{transform:scale(.97)}
        .btn-shine{position:absolute;inset:0;background:linear-gradient(108deg,transparent 28%,rgba(255,255,255,.24) 50%,transparent 72%);background-size:250% 100%;background-position:250% 0;transition:background-position .5s}
        .btn-cta:hover .btn-shine{background-position:-250% 0}

        .btn-ghost{font-family:'Space Grotesk',sans-serif;font-size:.58rem;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.2);background:none;border:none;border-bottom:1px solid transparent;padding-bottom:2px;cursor:pointer;transition:color .2s,border-color .2s}
        .btn-ghost:hover{color:rgba(245,158,11,.65);border-bottom-color:rgba(245,158,11,.3)}

        .nav-lnk{font-family:'Space Grotesk',sans-serif;font-size:.64rem;font-weight:700;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,255,255,.2);background:none;border:none;border-bottom:1.5px solid transparent;padding-bottom:3px;cursor:pointer;transition:color .2s,border-color .2s;text-decoration:none}
        .nav-lnk:hover,.nav-lnk.on{color:#F59E0B;border-bottom-color:rgba(245,158,11,.7)}

        .hl{font-family:'Space Grotesk',sans-serif;font-size:.42rem;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.18);display:block;margin-bottom:4px}
        .hv{font-family:'Space Grotesk',sans-serif;font-size:.65rem;font-weight:700;letter-spacing:.12em;color:rgba(245,158,11,.82)}
        .sb{font-family:'Space Grotesk',sans-serif;font-size:.43rem;font-weight:600;letter-spacing:.19em;text-transform:uppercase;color:rgba(255,255,255,.2)}

        .proto{
          display:flex;flex-direction:column;gap:5px;padding:.68rem .95rem;
          background:rgba(9,9,11,.55);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border:1px solid rgba(255,255,255,.08);
          border-radius:8px;
          transition:border-color .25s,box-shadow .25s,transform .25s cubic-bezier(.22,1,.36,1);
          box-shadow:0 4px 20px rgba(0,0,0,.4);
        }
        .proto:hover{border-color:rgba(245,158,11,.3);box-shadow:0 0 22px rgba(245,158,11,.12),0 8px 32px rgba(0,0,0,.55);transform:translateY(-2px)}

        .stat-pill{display:flex;flex-direction:column;align-items:center;gap:4px;padding:.65rem 1.3rem;background:rgba(9,9,11,.55);border:1px solid rgba(255,255,255,.08);border-radius:8px;transition:border-color .2s,background .2s;box-shadow:0 4px 18px rgba(0,0,0,.38)}
        .stat-pill:hover{border-color:rgba(245,158,11,.22);background:rgba(245,158,11,.05)}

        .feed-wrap{height:90px;overflow:hidden;position:relative}
        .feed-wrap::before,.feed-wrap::after{content:'';position:absolute;left:0;right:0;height:22px;z-index:2;pointer-events:none}
        .feed-wrap::before{top:0;background:linear-gradient(180deg,rgba(9,9,11,.95),transparent)}
        .feed-wrap::after{bottom:0;background:linear-gradient(0deg,rgba(9,9,11,.95),transparent)}
        .feed-inner{animation:dataScroll 17s linear infinite}
        .feed-inner:hover{animation-play-state:paused}

        .hud-grid{
          background-size:42px 42px;
          background-image:linear-gradient(to right,rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.025) 1px,transparent 1px);
        }
        .floor-grid{
          background-size:70px 70px;
          background-image:linear-gradient(to right,rgba(245,158,11,.08) 1px,transparent 1px),linear-gradient(to bottom,rgba(245,158,11,.06) 1px,transparent 1px);
          transform:perspective(540px) rotateX(74deg) translateY(-8%);
          transform-origin:50% 100%;
        }

        /* Connected overlay card */
        .connected-card{
          background:rgba(6,6,9,.88);
          backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);
          border:1px solid rgba(245,158,11,.2);
          border-top:1px solid rgba(245,158,11,.35);
          border-radius:12px;
          box-shadow:0 0 40px rgba(245,158,11,.08),0 20px 60px rgba(0,0,0,.8);
          animation:rise .45s cubic-bezier(.22,1,.36,1) both;
        }
        .action-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);transition:all .15s}
        .action-row:hover{background:rgba(245,158,11,.07);border-color:rgba(245,158,11,.2)}

        .wallet-adapter-dropdown,.wallet-adapter-button-trigger,[class*="wallet-adapter-dropdown"]{display:none!important}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#09090B}
        ::-webkit-scrollbar-thumb{background:#27272E;border-radius:1px}
        ::-webkit-scrollbar-thumb:hover{background:#F59E0B}
        ::selection{background:rgba(245,158,11,.2)}

        /* ── DOMINUS wordmark — solid color + text-shadow glow            */
        /* DO NOT use -webkit-background-clip:text with any filter ancestor */
        /* filter on parent + background-clip:text = invisible in WebKit    */
        .dominus-wrap {
          position: relative;
          display: block;
          width: 100%;
          text-align: center;
        }
        /* Blur glow layer behind — separate element, filter safe here */
        .dominus-glow {
          position: absolute;
          inset: 0;
          font-family: 'Noto Serif', serif;
          font-weight: 400;
          line-height: 0.82;
          letter-spacing: -0.02em;
          font-size: clamp(4.5rem, 11vw, 9rem);
          color: #F59E0B;
          filter: blur(22px);
          opacity: 0.38;
          pointer-events: none;
          animation: glowBreathe 5s ease-in-out infinite;
          user-select: none;
          text-align: center;
          width: 100%;
        }
        @keyframes glowBreathe {
          0%,100% { opacity: 0.28; filter: blur(18px); }
          50%      { opacity: 0.55; filter: blur(30px); }
        }
        /* Sharp text on top — no filter anywhere in this chain */
        .dominus-text {
          position: relative;
          font-family: 'Noto Serif', serif;
          font-weight: 400;
          line-height: 0.82;
          letter-spacing: -0.02em;
          margin: 0;
          user-select: none;
          font-size: clamp(4.5rem, 11vw, 9rem);
          color: #FDE68A;
          text-shadow:
            0 0 14px rgba(255, 235, 120, 0.95),
            0 0 32px rgba(245, 158, 11, 0.85),
            0 0 65px rgba(245, 130, 10, 0.5),
            0 0 120px rgba(230, 100, 5, 0.25),
            0 3px 6px rgba(0, 0, 0, 0.99),
            0 6px 20px rgba(0, 0, 0, 0.9);
          display: block;
          animation: textFlicker 12s ease-in-out infinite;
        }
        @keyframes textFlicker {
          0%,100% { color: #FDE68A; }
          45%      { color: #FFF8DC; }
          50%      { color: #FFFBEB; }
          55%      { color: #FDE68A; }
          92%      { color: #FCD34D; }
          94%      { color: #F59E0B; }
          96%      { color: #FCD34D; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#09090B",
          overflow: "hidden",
        }}
      >
        {/* ── SKY BASE ──────────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 75% 55% at 50% 36%,#1a1000 0%,#100900 28%,#07060A 52%,#040405 75%,#020203 100%)",
          }}
        />

        {/* ── GATE IMAGE — full-screen background ───────────────────────── */}
        {/* This is the core visual change: image is now the bg, not a card */}
        <div
          ref={gateImgRef}
          style={{
            position: "absolute",
            inset: "-6%", // slight overscan so parallax doesn't show edges
            zIndex: 1,
            pointerEvents: "none",
            willChange: "transform",
            transition: "transform .05s linear",
          }}
        >
          <img
            src={GATE_IMG}
            alt=""
            onLoad={() => setImgLoaded(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 38%",
              filter: "brightness(.82) contrast(1.18) saturate(1.35)",
              opacity: imgLoaded ? 0.94 : 0,
              transition: "opacity 1.6s ease",
            }}
          />
          {/* Amber haze behind the gate's glow core */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 38% 55% at 50% 46%,rgba(245,110,10,.18) 0%,transparent 70%)",
              mixBlendMode: "screen",
            }}
          />
        </div>

        {/* ── AURORA CANVAS ─────────────────────────────────────────────── */}
        <canvas
          ref={auroraRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />

        {/* ── HUD GRID ──────────────────────────────────────────────────── */}
        <div
          className="hud-grid"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* ── FLOOR GRID ────────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "-8%",
            right: "-8%",
            height: "44vh",
            zIndex: 3,
            pointerEvents: "none",
            opacity: 0.14,
          }}
        >
          <div
            className="floor-grid"
            style={{ position: "absolute", inset: 0 }}
          />
        </div>

        {/* ── RADIAL VIGNETTE — draws focus to center where gate/wordmark are */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 55% 58% at 50% 44%,transparent 0%,transparent 14%,rgba(5,5,8,.52) 58%,rgba(4,4,7,.93) 100%)",
          }}
        />

        {/* ── DARK CROWN — critical: darkens the TOP HALF where DOMINUS lives  */}
        {/* Without this, the bright gate center bleeds up and swallows the gold text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 52% at 50% 22%, rgba(4,3,6,.72) 0%, rgba(4,3,6,.4) 48%, transparent 75%)",
          }}
        />

        {/* ── TOP/BOTTOM FADE OVERLAYS ───────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg,rgba(9,9,11,.95) 0%,rgba(9,9,11,.1) 9%,transparent 26%,transparent 62%,rgba(9,9,11,.88) 100%)",
          }}
        />

        {/* ── SCAN LINE ─────────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            zIndex: 7,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 2,
              top: 0,
              background:
                "linear-gradient(180deg,transparent,rgba(245,158,11,.03),transparent)",
              animation: "scanLine 30s linear infinite",
            }}
          />
        </div>

        {/* ── DEPTH LAYERS — floating amber orbs at different z-depths ─── */}
        {/* These give a sense of 3D parallax depth in front of the gate   */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            pointerEvents: "none",
          }}
        >
          {/* Deep background haze — wide, soft, behind gate glow */}
          <div
            style={{
              position: "absolute",
              left: "30%",
              top: "20%",
              width: "40vw",
              height: "40vw",
              background:
                "radial-gradient(circle, rgba(245,130,10,.12) 0%, transparent 65%)",
              filter: "blur(60px)",
              animation: "beamPulse 6s ease-in-out infinite",
            }}
          />
          {/* Mid-layer orb — left side depth accent */}
          <div
            style={{
              position: "absolute",
              left: "8%",
              top: "35%",
              width: "18vw",
              height: "18vw",
              background:
                "radial-gradient(circle, rgba(245,158,11,.07) 0%, transparent 70%)",
              filter: "blur(40px)",
              animation: "beamPulse 8s ease-in-out 1s infinite",
            }}
          />
          {/* Mid-layer orb — right side depth accent */}
          <div
            style={{
              position: "absolute",
              right: "8%",
              top: "40%",
              width: "15vw",
              height: "15vw",
              background:
                "radial-gradient(circle, rgba(220,100,10,.06) 0%, transparent 70%)",
              filter: "blur(35px)",
              animation: "beamPulse 7s ease-in-out 2.4s infinite",
            }}
          />
          {/* Near-layer spotlight — tight, bright, directly on gate portal center */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "44%",
              transform: "translateX(-50%)",
              width: "22vw",
              height: "22vw",
              background:
                "radial-gradient(circle, rgba(255,180,20,.14) 0%, transparent 55%)",
              filter: "blur(20px)",
              animation: "portalAura 5s ease-in-out infinite",
            }}
          />
        </div>

        {/* ── FIRE CANVAS — now fixed at screen bottom, looks like gate base ── */}
        <div
          style={{
            position: "fixed",
            bottom: 38,
            left: "50%",
            transform: "translateX(-50%)",
            width: "clamp(340px,46vw,680px)",
            height: 148,
            pointerEvents: "none",
            zIndex: 11,
          }}
        >
          <canvas
            ref={fireRef}
            style={{
              width: "100%",
              height: "100%",
              imageRendering: "pixelated",
              opacity: 0.78,
              mixBlendMode: "screen",
              maskImage:
                "radial-gradient(ellipse 64% 88% at 50% 90%,black 0%,black 20%,transparent 66%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 64% 88% at 50% 90%,black 0%,black 20%,transparent 66%)",
            }}
          />
        </div>

        {/* ── PARTICLES ─────────────────────────────────────────────────── */}
        <canvas
          ref={particleRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 12,
            pointerEvents: "none",
          }}
        />

        {/* ── DECORATIVE GEOMETRY ───────────────────────────────────────── */}
        <div
          style={{
            position: "fixed",
            top: "43%",
            left: 46,
            width: 13,
            height: 13,
            border: "1px solid rgba(245,158,11,.25)",
            pointerEvents: "none",
            zIndex: 11,
            animation: "floatY 5.8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "fixed",
            top: "29%",
            left: 76,
            width: 7,
            height: 7,
            border: "1px solid rgba(245,158,11,.12)",
            transform: "rotate(22deg)",
            pointerEvents: "none",
            zIndex: 11,
            animation: "floatY 7.4s ease-in-out .9s infinite",
          }}
        />
        <div
          style={{
            position: "fixed",
            right: 62,
            top: "25%",
            width: 1,
            height: 155,
            background:
              "linear-gradient(180deg,transparent,rgba(245,158,11,.4),transparent)",
            pointerEvents: "none",
            zIndex: 11,
            animation: "beamPulse 3.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "fixed",
            right: 90,
            top: "40%",
            width: 1,
            height: 76,
            background:
              "linear-gradient(180deg,transparent,rgba(245,158,11,.18),transparent)",
            pointerEvents: "none",
            zIndex: 11,
            animation: "beamPulse 4.7s ease-in-out 1.4s infinite",
          }}
        />
        <div
          style={{
            position: "fixed",
            left: 0,
            top: "63%",
            width: 84,
            height: 1,
            background:
              "linear-gradient(90deg,transparent,rgba(245,158,11,.2),transparent)",
            pointerEvents: "none",
            zIndex: 11,
            animation: "beamPulse 4.1s ease-in-out .6s infinite",
          }}
        />

        {/* ── CORNER BRACKETS ───────────────────────────────────────────── */}
        {(
          [
            { t: 62, l: 14, bt: true, bl: true, dt: ".4s" },
            { t: 62, r: 14, bt: true, br: true, dt: ".5s" },
            { b: 38, l: 14, bb: true, bl: true, dt: ".6s" },
            { b: 38, r: 14, bb: true, br: true, dt: ".7s" },
          ] as Array<{
            t?: number;
            b?: number;
            l?: number;
            r?: number;
            bt?: boolean;
            bb?: boolean;
            bl?: boolean;
            br?: boolean;
            dt: string;
          }>
        ).map((c, i) => (
          <div
            key={i}
            style={{
              position: "fixed",
              width: 22,
              height: 22,
              pointerEvents: "none",
              zIndex: 15,
              animation: `cornerIn .7s ease-out ${c.dt} both`,
              top: c.t !== undefined ? c.t : undefined,
              bottom: c.b !== undefined ? c.b : undefined,
              left: c.l !== undefined ? c.l : undefined,
              right: c.r !== undefined ? c.r : undefined,
              borderTop: c.bt ? "1px solid rgba(245,158,11,.35)" : undefined,
              borderBottom: c.bb ? "1px solid rgba(245,158,11,.35)" : undefined,
              borderLeft: c.bl ? "1px solid rgba(245,158,11,.35)" : undefined,
              borderRight: c.br ? "1px solid rgba(245,158,11,.35)" : undefined,
            }}
          />
        ))}

        {/* ══ NAV ══════════════════════════════════════════════════════════ */}
        <nav
          className="nav-glass"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.6rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: 8,
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "1px solid rgba(245,158,11,.32)",
                  boxShadow: "0 0 11px rgba(245,158,11,.42)",
                }}
              >
                <img
                  src={AETHER_IMG}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "'Noto Serif',serif",
                  fontWeight: 700,
                  fontSize: "1.18rem",
                  letterSpacing: "-.022em",
                  color: "#F59E0B",
                  userSelect: "none",
                  textShadow:
                    "0 0 14px rgba(245,158,11,.9),0 0 36px rgba(245,130,10,.35)",
                }}
              >
                DOMINUS
              </span>
            </div>
            <button className="nav-lnk on" onClick={() => router.push("/chat")}>
              ORACLE COMMAND
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: ".28rem .72rem",
                background: "rgba(245,158,11,.06)",
                border: "1px solid rgba(245,158,11,.1)",
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#22C55E",
                  boxShadow: "0 0 7px rgba(34,197,94,.9)",
                  display: "inline-block",
                  animation: "blink 2.2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: ".43rem",
                  fontWeight: 600,
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.3)",
                }}
              >
                {latency}ms
              </span>
            </div>

            {connected && publicKey ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: ".3rem .75rem",
                    background: "rgba(245,158,11,.07)",
                    border: "1px solid rgba(245,158,11,.18)",
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#F59E0B",
                      boxShadow: "0 0 5px rgba(245,158,11,.8)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: ".6rem",
                      fontWeight: 500,
                      letterSpacing: ".06em",
                      color: "rgba(245,158,11,.75)",
                    }}
                  >
                    {shortenAddress(publicKey.toString())}
                  </span>
                </div>
                {/* Disconnect — subtle power icon, top right */}
                <button
                  onClick={() => disconnect()}
                  title="Disconnect wallet"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "1px solid rgba(255,255,255,.07)",
                    cursor: "pointer",
                    color: "rgba(255,255,255,.2)",
                    transition: "all .18s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(248,113,113,.7)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "rgba(248,113,113,.3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "rgba(255,255,255,.2)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "rgba(255,255,255,.07)";
                  }}
                >
                  <span className="ms" style={{ fontSize: 14 }}>
                    power_settings_new
                  </span>
                </button>
                <button
                  className="btn-cta"
                  style={{
                    padding: ".38rem 1.1rem",
                    fontSize: ".55rem",
                    letterSpacing: ".18em",
                  }}
                  onClick={() => router.push("/chat")}
                >
                  <span className="btn-shine" />
                  <span className="ms" style={{ fontSize: 14 }}>
                    psychology
                  </span>
                  ORACLE
                </button>
              </div>
            ) : (
              <button
                className="btn-cta"
                style={{
                  padding: ".38rem 1.15rem",
                  fontSize: ".55rem",
                  letterSpacing: ".21em",
                }}
                onClick={() => setVisible(true)}
              >
                <span className="btn-shine" />
                <span className="ms" style={{ fontSize: 14 }}>
                  account_balance_wallet
                </span>
                CONNECT
              </button>
            )}
          </div>
        </nav>

        {/* ══ LEFT HUD ═════════════════════════════════════════════════════ */}
        <div
          ref={lHudRef}
          className="a1"
          style={{
            position: "fixed",
            left: "1.15rem",
            top: "50%",
            zIndex: 20,
            willChange: "transform",
          }}
        >
          <div
            className="glass"
            style={{
              padding: "1.25rem 1.05rem",
              minWidth: 138,
              display: "flex",
              flexDirection: "column",
              gap: "1.15rem",
            }}
          >
            <div className="glass-top" />
            {[
              { l: "LATITUDE", v: "24.1412.88.1" },
              { l: "ATMOSPHERE", v: "STABLE_OXY" },
              { l: "ARTIFACT COUNT", v: "312 / 5,000" },
            ].map(({ l, v }) => (
              <div key={l}>
                <span className="hl">{l}</span>
                <span className="hv">{v}</span>
              </div>
            ))}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span className="hl" style={{ marginBottom: 0 }}>
                  SYNC RATIO
                </span>
                <span
                  style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: ".43rem",
                    fontWeight: 700,
                    letterSpacing: ".12em",
                    color: "rgba(245,158,11,.6)",
                  }}
                >
                  94.2%
                </span>
              </div>
              <div
                style={{
                  height: 2,
                  background: "rgba(255,255,255,.06)",
                  borderRadius: 1,
                }}
              >
                <div
                  style={{
                    width: "94.2%",
                    height: "100%",
                    borderRadius: 1,
                    background:
                      "linear-gradient(90deg,#D97706,#F59E0B,#FCD34D)",
                    boxShadow: "0 0 7px rgba(245,158,11,.5)",
                  }}
                />
              </div>
            </div>
            <div>
              <span className="hl" style={{ marginBottom: 7 }}>
                LIVE FEED
              </span>
              <div className="feed-wrap">
                <div
                  className="feed-inner"
                  style={{ display: "flex", flexDirection: "column", gap: 5 }}
                >
                  {[
                    "[14:22] Jupiter 8-hop route",
                    "[14:19] Kamino APY 5.8%",
                    "[14:15] Jito MEV +0.003 SOL",
                    "[14:08] Streamflow #4421",
                    "[14:01] Portfolio: $4,218",
                    "[13:55] SOL→USDC OK",
                    "[14:22] Jupiter 8-hop route",
                    "[14:19] Kamino APY 5.8%",
                  ].map((ln, i) => (
                    <p
                      key={i}
                      style={{
                        margin: 0,
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: ".41rem",
                        letterSpacing: ".07em",
                        color: "rgba(255,255,255,.18)",
                        lineHeight: 1.44,
                      }}
                    >
                      {ln}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="glass-bot" />
          </div>
        </div>

        {/* ══ RIGHT HUD ════════════════════════════════════════════════════ */}
        <div
          ref={rHudRef}
          className="a1"
          style={{
            position: "fixed",
            right: "1.15rem",
            top: "50%",
            zIndex: 20,
            willChange: "transform",
          }}
        >
          <div
            className="glass"
            style={{
              padding: "1.25rem 1.05rem",
              minWidth: 138,
              display: "flex",
              flexDirection: "column",
              gap: "1.15rem",
              alignItems: "flex-end",
            }}
          >
            <div className="glass-top" />
            <div style={{ textAlign: "right" }}>
              <span className="hl">SIGNAL</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 3,
                  justifyContent: "flex-end",
                  marginTop: 6,
                }}
              >
                {[7, 11, 16, 20, 15].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: h,
                      borderRadius: 2,
                      background:
                        i < 4 ? "rgba(245,158,11,.85)" : "rgba(245,158,11,.14)",
                      boxShadow:
                        i < 4 ? "0 0 5px rgba(245,158,11,.45)" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            {[
              { l: "TRANSMISSION", v: "ENCRYPTED_S" },
              { l: "PROTOCOL", v: "v2.4.9" },
              { l: "ACTIVE NODES", v: "2,847" },
            ].map(({ l, v }) => (
              <div key={l} style={{ textAlign: "right" }}>
                <span className="hl">{l}</span>
                <span className="hv">{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: ".42rem",
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.2)",
                }}
              >
                LIVE
              </span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#F59E0B",
                  boxShadow:
                    "0 0 9px rgba(245,158,11,1),0 0 20px rgba(245,158,11,.45)",
                  display: "inline-block",
                  animation: "blink 2.9s ease-in-out infinite",
                }}
              />
            </div>
            <div className="glass-bot" />
          </div>
        </div>

        {/* ══ ZONE A: WORDMARK — occupies top 52% of screen ═════════════ */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 0,
            right: 0,
            height: "calc(52vh - 60px)",
            zIndex: 16,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {/* DOMINUS — block level so it stacks cleanly, centered */}
          <div
            ref={heroTextRef}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              willChange: "transform",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className="a1 dominus-wrap"
              style={{ display: "block", textAlign: "center", width: "100%" }}
            >
              <div
                className="dominus-glow"
                aria-hidden="true"
                style={{ textAlign: "center" }}
              >
                DOMINUS
              </div>
              <h1 className="dominus-text" style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    animation: "glitch 22s ease-in-out infinite",
                  }}
                >
                  DOMINUS
                </span>
              </h1>
            </div>

            <p
              className="a2"
              style={{
                fontFamily: "'Noto Serif',serif",
                fontStyle: "italic",
                fontSize: "clamp(.75rem,1.35vw,.95rem)",
                letterSpacing: ".3em",
                color: "rgba(177,163,145,.72)",
                marginTop: ".9rem",
                textShadow: "0 0 30px rgba(0,0,0,1), 0 2px 8px rgba(0,0,0,1)",
                textAlign: "center",
              }}
            >
              Sanctum of the Eternal Gate
            </p>
          </div>
        </div>

        {/* ══ ZONE B: CTAs — bottom 48% of screen ══════════════════════ */}
        <div
          style={{
            position: "absolute",
            top: "52vh",
            left: 0,
            right: 0,
            bottom: 38,
            zIndex: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflowY: "auto",
            gap: 0,
            paddingTop: ".5rem",
            paddingBottom: ".5rem",
          }}
        >
          {connected && publicKey ? (
            <div
              className="a3 connected-card"
              style={{
                padding: "18px 22px",
                width: "clamp(300px,34vw,440px)",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#F59E0B",
                      boxShadow: "0 0 7px rgba(245,158,11,.8)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Space Grotesk',sans-serif",
                      fontSize: ".52rem",
                      fontWeight: 600,
                      letterSpacing: ".2em",
                      textTransform: "uppercase",
                      color: "rgba(245,158,11,.7)",
                    }}
                  >
                    WALLET CONNECTED
                  </span>
                </div>
                <button
                  onClick={() => disconnect()}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: ".46rem",
                    fontWeight: 500,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.2)",
                    transition: "color .15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "rgba(248,113,113,.7)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "rgba(255,255,255,.2)")
                  }
                >
                  DISCONNECT
                </button>
              </div>
              <p
                style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: ".54rem",
                  color: "rgba(245,158,11,.4)",
                  letterSpacing: ".06em",
                  wordBreak: "break-all",
                  marginBottom: 14,
                  fontWeight: 500,
                }}
              >
                {publicKey.toString().slice(0, 20)}…
                {publicKey.toString().slice(-8)}
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  marginBottom: 14,
                }}
              >
                {[
                  {
                    icon: "psychology",
                    label: "Oracle Command",
                    sub: "Open the AI chat interface",
                    action: () => router.push("/chat"),
                  },
                  {
                    icon: "account_balance_wallet",
                    label: "Check Portfolio",
                    sub: "View balances & positions",
                    action: () => router.push("/chat"),
                  },
                  {
                    icon: "swap_horiz",
                    label: "Swap Tokens",
                    sub: "Best price via Jupiter",
                    action: () => router.push("/chat"),
                  },
                  {
                    icon: "bolt",
                    label: "Stake SOL",
                    sub: "~8% APY with Jito liquid staking",
                    action: () => router.push("/chat"),
                  },
                ].map(({ icon, label, sub, action }) => (
                  <button key={label} className="action-row" onClick={action}>
                    <span
                      className="ms"
                      style={{
                        fontSize: 16,
                        color: "rgba(245,158,11,.6)",
                        flexShrink: 0,
                      }}
                    >
                      {icon}
                    </span>
                    <div style={{ textAlign: "left" }}>
                      <p
                        style={{
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontSize: ".66rem",
                          fontWeight: 600,
                          color: "rgba(255,255,255,.85)",
                          margin: 0,
                          letterSpacing: ".02em",
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontSize: ".56rem",
                          color: "rgba(255,255,255,.25)",
                          margin: "1px 0 0",
                          lineHeight: 1.4,
                        }}
                      >
                        {sub}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                className="btn-cta"
                style={{
                  width: "100%",
                  padding: ".95rem 0",
                  fontSize: ".65rem",
                  letterSpacing: ".22em",
                }}
                onClick={() => router.push("/chat")}
              >
                <span className="btn-shine" />
                <span className="ms" style={{ fontSize: 16 }}>
                  psychology
                </span>
                ENTER ORACLE COMMAND
              </button>
            </div>
          ) : (
            <>
              <div
                className="a3"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: ".9rem",
                  zIndex: 2,
                }}
              >
                <button
                  className="btn-cta"
                  style={{ padding: "1.15rem 3.6rem" }}
                  onClick={() => setVisible(true)}
                >
                  <span className="btn-shine" />
                  <span className="ms" style={{ fontSize: 16 }}>
                    account_balance_wallet
                  </span>
                  CONNECT WALLET
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => router.push("/chat")}
                >
                  ENTER VIA GUEST PROTOCOL
                </button>
              </div>

              {/* Protocol chips */}
              <div
                className="a4"
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: "1.4rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  maxWidth: 540,
                  zIndex: 2,
                }}
              >
                {[
                  {
                    p: "JUPITER",
                    d: "Best-route swaps",
                    icon: "swap_horiz",
                    apy: null,
                  },
                  {
                    p: "KAMINO",
                    d: "Yield deposits",
                    icon: "trending_up",
                    apy: "5.8%",
                  },
                  { p: "JITO", d: "Liquid staking", icon: "bolt", apy: "8.2%" },
                  {
                    p: "STREAMFLOW",
                    d: "Recurring payments",
                    icon: "stream",
                    apy: null,
                  },
                ].map(({ p, d, icon, apy }) => (
                  <div key={p} className="proto">
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        className="ms"
                        style={{
                          fontSize: 13,
                          color: "rgba(245,158,11,.6)",
                          fontVariationSettings:
                            "'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
                        }}
                      >
                        {icon}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Space Grotesk',sans-serif",
                          fontSize: ".44rem",
                          fontWeight: 700,
                          letterSpacing: ".19em",
                          textTransform: "uppercase",
                          color: "rgba(245,158,11,.65)",
                        }}
                      >
                        {p}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: ".53rem",
                        color: "rgba(255,255,255,.22)",
                        lineHeight: 1.4,
                        margin: 0,
                      }}
                    >
                      {d}
                    </p>
                    {apy && (
                      <span
                        style={{
                          fontFamily: "'Noto Serif',serif",
                          fontSize: ".64rem",
                          color: "rgba(245,158,11,.75)",
                          fontWeight: 700,
                        }}
                      >
                        {apy} APY
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div
                className="a4"
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: ".8rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                {[
                  { l: "PROTOCOLS", v: "4" },
                  { l: "NETWORK", v: "SOLANA" },
                  { l: "SPEED", v: "< 1s" },
                  { l: "TVL", v: "$4.2M" },
                ].map(({ l, v }) => (
                  <div key={l} className="stat-pill">
                    <span
                      style={{
                        fontFamily: "'Space Grotesk',sans-serif",
                        fontSize: ".41rem",
                        letterSpacing: ".2em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,.18)",
                      }}
                    >
                      {l}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Noto Serif',serif",
                        fontSize: ".9rem",
                        fontWeight: 700,
                        color: "rgba(245,158,11,.82)",
                        textShadow: "0 0 11px rgba(245,158,11,.4)",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p
            className="a5"
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: ".41rem",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.1)",
              marginTop: ".8rem",
              zIndex: 2,
            }}
          >
            DOMINUS NEVER EXECUTES WITHOUT YOUR EXPLICIT CONFIRMATION
          </p>
        </div>

        {/* ══ STATUS BAR ════════════════════════════════════════════════════ */}
        <div
          className="sb-glass"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.6rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: ".82rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#F59E0B",
                  boxShadow:
                    "0 0 8px rgba(245,158,11,1),0 0 18px rgba(245,158,11,.4)",
                  display: "inline-block",
                  animation: "blink 2.9s ease-in-out infinite",
                }}
              />
              <span className="sb">CORE PRIME CONNECTED</span>
            </div>
            <div
              style={{
                width: 1,
                height: 11,
                background: "rgba(255,255,255,.08)",
              }}
            />
            <span className="sb">
              EPOCH:{" "}
              <strong
                style={{ color: "rgba(245,158,11,.65)", fontWeight: 700 }}
              >
                {epoch.toFixed(2)}.ALPHA
              </strong>
            </span>
            <div
              style={{
                width: 1,
                height: 11,
                background: "rgba(255,255,255,.08)",
              }}
            />
            <span className="sb">
              LATENCY:{" "}
              <strong style={{ color: "rgba(34,197,94,.5)", fontWeight: 700 }}>
                {latency}ms
              </strong>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: ".82rem" }}>
            <span className="sb" style={{ color: "rgba(255,255,255,.15)" }}>
              {network}
            </span>
            <div
              style={{
                width: 1,
                height: 11,
                background: "rgba(255,255,255,.08)",
              }}
            />
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {[24, 10, 17].map((w, i) => (
                <div
                  key={i}
                  style={{
                    width: w,
                    height: 2,
                    borderRadius: 1,
                    background:
                      i !== 1 ? "rgba(245,158,11,.6)" : "rgba(245,158,11,.14)",
                    boxShadow: i !== 1 ? "0 0 4px rgba(245,158,11,.4)" : "none",
                  }}
                />
              ))}
            </div>
            <span className="sb">V2.4.9-SECURE</span>
          </div>
        </div>
      </div>
    </>
  );
}

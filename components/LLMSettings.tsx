"use client"

import { useState, useEffect } from "react"

export type LLMMode = "ollama" | "api"

export interface LLMSettingsConfig {
  mode: LLMMode
  ollamaBaseUrl: string
  ollamaModel: string
  provider: "anthropic" | "openai"
  apiKey: string
  model: string
}

const DEFAULTS: LLMSettingsConfig = {
  mode: "ollama",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3.1:8b",
  provider: "anthropic",
  apiKey: "",
  model: "",
}

const STORAGE_KEY = "dominus_llm_config"

export function loadLLMConfig(): LLMSettingsConfig {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { return DEFAULTS }
}

function saveLLMConfig(config: LLMSettingsConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514",  label: "Claude Sonnet 4 (Recommended)" },
  { value: "claude-opus-4-5",           label: "Claude Opus 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fast)" },
]

const OPENAI_MODELS = [
  { value: "gpt-4o",       label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini",  label: "GPT-4o Mini (Fast)" },
  { value: "gpt-4-turbo",  label: "GPT-4 Turbo" },
]

interface LLMSettingsProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: LLMSettingsConfig) => void
}

export default function LLMSettings({ isOpen, onClose, onSave }: LLMSettingsProps) {
  const [config,     setConfig]     = useState<LLMSettingsConfig>(DEFAULTS)
  const [showKey,    setShowKey]    = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [testStatus, setTestStatus] = useState<"idle"|"testing"|"ok"|"fail">("idle")

  useEffect(() => {
    if (isOpen) { setConfig(loadLLMConfig()); setSaved(false); setTestStatus("idle") }
  }, [isOpen])

  function set<K extends keyof LLMSettingsConfig>(key: K, value: LLMSettingsConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false); setTestStatus("idle")
  }

  function handleSave() {
    saveLLMConfig(config); onSave(config); setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  async function handleTest() {
    setTestStatus("testing")
    try {
      if (config.mode === "ollama") {
        const res = await fetch(`${config.ollamaBaseUrl}/api/tags`)
        setTestStatus(res.ok ? "ok" : "fail")
      } else {
        const isAnthropicKey = config.provider === "anthropic" && config.apiKey.startsWith("sk-ant-")
        const isOpenAIKey    = config.provider === "openai"    && config.apiKey.startsWith("sk-")
        setTestStatus(isAnthropicKey || isOpenAIKey ? "ok" : "fail")
      }
    } catch { setTestStatus("fail") }
    setTimeout(() => setTestStatus("idle"), 3000)
  }

  const modelOptions = config.provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @keyframes panel-in { from{transform:translateX(100%);opacity:0} to{transform:none;opacity:1} }
        .settings-panel { animation: panel-in .28s cubic-bezier(.22,1,.36,1) both; }
        .tab-btn { transition: all .15s; }
        .tab-btn:hover { background: rgba(255,255,255,.04) !important; }
        .inp { transition: border-color .15s, box-shadow .15s; }
        .inp:focus { border-color: rgba(245,158,11,.35) !important; box-shadow: 0 0 0 3px rgba(245,158,11,.07) !important; outline: none; }
      `}</style>

      {/* Backdrop */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)",
        backdropFilter:"blur(4px)", zIndex:40 }} />

      {/* Panel */}
      <div className="settings-panel" style={{
        position:"fixed", top:0, right:0, height:"100%", width:400, zIndex:50,
        background:"#0C0C0F", borderLeft:"1px solid rgba(255,255,255,.07)",
        display:"flex", flexDirection:"column",
        boxShadow:"-20px 0 60px rgba(0,0,0,.6)",
      }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"18px 20px", borderBottom:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
          <div>
            <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
              letterSpacing:".28em", textTransform:"uppercase", color:"#3F3F46", marginBottom:4 }}>SYSTEM CONFIG</p>
            <h2 style={{ fontFamily:"'Noto Serif',serif", fontWeight:400, fontSize:"1.3rem",
              color:"#F2F0EC", letterSpacing:"-.01em", margin:0 }}>LLM Settings</h2>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:6, display:"flex",
            alignItems:"center", justifyContent:"center", background:"none",
            border:"1px solid rgba(255,255,255,.07)", cursor:"pointer", color:"#6B6A72",
            transition:"all .15s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color="#F2F0EC";(e.currentTarget as HTMLButtonElement).style.borderColor="rgba(255,255,255,.14)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color="#6B6A72";(e.currentTarget as HTMLButtonElement).style.borderColor="rgba(255,255,255,.07)"}}>
            <span style={{ fontFamily:"'Material Symbols Outlined'",
              fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 24",
              fontSize:16, lineHeight:1 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:20 }}>

          {/* Mode toggle */}
          <div>
            <p style={fieldLabel}>LLM SOURCE</p>
            <div style={{ display:"flex", gap:6, padding:4, background:"#111116",
              border:"1px solid rgba(255,255,255,.06)", borderRadius:7 }}>
              {(["ollama","api"] as const).map(mode => (
                <button key={mode} className="tab-btn"
                  onClick={() => set("mode", mode)}
                  style={{ flex:1, padding:"9px 0", borderRadius:5, border:"none", cursor:"pointer",
                    fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:600,
                    letterSpacing:".14em", textTransform:"uppercase", transition:"all .15s",
                    background: config.mode === mode ? "rgba(245,158,11,.1)" : "transparent",
                    color: config.mode === mode ? "#F59E0B" : "#6B6A72",
                    boxShadow: config.mode === mode ? "inset 0 0 0 1px rgba(245,158,11,.2)" : "none",
                  }}>
                  {mode === "ollama" ? "Local (Ollama)" : "API Key"}
                </button>
              ))}
            </div>
            <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", color:"#3F3F46",
              lineHeight:1.6, marginTop:8 }}>
              {config.mode === "ollama"
                ? "Free, private, no rate limits. Requires Ollama running locally."
                : "Use a hosted provider. Requires your own API key."}
            </p>
          </div>

          {/* Ollama fields */}
          {config.mode === "ollama" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <Field label="BASE URL">
                <input className="inp" type="text" value={config.ollamaBaseUrl}
                  onChange={e => set("ollamaBaseUrl", e.target.value)}
                  placeholder="http://localhost:11434"
                  style={inputStyle} />
              </Field>
              <Field label="MODEL">
                <input className="inp" type="text" value={config.ollamaModel}
                  onChange={e => set("ollamaModel", e.target.value)}
                  placeholder="llama3.1:8b"
                  style={inputStyle} />
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:500,
                  letterSpacing:".14em", color:"#3F3F46", marginTop:5 }}>
                  RECOMMENDED: llama3.1:8b
                </p>
              </Field>
              <div style={{ background:"#111116", border:"1px solid rgba(255,255,255,.06)",
                borderRadius:7, padding:"12px 14px" }}>
                <p style={{ ...fieldLabel, marginBottom:8 }}>QUICK START</p>
                {["ollama serve", "ollama pull llama3.1:8b"].map(cmd => (
                  <div key={cmd} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                    background:"rgba(0,0,0,.3)", borderRadius:5, marginBottom:5 }}>
                    <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".5rem",
                      color:"rgba(245,158,11,.3)" }}>$</span>
                    <code style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem",
                      color:"#6B6A72", letterSpacing:".04em" }}>{cmd}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API key fields */}
          {config.mode === "api" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <Field label="PROVIDER">
                <div style={{ display:"flex", gap:6 }}>
                  {(["anthropic","openai"] as const).map(p => (
                    <button key={p}
                      onClick={() => { set("provider", p); set("model", "") }}
                      style={{ flex:1, padding:"9px 0", borderRadius:6, cursor:"pointer",
                        fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:600,
                        letterSpacing:".12em", textTransform:"uppercase", transition:"all .15s",
                        background: config.provider === p ? "rgba(245,158,11,.08)" : "rgba(255,255,255,.03)",
                        border: config.provider === p ? "1px solid rgba(245,158,11,.22)" : "1px solid rgba(255,255,255,.07)",
                        color: config.provider === p ? "#F59E0B" : "#6B6A72",
                      }}>
                      {p === "anthropic" ? "Anthropic" : "OpenAI"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="API KEY">
                <div style={{ position:"relative" }}>
                  <input className="inp" type={showKey ? "text" : "password"} value={config.apiKey}
                    onChange={e => set("apiKey", e.target.value)}
                    placeholder={config.provider === "anthropic" ? "sk-ant-api03-…" : "sk-proj-…"}
                    style={{ ...inputStyle, paddingRight:44 }} />
                  <button onClick={() => setShowKey(v => !v)}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                      background:"none", border:"none", cursor:"pointer", color:"#3F3F46",
                      display:"flex", alignItems:"center" }}>
                    <span style={{ fontFamily:"'Material Symbols Outlined'",
                      fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
                      fontSize:16, lineHeight:1 }}>{showKey ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:500,
                  letterSpacing:".14em", color:"#3F3F46", marginTop:5 }}>
                  STORED LOCALLY · NEVER SENT TO ANY SERVER EXCEPT THE PROVIDER
                </p>
              </Field>
              <Field label="MODEL">
                <select value={config.model} onChange={e => set("model", e.target.value)}
                  style={{ ...inputStyle, cursor:"pointer", appearance:"none" as const }}>
                  <option value="">Select a model…</option>
                  {modelOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Test connection */}
          <button onClick={handleTest} disabled={testStatus === "testing"}
            style={{ width:"100%", padding:"10px 0",
              background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)",
              borderRadius:7, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              fontFamily:"'Space Grotesk',sans-serif", fontSize:".6rem", fontWeight:600,
              letterSpacing:".18em", textTransform:"uppercase",
              color: testStatus === "ok" ? "#22C55E" : testStatus === "fail" ? "#F87171" : "#6B6A72",
              transition:"all .15s", opacity: testStatus === "testing" ? .6 : 1 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", display:"inline-block",
              background: testStatus === "ok" ? "#22C55E" : testStatus === "fail" ? "#F87171"
                : testStatus === "testing" ? "#60A5FA" : "#3F3F46",
              animation: testStatus === "testing" ? "blink 1.2s ease-in-out infinite" : "none" }} />
            {testStatus === "testing" ? "Testing…"
              : testStatus === "ok" ? "Connection OK"
              : testStatus === "fail" ? "Connection Failed"
              : "Test Connection"}
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,.06)", flexShrink:0 }}>
          <button onClick={handleSave}
            style={{ width:"100%", padding:"12px 0",
              background: saved ? "rgba(34,197,94,.12)" : "linear-gradient(135deg,#FCD34D 0%,#F59E0B 55%,#D97706 100%)",
              border: saved ? "1px solid rgba(34,197,94,.25)" : "none",
              borderRadius:8, cursor:"pointer",
              fontFamily:"'Space Grotesk',sans-serif", fontSize:".66rem", fontWeight:700,
              letterSpacing:".2em", textTransform:"uppercase",
              color: saved ? "#22C55E" : "#1C0A00",
              boxShadow: saved ? "none" : "0 0 18px rgba(245,158,11,.25)",
              transition:"all .2s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontFamily:"'Material Symbols Outlined'",
              fontVariationSettings:"'FILL' 0,'wght' 300,'GRAD' 0,'opsz' 20",
              fontSize:16, lineHeight:1 }}>{saved ? "check" : "save"}</span>
            {saved ? "SAVED" : "SAVE CONFIG"}
          </button>
          <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:".46rem", fontWeight:500,
            letterSpacing:".14em", textTransform:"uppercase", color:"#3F3F46",
            textAlign:"center", marginTop:10 }}>
            Config applies to next message sent
          </p>
        </div>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <p style={fieldLabel}>{label}</p>
      {children}
    </div>
  )
}

const fieldLabel: React.CSSProperties = {
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".44rem", fontWeight:600,
  letterSpacing:".26em", textTransform:"uppercase", color:"#3F3F46", margin:0,
}

const inputStyle: React.CSSProperties = {
  width:"100%", padding:"10px 14px",
  background:"#18181D", border:"1px solid rgba(255,255,255,.08)", borderRadius:7,
  fontFamily:"'Space Grotesk',sans-serif", fontSize:".75rem", color:"#F2F0EC",
  outline:"none",
}
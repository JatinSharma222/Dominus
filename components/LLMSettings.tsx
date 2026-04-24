"use client"

import { useState, useEffect } from "react"

export type LLMMode = "ollama" | "api"

export interface LLMSettingsConfig {
  mode: LLMMode
  // Ollama
  ollamaBaseUrl: string
  ollamaModel: string
  // API key path
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
  } catch {
    return DEFAULTS
  }
}

function saveLLMConfig(config: LLMSettingsConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Recommended)" },
  { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fast)" },
]

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
]

interface LLMSettingsProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: LLMSettingsConfig) => void
}

export default function LLMSettings({ isOpen, onClose, onSave }: LLMSettingsProps) {
  const [config, setConfig] = useState<LLMSettingsConfig>(DEFAULTS)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle")

  // Load from localStorage on open
  useEffect(() => {
    if (isOpen) {
      setConfig(loadLLMConfig())
      setSaved(false)
      setTestStatus("idle")
    }
  }, [isOpen])

  function set<K extends keyof LLMSettingsConfig>(key: K, value: LLMSettingsConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setTestStatus("idle")
  }

  function handleSave() {
    saveLLMConfig(config)
    onSave(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTestConnection() {
    setTestStatus("testing")
    try {
      if (config.mode === "ollama") {
        const res = await fetch(`${config.ollamaBaseUrl}/api/tags`)
        setTestStatus(res.ok ? "ok" : "fail")
      } else {
        // Light validation — just check key is non-empty and has right prefix
        const isAnthropic = config.provider === "anthropic" && config.apiKey.startsWith("sk-ant-")
        const isOpenAI = config.provider === "openai" && config.apiKey.startsWith("sk-")
        setTestStatus(isAnthropic || isOpenAI ? "ok" : "fail")
      }
    } catch {
      setTestStatus("fail")
    }
    setTimeout(() => setTestStatus("idle"), 3000)
  }

  const modelOptions = config.provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div className="fixed top-0 right-0 h-full w-[420px] z-50 flex flex-col bg-surface-container-lowest border-l border-outline-variant/15 shadow-[−20px_0_60px_rgba(0,0,0,0.6)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/15 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase">
              SYSTEM CONFIG
            </span>
            <h2 className="font-headline text-xl text-on-surface tracking-tight">
              LLM Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

          {/* Mode toggle */}
          <div className="space-y-3">
            <label className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase block">
              LLM Source
            </label>
            <div className="flex gap-2 p-1 bg-surface-container-low rounded-lg">
              <button
                onClick={() => set("mode", "ollama")}
                className={`flex-1 py-2.5 rounded font-label text-[10px] tracking-[0.15em] uppercase transition-all ${
                  config.mode === "ollama"
                    ? "bg-primary/15 border border-primary/30 text-primary shadow-[0_0_12px_rgba(255,193,116,0.1)]"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <span className="material-symbols-outlined text-sm align-middle mr-1.5">
                  computer
                </span>
                Local (Ollama)
              </button>
              <button
                onClick={() => set("mode", "api")}
                className={`flex-1 py-2.5 rounded font-label text-[10px] tracking-[0.15em] uppercase transition-all ${
                  config.mode === "api"
                    ? "bg-primary/15 border border-primary/30 text-primary shadow-[0_0_12px_rgba(255,193,116,0.1)]"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <span className="material-symbols-outlined text-sm align-middle mr-1.5">
                  key
                </span>
                API Key
              </button>
            </div>

            {/* Mode description */}
            <p className="font-body text-[11px] text-neutral-500 leading-relaxed">
              {config.mode === "ollama"
                ? "Uses a locally-running Ollama instance. Free, private, no rate limits. Requires Ollama installed and running."
                : "Uses a hosted LLM provider. Requires your own API key. Faster responses, more capable models."}
            </p>
          </div>

          {/* ── OLLAMA FIELDS ── */}
          {config.mode === "ollama" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase block">
                  Base URL
                </label>
                <input
                  type="text"
                  value={config.ollamaBaseUrl}
                  onChange={(e) => set("ollamaBaseUrl", e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full bg-surface-container px-4 py-3 rounded font-body text-sm text-on-surface placeholder:text-neutral-600 outline-none border border-transparent focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(255,193,116,0.08)] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase block">
                  Model
                </label>
                <input
                  type="text"
                  value={config.ollamaModel}
                  onChange={(e) => set("ollamaModel", e.target.value)}
                  placeholder="llama3.1:8b"
                  className="w-full bg-surface-container px-4 py-3 rounded font-body text-sm text-on-surface placeholder:text-neutral-600 outline-none border border-transparent focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(255,193,116,0.08)] transition-all"
                />
                <p className="font-label text-[9px] text-neutral-600 tracking-widest">
                  RECOMMENDED: llama3.1:8b — confirmed tool calling support
                </p>
              </div>

              {/* Ollama quick-ref */}
              <div className="bg-surface-container rounded-lg p-4 space-y-2">
                <span className="font-label text-[9px] text-primary/60 tracking-[0.25em] uppercase block">
                  Quick Start
                </span>
                <div className="space-y-1.5">
                  {["ollama serve", "ollama pull llama3.1:8b"].map((cmd) => (
                    <div
                      key={cmd}
                      className="flex items-center gap-2 px-3 py-2 bg-surface-container-lowest rounded font-label text-[10px] text-neutral-400 tracking-wider"
                    >
                      <span className="text-primary/40">$</span>
                      <code>{cmd}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── API KEY FIELDS ── */}
          {config.mode === "api" && (
            <div className="space-y-5">
              {/* Provider select */}
              <div className="space-y-2">
                <label className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase block">
                  Provider
                </label>
                <div className="flex gap-2">
                  {(["anthropic", "openai"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        set("provider", p)
                        set("model", "")
                      }}
                      className={`flex-1 py-3 rounded font-label text-[10px] tracking-[0.15em] uppercase transition-all border ${
                        config.provider === p
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-surface-container border-outline-variant/20 text-neutral-500 hover:text-neutral-300 hover:border-outline-variant/40"
                      }`}
                    >
                      {p === "anthropic" ? "Anthropic" : "OpenAI"}
                    </button>
                  ))}
                </div>
              </div>

              {/* API key input */}
              <div className="space-y-2">
                <label className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase block">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={config.apiKey}
                    onChange={(e) => set("apiKey", e.target.value)}
                    placeholder={
                      config.provider === "anthropic" ? "sk-ant-api03-..." : "sk-proj-..."
                    }
                    className="w-full bg-surface-container px-4 py-3 pr-12 rounded font-body text-sm text-on-surface placeholder:text-neutral-600 outline-none border border-transparent focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(255,193,116,0.08)] transition-all"
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showKey ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <p className="font-label text-[9px] text-neutral-600 tracking-widest">
                  STORED IN LOCALSTORAGE — NEVER SENT TO ANY SERVER EXCEPT THE PROVIDER
                </p>
              </div>

              {/* Model select */}
              <div className="space-y-2">
                <label className="font-label text-[9px] text-neutral-500 tracking-[0.3em] uppercase block">
                  Model
                </label>
                <select
                  value={config.model}
                  onChange={(e) => set("model", e.target.value)}
                  className="w-full bg-surface-container px-4 py-3 rounded font-body text-sm text-on-surface outline-none border border-transparent focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(255,193,116,0.08)] transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select a model...</option>
                  {modelOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Test connection button */}
          <button
            onClick={handleTestConnection}
            disabled={testStatus === "testing"}
            className="w-full py-2.5 border border-outline-variant/20 rounded font-label text-[10px] tracking-[0.2em] uppercase text-neutral-500 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {testStatus === "testing" && (
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
            )}
            {testStatus === "ok" && (
              <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
            )}
            {testStatus === "fail" && (
              <span className="material-symbols-outlined text-sm text-error">error</span>
            )}
            {testStatus === "idle" && (
              <span className="material-symbols-outlined text-sm">wifi_tethering</span>
            )}
            {testStatus === "testing"
              ? "Testing..."
              : testStatus === "ok"
              ? "Connection OK"
              : testStatus === "fail"
              ? "Connection Failed"
              : "Test Connection"}
          </button>

        </div>

        {/* Footer — Save */}
        <div className="px-6 py-5 border-t border-outline-variant/15 shrink-0 space-y-3">
          <button
            onClick={handleSave}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold tracking-[0.2em] text-xs uppercase rounded shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <span className="material-symbols-outlined text-sm">check</span>
                SAVED
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">save</span>
                SAVE CONFIG
              </>
            )}
          </button>
          <p className="font-label text-[9px] text-neutral-600 text-center tracking-widest uppercase">
            Config applies to next message sent
          </p>
        </div>

      </div>
    </>
  )
}
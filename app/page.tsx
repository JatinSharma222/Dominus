"use client";

import { useChat } from "ai/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState, useRef, useEffect } from "react";
import ChatWindow from "@/components/ChatWindow";
import LLMSettings, {
  LLMSettingsConfig,
  loadLLMConfig,
} from "@/components/LLMSettings";
import { shortenAddress } from "@/lib/solana";

export default function Home() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmConfig, setLLMConfig] = useState<LLMSettingsConfig | null>(null);

  // Load LLM config from localStorage on mount (client-only)
  useEffect(() => {
    setLLMConfig(loadLLMConfig());
  }, []);

  // Build the extra body fields sent with every chat request.
  // The chat route reads these to override the server-side env defaults.
  const chatBody = {
    walletAddress: publicKey?.toString(),
    ...(llmConfig && {
      llmOverride:
        llmConfig.mode === "ollama"
          ? {
              provider: "ollama" as const,
              baseUrl: llmConfig.ollamaBaseUrl,
              model: llmConfig.ollamaModel,
            }
          : {
              provider: llmConfig.provider,
              apiKey: llmConfig.apiKey,
              model: llmConfig.model || undefined,
            },
    }),
  };

  const { messages, append, isLoading, setMessages } = useChat({
    api: "/api/chat",
    body: chatBody,
  });

  // Build typed messages — parse toolInvocations from SDK (Anthropic/OpenAI path)
  // or from message.annotations (Ollama path — tool results sent via 8: stream)
  const typedMessages = messages.map((m) => {
    let content = "";
    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = (m.content as { type: string; text?: string }[])
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("");
    }

    let toolInvocations:
      | {
          toolName: string;
          state: "call" | "result" | "partial-call";
          result?: unknown;
        }[]
      | undefined = m.toolInvocations as typeof toolInvocations;

    if (!toolInvocations?.length && m.annotations?.length) {
      const annotationTools = (m.annotations as unknown[]).filter(
        (a): a is { toolName: string; result: unknown } =>
          typeof a === "object" && a !== null && "toolName" in a,
      );
      if (annotationTools.length) {
        toolInvocations = annotationTools.map((a) => ({
          toolName: a.toolName,
          state: "result" as const,
          result: a.result,
        }));
      }
    }

    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      content,
      toolInvocations,
    };
  });

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Inject two client-side messages without hitting the API
  function showWalletWarning(userText: string) {
    const id1 = `local-${Date.now()}-u`;
    const id2 = `local-${Date.now()}-a`;
    setMessages([
      ...messages,
      { id: id1, role: "user", content: userText },
      {
        id: id2,
        role: "assistant",
        content:
          "Please connect your wallet first — click the CONNECT WALLET button in the top right to get started.",
      },
    ]);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    if (!connected || !publicKey) {
      showWalletWarning(trimmed);
      return;
    }
    await append({ role: "user", content: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSuggestion(prompt: string) {
    if (isLoading) return;
    if (!connected || !publicKey) {
      showWalletWarning(prompt);
      return;
    }
    await append({ role: "user", content: prompt });
  }

  function handleSettingsSave(config: LLMSettingsConfig) {
    setLLMConfig(config);
    setIsSettingsOpen(false);
  }

  // Derive display label for the active LLM in the status bar
  const llmLabel =
    llmConfig?.mode === "api"
      ? llmConfig.provider === "anthropic"
        ? `ANTHROPIC — ${llmConfig.model || "DEFAULT"}`
        : `OPENAI — ${llmConfig.model || "DEFAULT"}`
      : `OLLAMA — ${llmConfig?.ollamaModel ?? "llama3.1:8b"}`;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Top Nav ── */}
      <nav className="h-16 flex items-center justify-between px-8 bg-neutral-950/40 backdrop-blur-xl border-b border-white/10 shrink-0">
        <span className="font-headline text-2xl font-bold tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
          DOMINUS
        </span>

        <div className="flex items-center gap-3">
          {/* Settings icon */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="LLM Settings"
            className={`w-9 h-9 flex items-center justify-center rounded transition-all ${
              isSettingsOpen
                ? "bg-primary/15 text-primary"
                : "text-neutral-400 hover:text-primary hover:bg-primary/10"
            }`}
          >
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>

          {/* Wallet button */}
          {connected && publicKey ? (
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg font-label text-[10px] text-primary tracking-widest uppercase hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm mr-2 align-middle">
                account_balance_wallet
              </span>
              {shortenAddress(publicKey.toString())}
            </button>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label font-bold tracking-[0.2em] text-xs uppercase rounded shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              CONNECT WALLET
            </button>
          )}
        </div>
      </nav>

      {/* ── Chat Area ── */}
      <ChatWindow messages={typedMessages} isLoading={isLoading} />

      {/* ── Suggestion Chips (show only when no messages) ── */}
      {messages.length === 0 && (
        <div className="flex gap-2 px-6 pb-3 flex-wrap justify-center shrink-0">
          {[
            "Swap SOL → USDC",
            "Check Portfolio",
            "Stake SOL",
            "Best Yield Now",
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => handleSuggestion(chip)}
              className="px-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-full font-label text-xs text-neutral-400 hover:text-primary hover:border-primary/30 hover:bg-surface-container-high tracking-widest uppercase transition-all"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="px-6 pb-6 pt-2 shrink-0">
        <div
          className={`relative flex items-end gap-3 rounded-lg px-4 py-3 transition-all ${
            connected
              ? "bg-surface-container-lowest focus-within:shadow-[0_0_0_1px_rgba(255,193,116,0.3)]"
              : "bg-surface-container-lowest opacity-60"
          }`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              connected
                ? "Describe what you want to do with your crypto..."
                : "Connect your wallet to get started..."
            }
            rows={1}
            className="flex-1 bg-transparent font-body text-sm text-on-surface placeholder:text-neutral-600 resize-none outline-none leading-relaxed max-h-40 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-r from-primary to-primary-container rounded text-on-primary disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
        <p className="text-center font-label text-[9px] text-neutral-600 tracking-widest uppercase mt-2">
          {connected
            ? "DOMINUS NEVER EXECUTES WITHOUT YOUR CONFIRMATION"
            : "CONNECT WALLET TO BEGIN"}
        </p>
      </div>

      {/* ── Bottom Status Bar ── */}
      <div className="h-10 flex items-center justify-between px-8 bg-neutral-950/80 backdrop-blur-md border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-primary animate-pulse" : "bg-neutral-600"
            }`}
          />
          <span className="font-label text-[9px] text-neutral-400 tracking-[0.2em] uppercase">
            {connected ? "Wallet Connected" : "Wallet Not Connected"}
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="font-label text-[9px] text-neutral-600 tracking-[0.15em] uppercase">
            {llmLabel}
          </span>
        </div>
        <span className="font-label text-[9px] text-neutral-600 tracking-[0.2em] uppercase">
          v1.0.0 —{" "}
          {process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
            ? "MAINNET"
            : "DEVNET"}
        </span>
      </div>

      {/* ── LLM Settings Panel ── */}
      <LLMSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSettingsSave}
      />
    </div>
  );
}

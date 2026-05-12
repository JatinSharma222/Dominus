<div align="center">

<!-- ① PUT YOUR DEMO VIDEO HERE — drag the .mp4 into this GitHub issue box to get a URL, then paste it below -->
<!-- <video src="YOUR_VIDEO_URL" autoplay loop muted playsinline width="100%"></video> -->

# DOMINUS

### *Natural language DeFi execution on Solana*

**"Four DeFi operations. Four different protocols. One conversation. I never typed an address, a fee, or a protocol name."**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-dominus--phi.vercel.app-F59E0B?style=for-the-badge)](https://dominus-phi.vercel.app)
[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF?style=for-the-badge)](https://solana.com)
[![Colosseum Frontier 2026](https://img.shields.io/badge/Colosseum-Frontier%202026-white?style=for-the-badge)](https://colosseum.com/frontier)

</div>

---

## The Problem

DeFi on Solana works brilliantly — for people who already understand it. But most people don't know what Jupiter is. They don't know the difference between Kamino and Jito. They have crypto sitting idle, earning nothing, because the tools built to help them require a PhD to operate.

## The Solution

Dominus is a chat interface where you describe what you want to do with your crypto in plain English, and an AI agent executes it across Solana's best protocols — no DeFi knowledge required.

```
You:     "swap 0.1 SOL to USDC then stream it weekly to 6cFQMb...saA"
Dominus: [Jupiter quote card loads with live route + price impact]
         [Streamflow payment card loads with schedule + total]
         "Your swap and weekly payment stream are ready to confirm."
```

The AI never signs anything. It builds the transaction, shows you exactly what's about to happen, and waits for your approval.

---

## Screenshots

<!-- ② LANDING PAGE — put screenshot-landing.png here -->
<img width="1710" height="953" alt="screenshot-landing" src="https://github.com/user-attachments/assets/7b854bfd-b61d-4f13-9732-a11d4712fb60" />


<!-- ③ PORTFOLIO + PROACTIVE SUGGESTION — put screenshot-portfolio.png here -->
<img width="1710" height="953" alt="screenshot-portfolio" src="https://github.com/user-attachments/assets/d756db6c-e54d-4922-9a47-633daa8b9cce" />


<table>
  <tr>
    <!-- ④ JUPITER CARD — put screenshot-jupiter.png here -->
    <td><img width="1710" height="953" alt="screenshot-jupiter" src="https://github.com/user-attachments/assets/4dc84b0e-79d8-4af2-b5ad-d4f583ed1080" /> </td>
    <!-- ⑤ JITO CARD — put screenshot-jito.png here -->
    <td><img width="1710" height="949" alt="Screenshot 2026-05-11 at 6 37 20 PM" src="https://github.com/user-attachments/assets/999398e9-eddf-43bf-a70a-a2c7c8eceed0" /> </td>
  </tr>
</table>

<!-- ⑥ MULTI-STEP — put screenshot-multistep.png here -->
<img width="1710" height="949" alt="Screenshot 2026-05-11 at 6 38 34 PM" src="https://github.com/user-attachments/assets/3097c9ec-dce3-4fcb-8193-36782e7b9067" />


---

## What It Can Do

| Command | Protocol | What happens |
|---|---|---|
| `"swap 1 SOL to USDC"` | **Jupiter** | Best-route quote with price impact, live output amount |
| `"stake my SOL with Jito"` | **Jito** | Live APY fetched, projected daily/monthly/yearly earnings |
| `"deposit my USDC to earn yield"` | **Kamino** | Live APY from Kamino's main market, projected returns |
| `"stream $20 USDC weekly to [address]"` | **Streamflow** | Recurring payment schedule, cancel-anytime |
| `"what's my portfolio worth?"` | **Helius + CoinGecko** | Live balances with USD values, proactive yield suggestion |
| `"swap SOL to USDC then stream it weekly"` | **Jupiter + Streamflow** | Two protocols, one sentence, two transaction cards |

---

## Architecture

```
User message (plain English)
        ↓
Next.js API route → Groq (llama-3.3-70b) with tool definitions
        ↓
AI calls tools: get_portfolio / swap_tokens / stake_sol / deposit_for_yield / create_payment_stream
        ↓
Tools return intent objects (never transactions, never signatures)
        ↓
Frontend renders interactive cards with live data:
  • Jupiter: fetches real-time quote via /api/jupiter/quote proxy
  • Jito: fetches live APY via /api/jito/apy proxy
  • Kamino: fetches live APY via /api/kamino/apy proxy
  • Streamflow: SDK called directly from browser
        ↓
User clicks Confirm → wallet (Phantom) signs → broadcasts to mainnet
```

**Security model:** The AI layer never holds private keys. It never signs transactions. It only builds transaction instructions and returns them to the frontend. The user's wallet signs. This is non-negotiable and enforced at the architecture level.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| AI / LLM | Groq (llama-3.3-70b-versatile) via Vercel AI SDK v4 |
| Local dev | Ollama (llama3.1:8b) — no API key needed |
| Solana RPC | Helius (mainnet-beta) |
| Token prices | CoinGecko (free tier, no key) |
| Swap routing | Jupiter lite-api.jup.ag/swap/v1 |
| Liquid staking | @solana/spl-stake-pool + Jito stake pool |
| Yield | Kamino Finance REST API |
| Payments | @streamflow/stream SDK |
| Wallet | @solana/wallet-adapter (Phantom, Solflare, Coinbase, Ledger) |
| Deployment | Vercel |

---

## Running Locally

### Prerequisites
- Node.js 18+
- [Ollama](https://ollama.ai) installed and running
- Phantom wallet browser extension

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/dominus.git
cd dominus

# Install
npm install

# Pull the LLM
ollama pull llama3.1:8b

# Configure environment
cp .env.example .env.local
# Fill in your Helius API key
```

### Environment variables

```bash
# .env.local
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

HELIUS_API_KEY=your-key-here
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key-here
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key-here
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_KAMINO_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key-here
```

```bash
# Start Ollama
ollama serve

# Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect Phantom, start talking.

### Using a hosted LLM

The LLM Settings panel (⚙️ icon) lets you switch to Claude or OpenAI by entering your own API key — no code changes needed.

---

## How the AI Tool Loop Works

Dominus uses a model-agnostic LLM abstraction layer. Locally it runs Ollama. In production it uses Groq. The same tool definitions work across all providers.

When you send a message:
1. The model receives your message + 5 tool definitions (Zod schemas)
2. It decides which tools to call based on intent
3. Tools execute server-side and return **intent objects** — never transactions
4. The model generates a plain-English summary
5. The frontend renders interactive cards from the intent objects
6. User confirms → wallet signs → transaction broadcasts

Multi-step flows ("swap then stream") run through up to 2 tool rounds in a single response, chaining outputs automatically.

---

## Why This Wins

Superteam.fun listed "Cursor/Perplexity for Solana" as a top unfilled idea in 2025. SendAI (builders of solana-agent-kit) explicitly called this out as what they want built. Latinum winning Breakout 2025 proved MCP + payments is exactly what judges reward.

Dominus closes the gap between knowing crypto exists and actually using it productively. Not with a tutorial. Not with a simplified UI. With a conversation.

---

## Roadmap

- [ ] Transaction history view
- [ ] Voice input
- [ ] Multi-wallet portfolio aggregation
- [ ] Custom yield strategy builder ("maximize my APY across all protocols")
- [ ] Mobile app

---

## Business Model

- **0.05% transaction fee** on every swap executed through Dominus
- **Yield referral fees** from Kamino and Jito for TVL directed to them  
- **Pro tier ($10/month):** unlimited history, analytics, priority support, voice input

---

## Built For

[Colosseum Frontier Online Hackathon 2026](https://colosseum.com/frontier) — AI + Payments tracks

*Built solo in 5 weeks using Claude Code, Cursor, and Ollama.*

---

<div align="center">
  <a href="https://dominus-phi.vercel.app">Try it live →</a>
</div>

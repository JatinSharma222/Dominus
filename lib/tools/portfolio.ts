import { z } from "zod";
import { connection, isValidPublicKey } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOL_MINT = "So11111111111111111111111111111111111111112";

// Known token symbols — avoids needing a separate token list fetch for common tokens
const KNOWN_SYMBOLS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "jitoSOL",
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: "bSOL",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "ETH",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "wBTC",
  So11111111111111111111111111111111111111112: "SOL",
};

// ─── Tool definition ──────────────────────────────────────────────────────────

export const portfolioTool = {
  description:
    "Read the user's Solana wallet balances, token holdings, and current positions. Use this when the user asks about their portfolio, balance, holdings, what they own, or how much SOL/tokens they have.",
  parameters: z.object({
    walletAddress: z.string().describe("The user's Solana wallet public key"),
  }),
};

// ─── Known CoinGecko IDs for Solana tokens ────────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  "So11111111111111111111111111111111111111112":    "solana",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "usd-coin",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "tether",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "bonk",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  "jupiter-exchange-solana",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So":  "msol",
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "jito-staked-sol",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1":  "blazestake-staked-sol",
}

async function fetchUsdPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {}

  const mintToId: Record<string, string> = {}
  for (const mint of mints) {
    if (COINGECKO_IDS[mint]) mintToId[mint] = COINGECKO_IDS[mint]
  }

  const ids = Object.values(mintToId)
  if (ids.length === 0) return {}

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return {}

    const json = await res.json() as Record<string, { usd: number }>

    const prices: Record<string, number> = {}
    for (const [mint, cgId] of Object.entries(mintToId)) {
      if (json[cgId]?.usd) prices[mint] = json[cgId].usd
    }
    return prices
  } catch {
    return {}
  }
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export async function executePortfolioRead({
  walletAddress,
}: {
  walletAddress: string;
}) {
  if (!isValidPublicKey(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  const pubkey = new PublicKey(walletAddress);
  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  );

  // ── Fetch balances ──────────────────────────────────────────────────────────
  const [lamports, tokenAccounts] = await Promise.all([
    connection.getBalance(pubkey),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    }),
  ]);

  const solBalance = lamports / 1e9;

  const tokens = tokenAccounts.value
    .map((account) => {
      const info = account.account.data.parsed?.info;
      if (!info) return null;
      const amount = (info.tokenAmount?.uiAmount as number) ?? 0;
      if (amount === 0) return null;
      return {
        mint: info.mint as string,
        amount,
        decimals: (info.tokenAmount?.decimals as number) ?? 0,
        symbol:
          KNOWN_SYMBOLS[info.mint as string] ??
          shortenMint(info.mint as string),
      };
    })
    .filter(Boolean) as {
    mint: string;
    amount: number;
    decimals: number;
    symbol: string;
  }[];

  // ── Fetch USD prices ────────────────────────────────────────────────────────
  // Include SOL + all token mints in a single batch request
  const mintsToPrice = [SOL_MINT, ...tokens.map((t) => t.mint)];
  const prices = await fetchUsdPrices(mintsToPrice);

  const solPrice = prices[SOL_MINT] ?? 0;
  const solUsdValue = solBalance * solPrice;

  // Attach USD value to each token
  const tokensWithPrices = tokens.map((t) => {
    const tokenPrice = prices[t.mint] ?? 0;
    const tokenUsdValue = t.amount * tokenPrice;
    return {
      ...t,
      usdPrice: tokenPrice,
      usdValue: tokenUsdValue,
      // Formatted strings for the AI to read naturally
      usdValueFormatted:
        tokenPrice > 0
          ? `$${tokenUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null,
    };
  });

  // ── Total portfolio value ───────────────────────────────────────────────────
  const totalUsdValue =
    solUsdValue + tokensWithPrices.reduce((sum, t) => sum + t.usdValue, 0);
  const hasPrices =
    solPrice > 0 || tokensWithPrices.some((t) => t.usdPrice > 0);

  // ── Build summary for the LLM ───────────────────────────────────────────────
  // Written so the AI can read it naturally and quote numbers accurately
  const tokenSummaryLines = tokensWithPrices.map((t) =>
    t.usdValueFormatted
      ? `  • ${t.amount.toLocaleString()} ${t.symbol} ≈ ${t.usdValueFormatted}`
      : `  • ${t.amount.toLocaleString()} ${t.symbol}`,
  );

  const solLine =
    solPrice > 0
      ? `${solBalance.toFixed(4)} SOL ≈ $${solUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (@ $${solPrice.toFixed(2)}/SOL)`
      : `${solBalance.toFixed(4)} SOL`;

  const totalLine = hasPrices
    ? `Total portfolio value: $${totalUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";

  const summary = [
    `Wallet: ${walletAddress}`,
    `SOL: ${solLine}`,
    ...(tokenSummaryLines.length > 0
      ? ["Tokens:", ...tokenSummaryLines]
      : ["No other tokens found."]),
    ...(totalLine ? [totalLine] : []),
  ].join("\n");

  return {
    walletAddress,
    solBalance,
    solBalanceFormatted: `${solBalance.toFixed(4)} SOL`,
    solPrice,
    solUsdValue,
    tokenCount: tokens.length,
    tokens: tokensWithPrices,
    totalUsdValue,
    hasPrices,
    summary,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenMint(mint: string): string {
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

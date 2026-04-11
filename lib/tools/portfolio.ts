import { z } from "zod"
import { connection, isValidPublicKey } from "@/lib/solana"
import { PublicKey } from "@solana/web3.js"

export const portfolioTool = {
  description:
    "Read the user's Solana wallet balances, token holdings, and current positions. Use this when the user asks about their portfolio, balance, holdings, what they own, or how much SOL/tokens they have.",
  parameters: z.object({
    walletAddress: z
      .string()
      .describe("The user's Solana wallet public key"),
  }),
}

export async function executePortfolioRead({
  walletAddress,
}: {
  walletAddress: string
}) {
  if (!isValidPublicKey(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`)
  }

  const pubkey = new PublicKey(walletAddress)
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

  const [lamports, tokenAccounts] = await Promise.all([
    connection.getBalance(pubkey),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    }),
  ])

  const solBalance = lamports / 1e9

  const tokens = tokenAccounts.value
    .map((account) => {
      const info = account.account.data.parsed?.info
      if (!info) return null
      const amount = (info.tokenAmount?.uiAmount as number) ?? 0
      if (amount === 0) return null
      return {
        mint: info.mint as string,
        amount,
        decimals: (info.tokenAmount?.decimals as number) ?? 0,
      }
    })
    .filter(Boolean)

  return {
    walletAddress,
    solBalance,
    solBalanceFormatted: `${solBalance.toFixed(4)} SOL`,
    tokenCount: tokens.length,
    tokens,
    summary: `Wallet holds ${solBalance.toFixed(4)} SOL and ${tokens.length} token type(s).`,
  }
}
"use client"

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
  LedgerWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets"
import { clusterApiUrl } from "@solana/web3.js"
import { useMemo } from "react"
import "@solana/wallet-adapter-react-ui/styles.css"
import "./globals.css"

const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as WalletAdapterNetwork
const endpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || clusterApiUrl(network)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  )

  return (
    <html lang="en">
      <head>
        <title>DOMINUS — AI DeFi Agent for Solana</title>
        <meta name="description" content="Natural language DeFi execution on Solana. Swap, stake, earn yield, and stream payments — in plain English." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              {children}
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  )
}
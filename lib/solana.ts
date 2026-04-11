import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"

export const connection = new Connection(
  process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
)

export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export async function sendAndConfirm(
  transaction: Transaction | VersionedTransaction
): Promise<string> {
  const txid = await connection.sendRawTransaction(
    transaction.serialize()
  )
  await connection.confirmTransaction(txid, "confirmed")
  return txid
}

export async function getSOLBalance(address: string): Promise<number> {
  if (!isValidPublicKey(address)) throw new Error("Invalid public key")
  const lamports = await connection.getBalance(new PublicKey(address))
  return lamports / 1e9 // convert lamports to SOL
}
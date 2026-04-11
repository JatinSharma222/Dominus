export const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? ""
export const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL ?? ""

if (!HELIUS_API_KEY) {
  console.warn("HELIUS_API_KEY is not set in .env.local")
}
// app/api/kamino/apy/route.ts
//
// Server-side proxy for Kamino Finance reserve/APY data.
// Fetches from Kamino's REST API — no klend-sdk needed.
// Returns hardcoded estimates if the live API is unreachable.

import { NextRequest, NextResponse } from "next/server"

// Approximate APY fallback values (updated April 2026)
// Used when Kamino API is unreachable so the UI never hard-errors.
const FALLBACK_APY: Record<string, { supplyApy: number; totalSupplyUsd: number; utilizationRate: number }> = {
  USDC:    { supplyApy: 6.5,  totalSupplyUsd: 120_000_000, utilizationRate: 78.2 },
  USDT:    { supplyApy: 5.8,  totalSupplyUsd: 45_000_000,  utilizationRate: 71.4 },
  SOL:     { supplyApy: 3.2,  totalSupplyUsd: 80_000_000,  utilizationRate: 62.1 },
  MSOL:    { supplyApy: 4.1,  totalSupplyUsd: 18_000_000,  utilizationRate: 55.3 },
  JITOSOL: { supplyApy: 4.8,  totalSupplyUsd: 22_000_000,  utilizationRate: 58.7 },
  BSOL:    { supplyApy: 4.2,  totalSupplyUsd: 9_000_000,   utilizationRate: 51.0 },
  BONK:    { supplyApy: 12.0, totalSupplyUsd: 5_000_000,   utilizationRate: 43.2 },
}

interface KaminoReserve {
  reserve?: string
  symbol?: string
  mintAddress?: string
  lendAPY?: number | string
  supplyInterestAPY?: number | string
  supplyAPY?: number | string
  apy?: number | string
  totalSupplyUsd?: number | string
  totalSupply?: number | string
  tvl?: number | string
  utilizationRate?: number | string
  utilizationRatio?: number | string
}

async function fetchFromKamino(marketAddress: string): Promise<KaminoReserve[] | null> {
  // Try multiple known endpoint formats in sequence
  const endpoints = [
    `https://api.kamino.finance/v2/kamino-market/${marketAddress}/reserves`,
    `https://api.kamino.finance/kamino-market/${marketAddress}/reserves`,
    `https://api.kamino.finance/v1/kamino-market/${marketAddress}/reserves`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "Accept":     "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; Dominus/1.0)",
          "Origin":     "https://app.kamino.finance",
          "Referer":    "https://app.kamino.finance/",
        },
        next: { revalidate: 60 }, // cache for 60s — APY doesn't change per-second
      })

      if (res.ok) {
        const data = await res.json()
        // Response can be either a top-level array or { reserves: [...] }
        if (Array.isArray(data)) return data as KaminoReserve[]
        if (data?.reserves && Array.isArray(data.reserves)) return data.reserves as KaminoReserve[]
        // Some versions return { data: [...] }
        if (data?.data && Array.isArray(data.data)) return data.data as KaminoReserve[]
      }
    } catch {
      // try next endpoint
    }
  }

  return null
}

function normaliseReserve(reserve: KaminoReserve) {
  const rawApy = Number(
    reserve.lendAPY ??
    reserve.supplyInterestAPY ??
    reserve.supplyAPY ??
    reserve.apy ??
    0
  )
  // Some API versions return decimal fraction (0.065), others return percent (6.5)
  const supplyApy = rawApy > 0 && rawApy < 1 ? rawApy * 100 : rawApy

  const rawSupply = Number(
    reserve.totalSupplyUsd ??
    reserve.totalSupply ??
    reserve.tvl ??
    0
  )

  const rawUtil = Number(
    reserve.utilizationRate ??
    reserve.utilizationRatio ??
    0
  )
  const utilizationRate = rawUtil > 0 && rawUtil < 1 ? rawUtil * 100 : rawUtil

  return { supplyApy, totalSupplyUsd: rawSupply, utilizationRate }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const marketAddress = searchParams.get("market")
  const mint          = searchParams.get("mint")
  const symbol        = searchParams.get("symbol")?.toUpperCase() ?? ""

  if (!marketAddress || !mint) {
    return NextResponse.json(
      { error: "Missing required params: market, mint" },
      { status: 400 }
    )
  }

  try {
    const reserves = await fetchFromKamino(marketAddress)

    if (reserves) {
      const reserve = reserves.find(
        (r) =>
          r.mintAddress?.toLowerCase() === mint.toLowerCase() ||
          r.symbol?.toUpperCase() === symbol
      )

      if (reserve) {
        return NextResponse.json({
          ...normaliseReserve(reserve),
          source: "live",
        })
      }

      // Market responded but token not found — list what's available
      const available = reserves.map((r) => r.symbol).filter(Boolean).join(", ")
      return NextResponse.json(
        { error: `No reserve for ${symbol} in this market. Available: ${available}` },
        { status: 404 }
      )
    }

    // Kamino API unreachable — fall back to hardcoded estimates
    const fallback = FALLBACK_APY[symbol]
    if (fallback) {
      return NextResponse.json({ ...fallback, source: "estimated" })
    }

    return NextResponse.json(
      { error: `Kamino API unavailable and no fallback data for ${symbol}` },
      { status: 503 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[kamino/apy] error:", msg)

    // Last-resort fallback
    const fallback = FALLBACK_APY[symbol]
    if (fallback) {
      return NextResponse.json({ ...fallback, source: "estimated" })
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
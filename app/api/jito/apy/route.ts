// app/api/jito/apy/route.ts
//
// Proxies Jito APY data server-side to avoid CORS issues.
// Tries Jito's public KPI API, falls back to hardcoded estimate.
//
// Response is cached 60 seconds — APY doesn't change per-second.

import { NextResponse } from "next/server"

const FALLBACK_APY = 8.2  // % — approximate Jito jitoSOL APY as of April 2026

// Jito KPI API endpoint for current APY
const JITO_APY_ENDPOINTS = [
  "https://kpi.jito.network/metrics/v2/apy",
  "https://kpi.jito.network/metrics/apy",
]

export async function GET() {
  // Try each Jito APY endpoint in sequence
  for (const url of JITO_APY_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept:     "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; Dominus/1.0)",
        },
        next: { revalidate: 60 },
      })

      if (!res.ok) continue

      const data = await res.json()

      // Jito KPI API returns { apy: 0.0823 } (decimal fraction) or { apy: 8.23 } (%)
      // Normalise to percentage
      let apyValue: number | null = null

      if (typeof data?.apy === "number") {
        apyValue = data.apy < 1 ? data.apy * 100 : data.apy
      } else if (typeof data?.jitoSOL?.apy === "number") {
        apyValue = data.jitoSOL.apy < 1 ? data.jitoSOL.apy * 100 : data.jitoSOL.apy
      } else if (Array.isArray(data) && typeof data[0]?.apy === "number") {
        apyValue = data[0].apy < 1 ? data[0].apy * 100 : data[0].apy
      }

      if (apyValue !== null && apyValue > 0 && apyValue < 100) {
        return NextResponse.json(
          {
            apy:    apyValue,
            source: "live" as const,
          },
          { headers: { "Cache-Control": "public, max-age=60" } }
        )
      }
    } catch (err) {
      console.warn(`[jito/apy] endpoint ${url} failed:`, err)
    }
  }

  // All endpoints failed — return hardcoded estimate
  console.warn("[jito/apy] all endpoints failed, using fallback APY estimate")
  return NextResponse.json(
    {
      apy:    FALLBACK_APY,
      source: "estimated" as const,
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  )
}
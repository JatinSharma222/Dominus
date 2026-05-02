// app/api/kamino/deposit/route.ts

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  let token = "USDC"
  let amount = 0
  try {
    const body = await req.json()
    token  = body.token  ?? "USDC"
    amount = body.amount ?? 0
  } catch {
    // ignore
  }

  return NextResponse.json(
    {
      error:
        `Kamino on-chain deposit (${amount} ${token}) is coming in the next release. ` +
        "The preview above shows live mainnet APY and projected earnings. " +
        "Direct integration via Kamino's web app: https://app.kamino.finance",
    },
    { status: 503 }
  )
}
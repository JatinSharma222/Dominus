// app/api/jupiter/quote/route.ts
import { NextRequest, NextResponse } from "next/server"

const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote"


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const url = new URL(JUPITER_QUOTE_API)
  searchParams.forEach((value, key) => url.searchParams.set(key, value))

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Accept":     "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; Dominus/1.0)",
        "Origin":     "https://jup.ag",
        "Referer":    "https://jup.ag/",
      },
    })

    const body = await res.text()

    if (!res.ok) {
      return NextResponse.json(
        { error: `Jupiter quote failed (${res.status}): ${body}` },
        { status: res.status }
      )
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[jupiter/quote proxy] fetch error:", msg)
    return NextResponse.json(
      { error: `Proxy error: ${msg}` },
      { status: 500 }
    )
  }
}
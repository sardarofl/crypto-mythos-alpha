import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";

export async function GET(request: NextRequest) {
  try {
    const client = getClient();
    const searchParams = request.nextUrl.searchParams;
    const pair = searchParams.get("pair") || "BTC/USDT";
    const timeframe = searchParams.get("timeframe") || "5m";
    const limit = parseInt(searchParams.get("limit") || "500");

    const result = await client.getPairCandles(pair, timeframe, limit);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

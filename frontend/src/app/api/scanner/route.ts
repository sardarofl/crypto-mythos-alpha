import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";

export async function POST(request: NextRequest) {
  try {
    const client = getClient();
    const body = await request.json();

    const pairlistConfig = {
      pairlists: [
        {
          method: "VolumePairList",
          number_assets: body.pairCount || 20,
          sort_key: "quoteVolume",
          min_value: body.minVolume || 100000,
        },
        {
          method: "AgeFilter",
          min_days_listed: 30,
        },
        {
          method: "PriceFilter",
          low_price_ratio: 0.01,
        },
        {
          method: "SpreadFilter",
          max_spread_ratio: body.maxSpread || 0.005,
        },
        ...(body.minVolatility || body.maxVolatility
          ? [
              {
                method: "VolatilityFilter",
                lookback_days: 7,
                min_volatility: body.minVolatility || 0.01,
                max_volatility: body.maxVolatility || 0.10,
              },
            ]
          : []),
      ],
      stake_currency: body.stakeCurrency || "USDT",
      exchange: body.exchange || "binance",
    };

    const result = await client.evaluatePairlist(pairlistConfig);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = getClient();
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const result = await client.getPairlistResult(jobId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

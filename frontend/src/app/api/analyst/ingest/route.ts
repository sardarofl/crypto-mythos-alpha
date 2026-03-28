import { NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";
import { upsertShadow, getTrackedTradeIds } from "@/lib/analyst-db";

export async function POST() {
  try {
    const client = getClient();
    const { trades } = await client.getTrades(100, 0);

    const trackedIds = new Set(getTrackedTradeIds());
    let ingested = 0;

    for (const trade of trades) {
      if (trade.is_open || !trade.close_timestamp || trackedIds.has(trade.trade_id)) {
        continue;
      }

      upsertShadow({
        trade_id: trade.trade_id,
        pair: trade.pair,
        open_rate: trade.open_rate,
        close_rate: trade.close_rate ?? trade.current_rate,
        close_timestamp: trade.close_timestamp,
        exit_reason: trade.exit_reason,
        profit_ratio: trade.profit_ratio,
        stake_amount: trade.stake_amount,
      });
      ingested++;
    }

    return NextResponse.json({ ingested, total_tracked: trackedIds.size + ingested });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

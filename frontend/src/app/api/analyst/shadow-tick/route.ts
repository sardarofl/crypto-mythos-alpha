import { NextResponse } from "next/server";
import { getClient } from "@/lib/freqtrade-client";
import {
  getIncompleteShadows,
  updateShadowPrice,
  markShadowComplete,
  SHADOW_INTERVALS,
  type ShadowRow,
} from "@/lib/analyst-db";

export async function GET() {
  try {
    const shadows = getIncompleteShadows();
    if (shadows.length === 0) {
      return NextResponse.json({ processed: 0, pending: 0, message: "No pending shadows" });
    }

    // Group shadows by pair to minimize API calls
    const byPair = new Map<string, ShadowRow[]>();
    for (const s of shadows) {
      const arr = byPair.get(s.pair) || [];
      arr.push(s);
      byPair.set(s.pair, arr);
    }

    const client = getClient();
    const now = Date.now();
    let processed = 0;

    for (const [pair, pairShadows] of byPair) {
      // Fetch candles once per pair: 15m timeframe, 100 candles = 25 hours
      let candles: { timestamp: number; close: number }[];
      try {
        const raw = await client.getPairCandles(pair, "15m", 100);
        const dateIdx = raw.columns.indexOf("date");
        const closeIdx = raw.columns.indexOf("close");
        if (dateIdx === -1 || closeIdx === -1) continue;

        candles = raw.data.map(row => ({
          timestamp: new Date(row[dateIdx] as string).getTime(),
          close: row[closeIdx] as number,
        }));
      } catch (e) {
        console.error(`[Analyst] Failed to get candles for ${pair}:`, e);
        continue;
      }

      for (const shadow of pairShadows) {
        let updated = false;

        for (const interval of SHADOW_INTERVALS) {
          // Skip if already filled
          const currentVal = shadow[interval.column as keyof ShadowRow];
          if (currentVal !== null) continue;

          // Check if enough time has passed
          const targetTime = shadow.close_timestamp + interval.minutes * 60 * 1000;
          if (now < targetTime) continue;

          // Find the candle closest to the target time
          const closest = findClosestCandle(candles, targetTime);
          if (!closest) continue;

          updateShadowPrice(shadow.trade_id, interval.column, closest.close);
          updated = true;
        }

        if (updated) processed++;

        // Check if all columns are now filled
        const allFilled = SHADOW_INTERVALS.every(interval => {
          const val = shadow[interval.column as keyof ShadowRow];
          if (val !== null) return true;
          // Check if we just filled it (target time passed and candle found)
          const targetTime = shadow.close_timestamp + interval.minutes * 60 * 1000;
          return now >= targetTime;
        });

        if (allFilled && updated) {
          markShadowComplete(shadow.trade_id);
        }
      }
    }

    // Count remaining
    const remaining = getIncompleteShadows().length;

    return NextResponse.json({ processed, pending: remaining });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function findClosestCandle(
  candles: { timestamp: number; close: number }[],
  targetTime: number
): { timestamp: number; close: number } | null {
  if (candles.length === 0) return null;

  let best = candles[0];
  let bestDiff = Math.abs(candles[0].timestamp - targetTime);

  for (const c of candles) {
    const diff = Math.abs(c.timestamp - targetTime);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }

  // Only accept candles within 30 minutes of target
  if (bestDiff > 30 * 60 * 1000) return null;

  return best;
}

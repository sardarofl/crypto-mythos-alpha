import { NextResponse } from "next/server";
import {
  getCompletedUnanalyzedShadows,
  insertAnalysis,
  SHADOW_INTERVALS,
  type ShadowRow,
} from "@/lib/analyst-db";

export async function POST() {
  try {
    const shadows = getCompletedUnanalyzedShadows();
    const results: { trade_id: number; pair: string; classification: string }[] = [];

    for (const shadow of shadows) {
      const analysis = classifyTrade(shadow);
      insertAnalysis({
        trade_id: shadow.trade_id,
        pair: shadow.pair,
        classification: analysis.classification,
        max_price_after: analysis.max_price_after,
        max_profit_if_held: analysis.max_profit_if_held,
        recovery_time_minutes: analysis.recovery_time_minutes,
        missed_upside_pct: analysis.missed_upside_pct,
        exit_reason: shadow.exit_reason,
      });
      results.push({
        trade_id: shadow.trade_id,
        pair: shadow.pair,
        classification: analysis.classification,
      });
    }

    return NextResponse.json({ analyzed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function classifyTrade(shadow: ShadowRow) {
  const prices = SHADOW_INTERVALS.map(interval => ({
    minutes: interval.minutes,
    price: shadow[interval.column as keyof ShadowRow] as number | null,
  })).filter(p => p.price !== null) as { minutes: number; price: number }[];

  if (prices.length === 0) {
    return {
      classification: "correct_exit" as const,
      max_price_after: null,
      max_profit_if_held: null,
      recovery_time_minutes: null,
      missed_upside_pct: null,
    };
  }

  const maxPrice = Math.max(...prices.map(p => p.price));
  const maxProfitIfHeld = (maxPrice - shadow.open_rate) / shadow.open_rate;
  const missedUpsidePct = ((maxPrice - shadow.close_rate) / shadow.close_rate) * 100;

  // Find recovery time: first price that exceeds close_rate
  let recoveryMinutes: number | null = null;
  for (const p of prices) {
    if (p.price > shadow.close_rate) {
      recoveryMinutes = p.minutes;
      break;
    }
  }

  // Classification logic
  let classification: string;

  if (shadow.profit_ratio >= 0) {
    // Trade was a win
    if (missedUpsidePct > 2) {
      classification = "missed_opportunity";
    } else {
      classification = "correct_exit";
    }
  } else {
    // Trade was a loss
    if (maxProfitIfHeld > 0.005 && recoveryMinutes !== null && recoveryMinutes <= 60) {
      // Price recovered to profit within 1 hour - premature exit
      classification = "premature_exit";
    } else if (maxProfitIfHeld > 0.005 && recoveryMinutes !== null) {
      // Price recovered but took longer than 1 hour
      classification = "missed_opportunity";
    } else if (recoveryMinutes !== null && maxPrice > shadow.close_rate) {
      // Price went above exit price but never reached meaningful profit
      classification = "close_call";
    } else {
      // Price kept falling or stayed flat - exit was right
      classification = "correct_exit";
    }
  }

  return {
    classification,
    max_price_after: maxPrice,
    max_profit_if_held: maxProfitIfHeld,
    recovery_time_minutes: recoveryMinutes,
    missed_upside_pct: missedUpsidePct,
  };
}

import { NextResponse } from "next/server";
import { getAllShadows, getAllAnalyses, getAllOverrides } from "@/lib/analyst-db";

export async function GET() {
  try {
    const shadows = getAllShadows();
    const analyses = getAllAnalyses();
    const overrides = getAllOverrides();

    // Compute summary statistics
    const totalTracked = shadows.length;
    const totalAnalyzed = analyses.length;

    const prematureCount = analyses.filter(a => a.classification === "premature_exit").length;
    const prematureExitRate = totalAnalyzed > 0 ? prematureCount / totalAnalyzed : 0;

    const missedUpsides = analyses
      .filter(a => a.missed_upside_pct !== null)
      .map(a => a.missed_upside_pct as number);
    const avgMissedUpside = missedUpsides.length > 0
      ? missedUpsides.reduce((a, b) => a + b, 0) / missedUpsides.length
      : 0;

    // Per-pair stats
    const pairStats: Record<string, {
      trades: number;
      premature: number;
      correct: number;
      missed_opportunity: number;
      close_call: number;
      avg_missed_upside: number;
      avg_recovery_minutes: number | null;
    }> = {};

    for (const a of analyses) {
      if (!pairStats[a.pair]) {
        pairStats[a.pair] = {
          trades: 0, premature: 0, correct: 0,
          missed_opportunity: 0, close_call: 0,
          avg_missed_upside: 0, avg_recovery_minutes: null,
        };
      }
      const ps = pairStats[a.pair];
      ps.trades++;
      if (a.classification === "premature_exit") ps.premature++;
      else if (a.classification === "correct_exit") ps.correct++;
      else if (a.classification === "missed_opportunity") ps.missed_opportunity++;
      else if (a.classification === "close_call") ps.close_call++;
    }

    // Compute per-pair averages
    for (const pair of Object.keys(pairStats)) {
      const pairAnalyses = analyses.filter(a => a.pair === pair);
      const upsides = pairAnalyses
        .filter(a => a.missed_upside_pct !== null)
        .map(a => a.missed_upside_pct as number);
      pairStats[pair].avg_missed_upside = upsides.length > 0
        ? upsides.reduce((a, b) => a + b, 0) / upsides.length
        : 0;

      const recoveries = pairAnalyses
        .filter(a => a.recovery_time_minutes !== null)
        .map(a => a.recovery_time_minutes as number);
      pairStats[pair].avg_recovery_minutes = recoveries.length > 0
        ? recoveries.reduce((a, b) => a + b, 0) / recoveries.length
        : null;
    }

    return NextResponse.json({
      shadows,
      analyses,
      overrides,
      summary: {
        total_tracked: totalTracked,
        total_analyzed: totalAnalyzed,
        premature_exit_rate: prematureExitRate,
        avg_missed_upside: avgMissedUpside,
        pair_stats: pairStats,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

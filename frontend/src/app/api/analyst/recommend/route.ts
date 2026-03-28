import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings-db";
import { getAllAnalyses, getAllShadows, upsertPairOverride } from "@/lib/analyst-db";

// Cooldown: minimum 5 minutes between AI calls
let lastRecommendTime = 0;

function getMinimaxApiKey(): string | null {
  const dbKey = getSetting("minimax_api_key");
  if (dbKey) return dbKey;
  return process.env.MINIMAX_API_KEY || null;
}

export async function POST() {
  try {
    // Cooldown check
    const now = Date.now();
    if (now - lastRecommendTime < 5 * 60 * 1000) {
      const waitSec = Math.ceil((5 * 60 * 1000 - (now - lastRecommendTime)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSec}s before requesting new recommendations` },
        { status: 429 }
      );
    }

    const apiKey = getMinimaxApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "MiniMax API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    const analyses = getAllAnalyses();
    const shadows = getAllShadows();

    if (analyses.length === 0) {
      return NextResponse.json(
        { error: "No trade analysis data yet. Run analysis first." },
        { status: 400 }
      );
    }

    // Build per-pair stats for the prompt
    const pairData: Record<string, {
      total: number;
      premature: number;
      correct: number;
      close_call: number;
      missed: number;
      avg_recovery: number | null;
      avg_missed_upside: number;
      exit_reasons: Record<string, number>;
    }> = {};

    for (const a of analyses) {
      if (!pairData[a.pair]) {
        pairData[a.pair] = {
          total: 0, premature: 0, correct: 0, close_call: 0, missed: 0,
          avg_recovery: null, avg_missed_upside: 0, exit_reasons: {},
        };
      }
      const pd = pairData[a.pair];
      pd.total++;
      if (a.classification === "premature_exit") pd.premature++;
      else if (a.classification === "correct_exit") pd.correct++;
      else if (a.classification === "close_call") pd.close_call++;
      else if (a.classification === "missed_opportunity") pd.missed++;

      if (a.exit_reason) {
        pd.exit_reasons[a.exit_reason] = (pd.exit_reasons[a.exit_reason] || 0) + 1;
      }
    }

    // Compute averages
    for (const pair of Object.keys(pairData)) {
      const pairAnalyses = analyses.filter(a => a.pair === pair);
      const recoveries = pairAnalyses
        .filter(a => a.recovery_time_minutes !== null)
        .map(a => a.recovery_time_minutes as number);
      pairData[pair].avg_recovery = recoveries.length > 0
        ? Math.round(recoveries.reduce((a, b) => a + b, 0) / recoveries.length)
        : null;

      const upsides = pairAnalyses
        .filter(a => a.missed_upside_pct !== null)
        .map(a => a.missed_upside_pct as number);
      pairData[pair].avg_missed_upside = upsides.length > 0
        ? parseFloat((upsides.reduce((a, b) => a + b, 0) / upsides.length).toFixed(2))
        : 0;
    }

    // Fetch current sentiment
    let sentimentContext = "";
    try {
      const sentRes = await fetch("http://127.0.0.1:3000/api/sentiment");
      if (sentRes.ok) {
        const sentData = await sentRes.json();
        const fg = sentData.fearGreed?.value;
        if (fg !== undefined) sentimentContext += `Fear & Greed Index: ${fg}/100\n`;
        for (const coin of sentData.coins || []) {
          sentimentContext += `${coin.coin}: ${coin.sentiment} (${coin.confidence}% confidence)\n`;
        }
      }
    } catch {
      sentimentContext = "Sentiment data unavailable\n";
    }

    // Build pair analysis text
    let pairText = "";
    for (const [pair, pd] of Object.entries(pairData)) {
      const exitReasonStr = Object.entries(pd.exit_reasons)
        .map(([reason, count]) => `${reason} (${count})`)
        .join(", ");
      pairText += `
PAIR: ${pair}
  Total trades: ${pd.total}
  Premature exits: ${pd.premature} (${pd.total > 0 ? Math.round((pd.premature / pd.total) * 100) : 0}%)
  Correct exits: ${pd.correct}
  Close calls: ${pd.close_call}
  Missed opportunities: ${pd.missed}
  Avg recovery time: ${pd.avg_recovery !== null ? `${pd.avg_recovery} minutes` : "N/A"}
  Avg missed upside: ${pd.avg_missed_upside}%
  Exit reasons: ${exitReasonStr || "N/A"}
`;
    }

    const prompt = `You are a crypto trading strategy optimizer. Analyze the post-trade performance data below and recommend per-pair parameter adjustments.

CURRENT STRATEGY PARAMETERS:
- sell_rsi_high: 75 (exit when RSI exceeds this)
- sell_volume_decline_candles: 3 (exit when volume declines for N consecutive candles)
- time_exit_loss_minutes: 120 (exit losing trades after this many minutes)
- time_exit_stale_minutes: 240 (exit stale trades after this many minutes)

POST-TRADE ANALYSIS BY PAIR:
${pairText}

MARKET CONTEXT:
${sentimentContext}

Based on this data, recommend parameter overrides for pairs where the data supports changes.

Respond with ONLY this JSON structure:
{"recommendations":[{"pair":"BTC/USDT","overrides":[{"parameter":"sell_volume_decline_candles","current":3,"recommended":5,"reasoning":"60% premature exits from volume_dry suggests volume dips are temporary","confidence":75}],"summary":"Brief explanation for this pair"}]}

Rules:
- Only recommend changes where premature_exit rate > 40% for that pair OR missed_opportunity rate is notable
- Keep recommendations conservative (small parameter shifts)
- Available parameters to adjust:
  - sell_volume_decline_candles: range 2-8 (higher = more tolerant of volume dips)
  - sell_rsi_high: range 70-90 (higher = hold longer before RSI exit)
  - exit_delay_candles: range 0-6 (extra candles to wait before confirming exit signal)
  - hold_through_volume_dry: 0 or 1 (if 1, ignore volume_dry exit for this pair)
  - time_exit_loss_minutes: range 120-360 (longer = more patience for losing trades)
- Include confidence 0-100 for each override
- If a pair has too few trades (< 2) to draw conclusions, skip it`;

    const requestBody = {
      model: "MiniMax-M2.7",
      messages: [
        { role: "system", content: "Output ONLY valid JSON. No markdown, no explanation." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    };

    console.log("[Analyst] Calling MiniMax API for recommendations...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const res = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Analyst] MiniMax error:", res.status, errText);
      return NextResponse.json(
        { error: `MiniMax API returned ${res.status}: ${errText.substring(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";

    // Parse response (same cleanup as sentiment route)
    let jsonStr = content.trim();
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```\s*$/g, "").trim();
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Analyst] No JSON found in response:", jsonStr.substring(0, 500));
      return NextResponse.json(
        { error: "No valid JSON in AI response" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const recommendations = parsed.recommendations || [];

    // Store recommendations as pair overrides
    let stored = 0;
    for (const rec of recommendations) {
      for (const override of rec.overrides || []) {
        upsertPairOverride({
          pair: rec.pair,
          parameter_name: override.parameter,
          original_value: override.current ?? null,
          recommended_value: override.recommended,
          reasoning: override.reasoning || rec.summary || null,
          confidence: override.confidence ?? null,
        });
        stored++;
      }
    }

    lastRecommendTime = Date.now();

    console.log(`[Analyst] Stored ${stored} overrides from ${recommendations.length} pairs`);

    return NextResponse.json({
      recommendations,
      stored,
      message: `AI generated ${stored} parameter recommendations for ${recommendations.length} pairs`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Analyst] Recommend error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

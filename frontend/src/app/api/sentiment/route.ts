import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/settings-db";

// The monitored pairs
const PAIRS = [
  "BTC", "ETH", "SOL", "XRP", "DOGE",
  "ADA", "AVAX", "LINK", "DOT", "NEAR",
];

// Coin name mapping for news search
const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP Ripple",
  DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche", LINK: "Chainlink",
  DOT: "Polkadot", NEAR: "NEAR Protocol",
};

interface CoinSentiment {
  coin: string;
  name: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  headlines: string[];
}

interface SentimentResponse {
  fearGreed: { value: number; classification: string; timestamp: string } | null;
  coins: CoinSentiment[];
  marketSummary: string;
  lastUpdated: string;
  error?: string;
}

// In-memory cache to avoid hammering APIs
let cachedSentiment: SentimentResponse | null = null;
let cacheTimestamp = 0;

// Get API key from DB or env var fallback
function getMinimaxApiKey(): string | null {
  const dbKey = getSetting("minimax_api_key");
  if (dbKey) return dbKey;
  return process.env.MINIMAX_API_KEY || null;
}

// Fetch Fear & Greed Index (free, no key)
async function fetchFearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      cache: "no-store",
    });
    const data = await res.json();
    if (data?.data?.[0]) {
      const d = data.data[0];
      return {
        value: parseInt(d.value),
        classification: d.value_classification,
        timestamp: new Date(parseInt(d.timestamp) * 1000).toISOString(),
      };
    }
  } catch (e) {
    console.error("Fear & Greed fetch failed:", e);
  }
  return null;
}

// Fetch crypto news headlines from CryptoCompare (free tier)
async function fetchNewsHeadlines(): Promise<{ title: string; categories: string }[]> {
  try {
    const res = await fetch(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular",
      { cache: "no-store" }
    );
    const data = await res.json();
    if (data?.Data) {
      return data.Data.slice(0, 20).map((article: { title: string; categories: string }) => ({
        title: article.title,
        categories: article.categories || "",
      }));
    }
  } catch (e) {
    console.error("News fetch failed:", e);
  }
  return [];
}

// Send headlines to MiniMax M2.7 for per-coin sentiment analysis
async function analyzeSentimentWithMinimax(
  apiKey: string,
  headlines: { title: string; categories: string }[],
  fearGreedValue: number | null
): Promise<{ coins: CoinSentiment[]; marketSummary: string; failed: boolean }> {
  const headlineText = headlines
    .map((h, i) => `${i + 1}. ${h.title}`)
    .join("\n");

  const prompt = `Analyze these crypto news headlines. For each coin, give sentiment.

HEADLINES:
${headlineText}

${fearGreedValue !== null ? `Fear & Greed Index: ${fearGreedValue}/100` : ""}

COINS: ${PAIRS.join(", ")}

Respond with ONLY this JSON structure, nothing else:
{"coins":[{"coin":"BTC","sentiment":"bullish","confidence":75,"summary":"One simple sentence for beginners"}],"marketSummary":"2-3 sentences about overall market mood in plain English for someone new to crypto."}

Rules: sentiment = bullish/bearish/neutral. confidence = 0-100. If no news about a coin, use neutral with low confidence.`;

  const requestBody = {
    model: "MiniMax-M2.7",
    messages: [
      { role: "system", content: "Output ONLY valid JSON. No markdown, no explanation." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  };

  console.log("[Sentiment] Calling MiniMax API...");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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

    console.log("[Sentiment] MiniMax response status:", res.status);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Sentiment] MiniMax API error:", res.status, errText);
      throw new Error(`MiniMax API returned ${res.status}: ${errText.substring(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";

    console.log("[Sentiment] MiniMax raw response length:", content.length);
    console.log("[Sentiment] MiniMax response preview:", content.substring(0, 200));

    // Strip thinking tags (MiniMax M2.7 is a reasoning model)
    let jsonStr = content.trim();
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Strip markdown code fences
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```\s*$/g, "").trim();
    }

    // Find the JSON object in case there's any remaining text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Sentiment] No JSON found in cleaned response:", jsonStr.substring(0, 500));
      throw new Error("No JSON object found in MiniMax response");
    }
    jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);

    console.log("[Sentiment] Successfully parsed sentiment for", parsed.coins?.length, "coins");

    // Map results to our format
    const coins: CoinSentiment[] = PAIRS.map((coin) => {
      const found = parsed.coins?.find(
        (c: { coin: string }) => c.coin.toUpperCase() === coin
      );
      return {
        coin,
        name: COIN_NAMES[coin],
        sentiment: found?.sentiment || "neutral",
        confidence: found?.confidence ?? 30,
        summary: found?.summary || "No recent news activity for this coin.",
        headlines: headlines
          .filter(
            (h) =>
              h.title.toUpperCase().includes(coin) ||
              h.title.toUpperCase().includes(COIN_NAMES[coin].toUpperCase()) ||
              h.categories.toUpperCase().includes(coin)
          )
          .slice(0, 3)
          .map((h) => h.title),
      };
    });

    return {
      coins,
      marketSummary: parsed.marketSummary || "Unable to generate market summary.",
      failed: false,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[Sentiment] MiniMax analysis failed:", errMsg);
    return {
      coins: PAIRS.map((coin) => ({
        coin,
        name: COIN_NAMES[coin],
        sentiment: "neutral" as const,
        confidence: 0,
        summary: "Sentiment analysis temporarily unavailable.",
        headlines: [],
      })),
      marketSummary: `Sentiment analysis failed: ${errMsg}. The AI will retry on the next refresh.`,
      failed: true,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const sentimentEnabled = getSetting("sentiment_enabled") ?? "true";
    if (sentimentEnabled !== "true") {
      return NextResponse.json({
        fearGreed: null,
        coins: [],
        marketSummary: "Sentiment analysis is disabled. Enable it in Settings.",
        lastUpdated: new Date().toISOString(),
      });
    }

    // Check cache (skip if force refresh or if cached result was an error)
    if (!forceRefresh) {
      const refreshMinutes = parseInt(getSetting("sentiment_refresh_minutes") ?? "15");
      const cacheMs = refreshMinutes * 60 * 1000;
      if (cachedSentiment && !cachedSentiment.error && Date.now() - cacheTimestamp < cacheMs) {
        return NextResponse.json(cachedSentiment);
      }
    }

    // Clear cache on force refresh
    if (forceRefresh) {
      cachedSentiment = null;
      cacheTimestamp = 0;
      console.log("[Sentiment] Cache cleared, force refreshing...");
    }

    const apiKey = getMinimaxApiKey();

    // Always fetch Fear & Greed (free)
    const fearGreed = await fetchFearGreed();

    if (!apiKey) {
      const response: SentimentResponse = {
        fearGreed,
        coins: PAIRS.map((coin) => ({
          coin,
          name: COIN_NAMES[coin],
          sentiment: "neutral" as const,
          confidence: 0,
          summary: "Add your MiniMax API key in Settings to enable AI sentiment analysis.",
          headlines: [],
        })),
        marketSummary:
          "Add your MiniMax API key in Settings to unlock AI-powered sentiment analysis for each coin. The Fear & Greed Index is shown above — it's free and always available.",
        lastUpdated: new Date().toISOString(),
        error: "no_api_key",
      };
      return NextResponse.json(response);
    }

    console.log("[Sentiment] API key found, fetching headlines...");

    // Fetch news + analyze
    const headlines = await fetchNewsHeadlines();
    console.log("[Sentiment] Got", headlines.length, "headlines, analyzing with MiniMax...");

    const { coins, marketSummary, failed } = await analyzeSentimentWithMinimax(
      apiKey,
      headlines,
      fearGreed?.value ?? null
    );

    const response: SentimentResponse = {
      fearGreed,
      coins,
      marketSummary,
      lastUpdated: new Date().toISOString(),
      error: failed ? "minimax_failed" : undefined,
    };

    // Only cache successful results
    if (!failed) {
      cachedSentiment = response;
      cacheTimestamp = Date.now();
      console.log("[Sentiment] Cached successful result");
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Sentiment] API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sentiment data" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
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

// Fetch Fear & Greed Index (free, no key)
async function fetchFearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      next: { revalidate: 3600 },
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
async function fetchNewsHeadlines(): Promise<{ title: string; body: string; categories: string }[]> {
  try {
    const res = await fetch(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular",
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    if (data?.Data) {
      return data.Data.slice(0, 50).map((article: { title: string; body: string; categories: string }) => ({
        title: article.title,
        body: (article.body || "").substring(0, 200),
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
  headlines: { title: string; body: string; categories: string }[],
  fearGreedValue: number | null
): Promise<{ coins: CoinSentiment[]; marketSummary: string }> {
  const headlineText = headlines
    .map((h, i) => `${i + 1}. ${h.title}`)
    .join("\n");

  const prompt = `You are a crypto market sentiment analyst for a trading dashboard. Analyze these recent crypto news headlines and provide sentiment for each coin.

HEADLINES:
${headlineText}

${fearGreedValue !== null ? `Current Fear & Greed Index: ${fearGreedValue}/100` : ""}

COINS TO ANALYZE: ${PAIRS.map(p => `${p} (${COIN_NAMES[p]})`).join(", ")}

You MUST respond with ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{
  "coins": [
    {
      "coin": "BTC",
      "sentiment": "bullish",
      "confidence": 75,
      "summary": "One sentence explaining why in simple terms a beginner would understand"
    }
  ],
  "marketSummary": "2-3 sentences explaining the overall crypto market mood right now in plain English. Write like you're explaining to a friend who just started trading. Be specific about what's happening and what it means for traders. Mention any major events or trends."
}

RULES:
- sentiment must be "bullish", "bearish", or "neutral"
- confidence is 0-100 (how confident you are in this call)
- summary should be ONE sentence, written for a complete beginner, no jargon
- marketSummary should be friendly, clear, and actionable - tell the reader what the mood is and what to watch out for
- If no news mentions a coin, use "neutral" with low confidence and say "No recent news activity"
- Be honest - if the signal is mixed, say so`;

  try {
    const res = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-M2.7",
        messages: [
          { role: "system", content: "You are a JSON-only crypto sentiment analyst. Never output anything except valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("MiniMax API error:", res.status, errText);
      throw new Error(`MiniMax API returned ${res.status}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonStr);

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
    };
  } catch (e) {
    console.error("MiniMax analysis failed:", e);
    // Return neutral fallback
    return {
      coins: PAIRS.map((coin) => ({
        coin,
        name: COIN_NAMES[coin],
        sentiment: "neutral" as const,
        confidence: 0,
        summary: "Sentiment analysis temporarily unavailable.",
        headlines: [],
      })),
      marketSummary: "Sentiment analysis is temporarily unavailable. Check your MiniMax API key in Settings.",
    };
  }
}

export async function GET() {
  try {
    const sentimentEnabled = getSetting("sentiment_enabled") ?? "true";
    if (sentimentEnabled !== "true") {
      return NextResponse.json({
        fearGreed: null,
        coins: [],
        marketSummary: "Sentiment analysis is disabled. Enable it in Settings.",
        lastUpdated: new Date().toISOString(),
      });
    }

    // Check cache
    const refreshMinutes = parseInt(getSetting("sentiment_refresh_minutes") ?? "15");
    const cacheMs = refreshMinutes * 60 * 1000;
    if (cachedSentiment && Date.now() - cacheTimestamp < cacheMs) {
      return NextResponse.json(cachedSentiment);
    }

    const apiKey = getSetting("minimax_api_key");

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

    // Fetch news + analyze
    const headlines = await fetchNewsHeadlines();
    const { coins, marketSummary } = await analyzeSentimentWithMinimax(
      apiKey,
      headlines,
      fearGreed?.value ?? null
    );

    const response: SentimentResponse = {
      fearGreed,
      coins,
      marketSummary,
      lastUpdated: new Date().toISOString(),
    };

    // Cache it
    cachedSentiment = response;
    cacheTimestamp = Date.now();

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sentiment API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sentiment data" },
      { status: 500 }
    );
  }
}

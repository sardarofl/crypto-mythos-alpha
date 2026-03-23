"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useSentiment } from "@/hooks/useFreqtrade";
import { timeAgo } from "@/lib/formatters";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Newspaper,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import type { CoinSentiment } from "@/types/freqtrade";

// Fear & Greed gauge colors
function fgColor(value: number): string {
  if (value <= 25) return "text-[var(--color-danger)]";
  if (value <= 45) return "text-orange-400";
  if (value <= 55) return "text-yellow-400";
  if (value <= 75) return "text-lime-400";
  return "text-[var(--color-success)]";
}

function fgBgColor(value: number): string {
  if (value <= 25) return "bg-[var(--color-danger)]";
  if (value <= 45) return "bg-orange-400";
  if (value <= 55) return "bg-yellow-400";
  if (value <= 75) return "bg-lime-400";
  return "bg-[var(--color-success)]";
}

function sentimentIcon(sentiment: string) {
  switch (sentiment) {
    case "bullish":
      return <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />;
    case "bearish":
      return <TrendingDown className="h-4 w-4 text-[var(--color-danger)]" />;
    default:
      return <Minus className="h-4 w-4 text-[var(--color-muted)]" />;
  }
}

function sentimentVariant(sentiment: string): "success" | "danger" | "neutral" {
  switch (sentiment) {
    case "bullish":
      return "success";
    case "bearish":
      return "danger";
    default:
      return "neutral";
  }
}

function CoinCard({ coin }: { coin: CoinSentiment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={clsx(
        "rounded-lg border border-[var(--color-border)] p-3 transition-all hover:border-[var(--color-accent)]/30",
        coin.sentiment === "bullish" && "border-l-2 border-l-[var(--color-success)]",
        coin.sentiment === "bearish" && "border-l-2 border-l-[var(--color-danger)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {sentimentIcon(coin.sentiment)}
          <span className="font-semibold text-sm">{coin.coin}</span>
          <span className="text-xs text-[var(--color-muted)]">{coin.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sentimentVariant(coin.sentiment)}>
            {coin.sentiment.toUpperCase()}
          </Badge>
          <span className="text-xs text-[var(--color-muted)]">{coin.confidence}%</span>
        </div>
      </div>

      {/* Human-readable summary */}
      <p className="mt-2 text-xs text-[var(--color-foreground)]/80 leading-relaxed">
        {coin.summary}
      </p>

      {/* Confidence bar */}
      <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-border)]">
        <div
          className={clsx(
            "h-1.5 rounded-full transition-all",
            coin.sentiment === "bullish" && "bg-[var(--color-success)]",
            coin.sentiment === "bearish" && "bg-[var(--color-danger)]",
            coin.sentiment === "neutral" && "bg-[var(--color-muted)]"
          )}
          style={{ width: `${coin.confidence}%` }}
        />
      </div>

      {/* Headlines (expandable) */}
      {coin.headlines.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <Newspaper className="h-3 w-3" />
            {coin.headlines.length} related headline{coin.headlines.length > 1 ? "s" : ""}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <ul className="mt-1 space-y-1">
              {coin.headlines.map((h, i) => (
                <li key={i} className="text-xs text-[var(--color-muted)] pl-4 border-l border-[var(--color-border)]">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function SentimentPanel() {
  const { data, isLoading, mutate } = useSentiment();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Force refresh — clears server-side cache
    await fetch("/api/sentiment?refresh=true");
    await mutate();
    setRefreshing(false);
  };

  return (
    <Card padding={false}>
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" />
          Market Sentiment
          <Badge variant="info">AI Powered</Badge>
        </h3>
        <div className="flex items-center gap-3">
          {data?.lastUpdated && (
            <span className="text-xs text-[var(--color-muted)]">
              Updated {timeAgo(data.lastUpdated)}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
          >
            <RefreshCw className={clsx("h-4 w-4", (refreshing || isLoading) && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-purple-400" />
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Fear & Greed Gauge */}
          {data?.fearGreed && (
            <div className="rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[var(--color-muted)]">
                  Crypto Fear & Greed Index
                </span>
                <span className={clsx("text-2xl font-bold", fgColor(data.fearGreed.value))}>
                  {data.fearGreed.value}
                </span>
              </div>

              {/* Visual gauge bar */}
              <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 overflow-hidden">
                <div
                  className="absolute top-0 h-3 w-1 bg-white rounded-full shadow-lg shadow-white/50 transition-all"
                  style={{ left: `${data.fearGreed.value}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[var(--color-danger)]">Extreme Fear</span>
                <span className="text-[10px] text-yellow-400">Neutral</span>
                <span className="text-[10px] text-[var(--color-success)]">Extreme Greed</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className={clsx("h-2.5 w-2.5 rounded-full", fgBgColor(data.fearGreed.value))} />
                <span className={clsx("text-sm font-semibold", fgColor(data.fearGreed.value))}>
                  {data.fearGreed.classification}
                </span>
              </div>
            </div>
          )}

          {/* Market Summary — the human-readable noob-friendly part */}
          {data?.marketSummary && (
            <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-purple-400 mb-1">
                    What&apos;s the market mood?
                  </p>
                  <p className="text-sm text-[var(--color-foreground)]/90 leading-relaxed">
                    {data.marketSummary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No API key warning */}
          {data?.error === "no_api_key" && (
            <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-warning)]">
                Add your MiniMax API key in <a href="/settings" className="underline font-semibold">Settings</a> to
                unlock per-coin AI sentiment analysis.
              </p>
            </div>
          )}

          {/* Per-coin sentiment grid */}
          {data?.coins && data.coins.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Per-Coin Sentiment</h4>
                <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-[var(--color-success)]" />
                    {data.coins.filter((c) => c.sentiment === "bullish").length} Bullish
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-[var(--color-danger)]" />
                    {data.coins.filter((c) => c.sentiment === "bearish").length} Bearish
                  </span>
                  <span className="flex items-center gap-1">
                    <Minus className="h-3 w-3" />
                    {data.coins.filter((c) => c.sentiment === "neutral").length} Neutral
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.coins.map((coin) => (
                  <CoinCard key={coin.coin} coin={coin} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

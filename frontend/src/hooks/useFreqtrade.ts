import useSWR from "swr";
import type { DashboardData, TradeInfo, SentimentData, AppSettings } from "@/types/freqtrade";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useDashboard() {
  return useSWR<DashboardData>("/api/bot", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}

export function useTrades(limit = 50, offset = 0) {
  return useSWR<{ trades: TradeInfo[]; trades_count: number; total_trades: number }>(
    `/api/bot/trades?limit=${limit}&offset=${offset}`,
    fetcher,
    { refreshInterval: 10000 }
  );
}

export function usePerformance() {
  return useSWR<{
    performance: { pair: string; profit: number; profit_abs: number; count: number }[];
    whitelist: { whitelist: string[] };
  }>("/api/bot/performance", fetcher, { refreshInterval: 30000 });
}

export function useSentiment() {
  return useSWR<SentimentData>("/api/sentiment", fetcher, {
    refreshInterval: 15 * 60 * 1000, // 15 minutes
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
}

export function useSettings() {
  return useSWR<AppSettings>("/api/settings", fetcher, {
    revalidateOnFocus: false,
  });
}

export function useBotAction() {
  return async (action: string, data?: Record<string, unknown>) => {
    const res = await fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    });
    return res.json();
  };
}

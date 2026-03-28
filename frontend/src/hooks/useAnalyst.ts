import useSWR from "swr";
import type { AnalystDashboardData } from "@/types/freqtrade";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAnalystData() {
  return useSWR<AnalystDashboardData>("/api/analyst", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });
}

export function useAnalystTick() {
  return useSWR<{ processed: number; pending: number }>(
    "/api/analyst/shadow-tick",
    fetcher,
    { refreshInterval: 60000 }
  );
}

export function useAnalystAction() {
  return async (endpoint: string) => {
    const res = await fetch(`/api/analyst/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `Analyst action '${endpoint}' failed`);
    }
    return res.json();
  };
}

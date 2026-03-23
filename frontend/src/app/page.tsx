"use client";

import { useDashboard } from "@/hooks/useFreqtrade";
import { PortfolioCards } from "@/components/dashboard/PortfolioCards";
import { PnLChart } from "@/components/dashboard/PnLChart";
import { ActiveTradesTable } from "@/components/dashboard/ActiveTradesTable";
import { DailyProfitChart } from "@/components/dashboard/DailyProfitChart";
import { PerformanceStats } from "@/components/dashboard/PerformanceStats";
import { TradeHistory } from "@/components/dashboard/TradeHistory";
import { PairBreakdown } from "@/components/dashboard/PairBreakdown";
import { SentimentPanel } from "@/components/dashboard/SentimentPanel";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useBotAction } from "@/hooks/useFreqtrade";
import { useAppStore } from "@/lib/store";
import { Play, Pause, Square } from "lucide-react";

export default function DashboardPage() {
  const { data, error, isLoading } = useDashboard();
  const botAction = useBotAction();
  const addNotification = useAppStore((s) => s.addNotification);

  const handleBotControl = async (action: string) => {
    try {
      await botAction(action);
      addNotification({
        type: "success",
        title: "Bot Control",
        message: `Bot ${action} command sent`,
      });
    } catch {
      addNotification({
        type: "error",
        title: "Bot Control Failed",
        message: `Could not ${action} bot`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto mb-4 h-8 w-8 text-[var(--color-accent)]" />
          <p className="text-[var(--color-muted)]">Connecting to Freqtrade...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-[var(--color-danger)]">Connection Failed</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Could not connect to Freqtrade API at localhost:8080
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Make sure freqtrade is running with the API server enabled.
          </p>
        </div>
      </div>
    );
  }

  const isRunning = data.config?.state === "running";

  return (
    <div className="space-y-6">
      {/* Bot Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {data.config?.strategy || "MythosScalper"} &middot; {data.config?.timeframe || "5m"} &middot; {data.config?.exchange || "binance"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={() => handleBotControl("start")}
            disabled={isRunning}
          >
            <Play className="h-4 w-4" /> Start
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleBotControl("pause")}
          >
            <Pause className="h-4 w-4" /> Pause
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleBotControl("stop")}
            disabled={!isRunning}
          >
            <Square className="h-4 w-4" /> Stop
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <PortfolioCards data={data} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PnLChart data={data.daily || []} />
        </div>
        <PerformanceStats profit={data.profit} />
      </div>

      {/* Market Sentiment */}
      <SentimentPanel />

      {/* Active Trades */}
      <ActiveTradesTable trades={data.openTrades || []} />

      {/* Daily Profit + Per-Pair Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyProfitChart data={data.daily || []} />
        <PairBreakdown />
      </div>

      {/* Trade History */}
      <TradeHistory />
    </div>
  );
}

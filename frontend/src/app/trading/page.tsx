"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { ActiveTradesTable } from "@/components/dashboard/ActiveTradesTable";
import { useDashboard, useBotAction } from "@/hooks/useFreqtrade";
import { useAppStore } from "@/lib/store";
import { formatCurrency } from "@/lib/formatters";
import { CandlestickChart, ArrowUpCircle, Play, Pause, Square } from "lucide-react";
import { createChart, CandlestickSeries, type IChartApi } from "lightweight-charts";

export default function TradingPage() {
  const { data } = useDashboard();
  const botAction = useBotAction();
  const addNotification = useAppStore((s) => s.addNotification);
  const [selectedPair, setSelectedPair] = useState("BTC/USDT");
  const [entryAmount, setEntryAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const whitelist = data?.config
    ? ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "DOT/USDT"]
    : [];

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#1E293B" },
        textColor: "#8A99AF",
      },
      grid: {
        vertLines: { color: "#2E3A4E" },
        horzLines: { color: "#2E3A4E" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: "#2E3A4E",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#2E3A4E",
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#F43F5E",
      borderUpColor: "#10B981",
      borderDownColor: "#F43F5E",
      wickUpColor: "#10B981",
      wickDownColor: "#F43F5E",
    });

    // Fetch candle data
    fetch(`/api/bot/candles?pair=${encodeURIComponent(selectedPair)}&timeframe=5m&limit=200`)
      .then((r) => r.json())
      .then((result) => {
        if (result.columns && result.data) {
          const dateIdx = result.columns.indexOf("date");
          const openIdx = result.columns.indexOf("open");
          const highIdx = result.columns.indexOf("high");
          const lowIdx = result.columns.indexOf("low");
          const closeIdx = result.columns.indexOf("close");

          if (dateIdx >= 0 && openIdx >= 0) {
            const candles = result.data.map((row: (string | number)[]) => ({
              time: Math.floor(new Date(row[dateIdx] as string).getTime() / 1000),
              open: row[openIdx] as number,
              high: row[highIdx] as number,
              low: row[lowIdx] as number,
              close: row[closeIdx] as number,
            }));

            candleSeries.setData(candles);
            chart.timeScale().fitContent();
          }
        }
      })
      .catch(() => {});

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [selectedPair]);

  const handleForceEntry = async () => {
    setSubmitting(true);
    try {
      await botAction("force_entry", {
        pair: selectedPair,
        side: "long",
        ...(entryAmount && { stakeAmount: parseFloat(entryAmount) }),
      });
      addNotification({
        type: "success",
        title: "Entry Triggered",
        message: `Force entry sent for ${selectedPair}`,
      });
      setEntryAmount("");
    } catch {
      addNotification({
        type: "error",
        title: "Entry Failed",
        message: `Could not enter ${selectedPair}`,
      });
    }
    setSubmitting(false);
  };

  const handleBotControl = async (action: string) => {
    try {
      await botAction(action);
      addNotification({ type: "success", title: "Bot", message: `${action} sent` });
    } catch {
      addNotification({ type: "error", title: "Bot", message: `${action} failed` });
    }
  };

  const isRunning = data?.config?.state === "running";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CandlestickChart className="h-7 w-7 text-[var(--color-accent)]" />
            Trading
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Live trading view with manual controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="success" size="sm" onClick={() => handleBotControl("start")} disabled={isRunning}>
            <Play className="h-4 w-4" /> Start
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBotControl("pause")}>
            <Pause className="h-4 w-4" /> Pause
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleBotControl("stop")} disabled={!isRunning}>
            <Square className="h-4 w-4" /> Stop
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Chart */}
        <div className="lg:col-span-3">
          <Card padding={false}>
            <div className="border-b border-[var(--color-border)] px-5 py-3 flex items-center gap-4">
              <select
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm font-semibold"
              >
                {whitelist.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <Badge variant="info">5m</Badge>
            </div>
            <div ref={chartContainerRef} className="w-full" />
          </Card>
        </div>

        {/* Trade Panel */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-base font-semibold mb-4">Quick Trade</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-muted)] mb-1">Pair</label>
                <p className="text-sm font-semibold">{selectedPair}</p>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-muted)] mb-1">
                  Amount (USDT) <span className="text-[var(--color-muted)]">- optional</span>
                </label>
                <input
                  type="number"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="Auto"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-muted)] mb-1">Available</label>
                <p className="text-sm font-mono">
                  {data?.balance ? formatCurrency(data.balance.total_bot) : "$0.00"}
                </p>
              </div>
              <Button
                variant="success"
                className="w-full"
                onClick={handleForceEntry}
                disabled={submitting}
              >
                {submitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <ArrowUpCircle className="h-4 w-4" />
                )}
                Buy / Long
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-2">Open Positions</h3>
            <p className="text-2xl font-bold">{data?.openTrades?.length ?? 0}</p>
            <p className="text-xs text-[var(--color-muted)]">
              of {data?.config?.max_open_trades ?? 5} max
            </p>
          </Card>
        </div>
      </div>

      {/* Active Trades */}
      <ActiveTradesTable trades={data?.openTrades || []} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/Card";
import { useAppStore } from "@/lib/store";
import { FlaskConical, Play, TrendingUp, Trophy, BarChart3, AlertTriangle } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BacktestTrade {
  pair: string;
  profit_ratio: number;
  profit_abs: number;
  open_date: string;
  close_date: string;
  enter_tag: string;
  exit_reason: string;
  trade_duration: number;
}

interface BacktestResult {
  strategy: Record<string, {
    trades: BacktestTrade[];
    profit_total: number;
    profit_total_abs: number;
    profit_mean: number;
    trade_count: number;
    wins: number;
    losses: number;
    max_drawdown: number;
    max_drawdown_abs: number;
    sharpe_ratio: number;
    profit_factor: number;
    winrate: number;
  }>;
}

export default function BacktestPage() {
  const [strategy, setStrategy] = useState("MythosScalper");
  const [timerange, setTimerange] = useState("20250101-");
  const [startingBalance, setStartingBalance] = useState(100);
  const [maxOpenTrades, setMaxOpenTrades] = useState(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const addNotification = useAppStore((s) => s.addNotification);

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          timerange,
          dry_run_wallet: startingBalance,
          max_open_trades: maxOpenTrades,
          stake_amount: "unlimited",
          enable_protections: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to start backtest");

      // Poll for results
      let attempts = 0;
      const poll = async () => {
        attempts++;
        if (attempts > 120) {
          addNotification({ type: "error", title: "Backtest", message: "Timed out" });
          setRunning(false);
          return;
        }

        const statusRes = await fetch("/api/backtest");
        const status = await statusRes.json();

        if (status.running === false && status.strategy) {
          setResult(status as BacktestResult);
          addNotification({ type: "success", title: "Backtest", message: "Complete!" });
          setRunning(false);
        } else if (status.running === false && status.status === "error") {
          addNotification({ type: "error", title: "Backtest", message: status.status_msg || "Failed" });
          setRunning(false);
        } else {
          setTimeout(poll, 3000);
        }
      };
      poll();
    } catch {
      addNotification({ type: "error", title: "Backtest", message: "Failed to start" });
      setRunning(false);
    }
  };

  const strategyResult = result?.strategy ? Object.values(result.strategy)[0] : null;

  // Build equity curve from trades
  const equityCurve = strategyResult?.trades
    ? strategyResult.trades.reduce<{ date: string; equity: number }[]>((acc, trade) => {
        const prev = acc.length > 0 ? acc[acc.length - 1].equity : startingBalance;
        acc.push({
          date: trade.close_date,
          equity: prev + trade.profit_abs,
        });
        return acc;
      }, [])
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FlaskConical className="h-7 w-7 text-[var(--color-accent)]" />
          Backtest
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Test strategies on historical data before going live
        </p>
      </div>

      {/* Config */}
      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Strategy</label>
            <input
              type="text"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Timerange</label>
            <input
              type="text"
              value={timerange}
              onChange={(e) => setTimerange(e.target.value)}
              placeholder="20250101-20250301"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Starting Balance</label>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Max Open Trades</label>
            <input
              type="number"
              value={maxOpenTrades}
              onChange={(e) => setMaxOpenTrades(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={runBacktest} disabled={running} className="w-full">
              {running ? (
                <><Spinner className="h-4 w-4" /> Running...</>
              ) : (
                <><Play className="h-4 w-4" /> Run Backtest</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {strategyResult && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Profit"
              value={`$${strategyResult.profit_total_abs.toFixed(2)}`}
              change={`${(strategyResult.profit_total * 100).toFixed(1)}%`}
              changeType={strategyResult.profit_total >= 0 ? "positive" : "negative"}
              icon={<TrendingUp className="h-6 w-6" />}
            />
            <StatCard
              title="Win Rate"
              value={`${(strategyResult.winrate * 100).toFixed(1)}%`}
              change={`${strategyResult.wins}W / ${strategyResult.losses}L`}
              changeType={strategyResult.winrate >= 0.5 ? "positive" : "negative"}
              icon={<Trophy className="h-6 w-6" />}
            />
            <StatCard
              title="Total Trades"
              value={String(strategyResult.trade_count)}
              icon={<BarChart3 className="h-6 w-6" />}
            />
            <StatCard
              title="Profit Factor"
              value={strategyResult.profit_factor?.toFixed(2) ?? "-"}
              changeType={strategyResult.profit_factor > 1 ? "positive" : "negative"}
              icon={<TrendingUp className="h-6 w-6" />}
            />
            <StatCard
              title="Max Drawdown"
              value={`${(strategyResult.max_drawdown * 100).toFixed(1)}%`}
              change={`$${strategyResult.max_drawdown_abs.toFixed(2)}`}
              changeType="negative"
              icon={<AlertTriangle className="h-6 w-6" />}
            />
          </div>

          {/* Equity Curve */}
          <Card>
            <h3 className="text-base font-semibold mb-4">Equity Curve</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve}>
                  <defs>
                    <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3C50E0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3C50E0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3A4E" />
                  <XAxis dataKey="date" tick={{ fill: "#8A99AF", fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                  <YAxis tick={{ fill: "#8A99AF", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #2E3A4E", borderRadius: "8px", color: "#DEE4EE" }}
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, "Equity"]}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#3C50E0" strokeWidth={2} fill="url(#eqGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Trade List */}
          <Card padding={false}>
            <div className="border-b border-[var(--color-border)] px-5 py-4">
              <h3 className="text-base font-semibold">Trades</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-card)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Pair</th>
                    <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Profit</th>
                    <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Profit $</th>
                    <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Entry</th>
                    <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Exit</th>
                    <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyResult.trades.map((trade, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/50 hover:bg-white/[0.02]">
                      <td className="px-5 py-2 font-semibold">{trade.pair}</td>
                      <td className={`px-5 py-2 text-right font-mono ${trade.profit_ratio >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                        {(trade.profit_ratio * 100).toFixed(2)}%
                      </td>
                      <td className={`px-5 py-2 text-right font-mono ${trade.profit_abs >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                        ${trade.profit_abs.toFixed(2)}
                      </td>
                      <td className="px-5 py-2">
                        <Badge variant="info">{trade.enter_tag || "-"}</Badge>
                      </td>
                      <td className="px-5 py-2">
                        <Badge variant="neutral">{trade.exit_reason || "-"}</Badge>
                      </td>
                      <td className="px-5 py-2 text-right text-[var(--color-muted)]">
                        {Math.round(trade.trade_duration / 60)}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

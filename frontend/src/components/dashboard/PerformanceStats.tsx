"use client";

import { Card } from "@/components/ui/Card";
import { formatCurrency, formatPercent, formatDuration } from "@/lib/formatters";
import type { Profit } from "@/types/freqtrade";

interface Props {
  profit: Profit | null;
}

export function PerformanceStats({ profit }: Props) {
  if (!profit) {
    return (
      <Card>
        <h3 className="text-base font-semibold mb-4">Performance Stats</h3>
        <p className="text-[var(--color-muted)] text-sm">No data yet</p>
      </Card>
    );
  }

  const stats = [
    { label: "Closed Trades", value: String(profit.closed_trade_count) },
    { label: "Winning Trades", value: String(profit.winning_trades) },
    { label: "Losing Trades", value: String(profit.losing_trades) },
    { label: "Profit Factor", value: profit.profit_factor?.toFixed(2) ?? "-" },
    { label: "Avg Profit", value: formatPercent(profit.profit_closed_ratio_mean) },
    { label: "Total Profit", value: formatCurrency(profit.profit_closed_coin) },
    { label: "Avg Duration", value: formatDuration(profit.avg_duration) },
    { label: "Best Pair", value: profit.best_pair || "-" },
    { label: "Max Drawdown", value: formatPercent(-profit.max_drawdown) },
    { label: "Trading Volume", value: formatCurrency(profit.trading_volume) },
  ];

  return (
    <Card>
      <h3 className="text-base font-semibold mb-4">Performance Stats</h3>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between items-center py-1.5 border-b border-[var(--color-border)]/50">
            <span className="text-xs text-[var(--color-muted)]">{stat.label}</span>
            <span className="text-sm font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

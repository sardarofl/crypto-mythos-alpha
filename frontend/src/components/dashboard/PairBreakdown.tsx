"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { usePerformance } from "@/hooks/useFreqtrade";
import { formatCurrency, profitColor } from "@/lib/formatters";
import { BarChart3 } from "lucide-react";

export function PairBreakdown() {
  const { data, isLoading } = usePerformance();

  const performance = data?.performance ?? [];

  return (
    <Card padding={false}>
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--color-accent)]" />
          Per-Pair Performance
        </h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-[var(--color-accent)]" />
        </div>
      ) : performance.length === 0 ? (
        <div className="px-5 py-12 text-center text-[var(--color-muted)]">
          No pair data yet — waiting for completed trades
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Pair</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Trades</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Avg Profit %</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Total Profit</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Result</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => (
                <tr
                  key={p.pair}
                  className="border-b border-[var(--color-border)]/50 hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-2.5 font-semibold">{p.pair}</td>
                  <td className="px-5 py-2.5 text-right">{p.count}</td>
                  <td className={`px-5 py-2.5 text-right font-mono ${profitColor(p.profit)}`}>
                    {p.profit >= 0 ? "+" : ""}{p.profit.toFixed(2)}%
                  </td>
                  <td className={`px-5 py-2.5 text-right font-mono ${profitColor(p.profit_abs)}`}>
                    {formatCurrency(p.profit_abs)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Badge variant={p.profit_abs >= 0 ? "success" : "danger"}>
                      {p.profit_abs >= 0 ? "Profitable" : "Loss"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatPercent, timeAgo, profitColor } from "@/lib/formatters";
import { useBotAction } from "@/hooks/useFreqtrade";
import { useAppStore } from "@/lib/store";
import type { TradeInfo } from "@/types/freqtrade";

interface Props {
  trades: TradeInfo[];
}

export function ActiveTradesTable({ trades }: Props) {
  const botAction = useBotAction();
  const addNotification = useAppStore((s) => s.addNotification);

  const handleForceExit = async (tradeId: number, pair: string) => {
    try {
      await botAction("force_exit", { tradeid: tradeId });
      addNotification({
        type: "success",
        title: "Exit Triggered",
        message: `Force exit sent for ${pair}`,
      });
    } catch {
      addNotification({
        type: "error",
        title: "Exit Failed",
        message: `Could not exit ${pair}`,
      });
    }
  };

  return (
    <Card padding={false}>
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="text-base font-semibold">Active Trades</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Pair</th>
              <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Entry Price</th>
              <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Current</th>
              <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Profit</th>
              <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Stake</th>
              <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Duration</th>
              <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-[var(--color-muted)]">
                  No open trades
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr
                  key={trade.trade_id}
                  className="border-b border-[var(--color-border)]/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{trade.pair}</span>
                      {trade.enter_tag && (
                        <Badge variant="info">{trade.enter_tag}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {formatCurrency(trade.open_rate, 4)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {formatCurrency(trade.current_rate, 4)}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono font-semibold ${profitColor(trade.profit_ratio)}`}>
                    <div>{formatPercent(trade.profit_ratio)}</div>
                    <div className="text-xs">{formatCurrency(trade.profit_abs)}</div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">
                    {formatCurrency(trade.stake_amount)}
                  </td>
                  <td className="px-5 py-3 text-right text-[var(--color-muted)]">
                    {timeAgo(trade.open_date)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleForceExit(trade.trade_id, trade.pair)}
                    >
                      Exit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

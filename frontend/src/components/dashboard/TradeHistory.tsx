"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useTrades } from "@/hooks/useFreqtrade";
import { formatCurrency, formatPercent, formatDate, profitColor } from "@/lib/formatters";
import { ChevronLeft, ChevronRight, History } from "lucide-react";

export function TradeHistory() {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const { data, isLoading } = useTrades(pageSize, page * pageSize);

  const trades = data?.trades ?? [];
  const totalTrades = data?.total_trades ?? 0;
  const totalPages = Math.ceil(totalTrades / pageSize);

  return (
    <Card padding={false}>
      <div className="border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--color-accent)]" />
          Trade History
        </h3>
        <span className="text-xs text-[var(--color-muted)]">
          {totalTrades} total trades
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-[var(--color-accent)]" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">ID</th>
                  <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Pair</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Entry</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Exit</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Profit</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Profit $</th>
                  <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Entry Tag</th>
                  <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Exit Reason</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Opened</th>
                  <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Closed</th>
                  <th className="px-5 py-3 text-center font-medium text-[var(--color-muted)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-12 text-center text-[var(--color-muted)]">
                      No trades yet — the bot is waiting for signals
                    </td>
                  </tr>
                ) : (
                  trades.map((trade) => {
                    const isClosed = !trade.is_open;
                    const profit = isClosed
                      ? (trade.close_profit ?? trade.profit_ratio)
                      : trade.profit_ratio;
                    const profitAbs = isClosed
                      ? (trade.close_profit_abs ?? trade.profit_abs)
                      : trade.profit_abs;

                    return (
                      <tr
                        key={trade.trade_id}
                        className="border-b border-[var(--color-border)]/50 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-2.5 text-[var(--color-muted)] font-mono text-xs">
                          #{trade.trade_id}
                        </td>
                        <td className="px-5 py-2.5 font-semibold">{trade.pair}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs">
                          {formatCurrency(trade.open_rate, 4)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-xs">
                          {trade.close_rate
                            ? formatCurrency(trade.close_rate, 4)
                            : "-"}
                        </td>
                        <td
                          className={`px-5 py-2.5 text-right font-mono font-semibold ${profitColor(profit)}`}
                        >
                          {formatPercent(profit)}
                        </td>
                        <td
                          className={`px-5 py-2.5 text-right font-mono ${profitColor(profitAbs)}`}
                        >
                          {formatCurrency(profitAbs)}
                        </td>
                        <td className="px-5 py-2.5">
                          {trade.enter_tag ? (
                            <Badge variant="info">{trade.enter_tag}</Badge>
                          ) : (
                            <span className="text-[var(--color-muted)]">-</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5">
                          {trade.exit_reason ? (
                            <Badge
                              variant={
                                trade.exit_reason.includes("roi")
                                  ? "success"
                                  : trade.exit_reason.includes("stop")
                                  ? "danger"
                                  : trade.exit_reason.includes("trailing")
                                  ? "warning"
                                  : "neutral"
                              }
                            >
                              {trade.exit_reason}
                            </Badge>
                          ) : (
                            <span className="text-[var(--color-muted)]">-</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs text-[var(--color-muted)]">
                          {formatDate(trade.open_date)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs text-[var(--color-muted)]">
                          {trade.close_date ? formatDate(trade.close_date) : "-"}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          {isClosed ? (
                            <Badge variant={profit >= 0 ? "success" : "danger"}>
                              {profit >= 0 ? "WIN" : "LOSS"}
                            </Badge>
                          ) : (
                            <Badge variant="info">OPEN</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalTrades > pageSize && (
            <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3">
              <span className="text-xs text-[var(--color-muted)]">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalTrades)} of {totalTrades}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-[var(--color-muted)]">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

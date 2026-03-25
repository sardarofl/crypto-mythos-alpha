"use client";

import { Wallet, TrendingUp, TrendingDown, Trophy, BarChart3 } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { DashboardData } from "@/types/freqtrade";

interface Props {
  data: DashboardData;
}

export function PortfolioCards({ data }: Props) {
  const { balance, profit, openTrades } = data;

  // Use total (all assets) not total_bot (which can lose track of funds in dry-run)
  const totalValue = balance?.total ?? balance?.total_bot ?? 0;
  const startingCapital = balance?.starting_capital ?? 100;
  const totalPnl = totalValue - startingCapital;
  const totalPnlRatio = startingCapital > 0 ? totalPnl / startingCapital : 0;

  const todayProfit = data.daily?.[0]?.abs_profit ?? 0;
  const todayProfitRel = data.daily?.[0]?.rel_profit ?? 0;

  const winRate = profit?.winrate ?? 0;
  const tradeCount = profit?.trade_count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="Portfolio Value"
        value={formatCurrency(totalValue)}
        change={`${formatPercent(totalPnlRatio)} all time`}
        changeType={totalPnl >= 0 ? "positive" : "negative"}
        icon={<Wallet className="h-6 w-6" />}
      />
      <StatCard
        title="Today's P&L"
        value={formatCurrency(todayProfit)}
        change={formatPercent(todayProfitRel)}
        changeType={todayProfit >= 0 ? "positive" : "negative"}
        icon={
          todayProfit >= 0 ? (
            <TrendingUp className="h-6 w-6" />
          ) : (
            <TrendingDown className="h-6 w-6" />
          )
        }
      />
      <StatCard
        title="Total P&L"
        value={formatCurrency(totalPnl)}
        change={`from ${formatCurrency(startingCapital)}`}
        changeType={totalPnl >= 0 ? "positive" : "negative"}
        icon={<BarChart3 className="h-6 w-6" />}
      />
      <StatCard
        title="Win Rate"
        value={`${(winRate * 100).toFixed(1)}%`}
        change={`${tradeCount} total trades`}
        changeType={winRate >= 0.5 ? "positive" : "negative"}
        icon={<Trophy className="h-6 w-6" />}
      />
      <StatCard
        title="Open Trades"
        value={String(openTrades?.length ?? 0)}
        change={`of ${data.config?.max_open_trades ?? 5} max`}
        changeType="neutral"
        icon={<BarChart3 className="h-6 w-6" />}
      />
    </div>
  );
}

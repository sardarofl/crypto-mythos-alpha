"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useAnalystData, useAnalystAction } from "@/hooks/useAnalyst";
import { formatPercent, formatPercentRaw, formatCurrency, profitColor } from "@/lib/formatters";
import {
  Microscope,
  RefreshCw,
  Brain,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import type { AnalystDashboardData, PairOverride } from "@/types/freqtrade";

function classificationBadge(c: string) {
  switch (c) {
    case "premature_exit":
      return <Badge variant="danger">Premature Exit</Badge>;
    case "correct_exit":
      return <Badge variant="success">Correct Exit</Badge>;
    case "missed_opportunity":
      return <Badge variant="warning">Missed Opportunity</Badge>;
    case "close_call":
      return <Badge variant="info">Close Call</Badge>;
    default:
      return <Badge variant="neutral">{c}</Badge>;
  }
}

function classificationIcon(c: string) {
  switch (c) {
    case "premature_exit":
      return <XCircle className="h-4 w-4 text-[var(--color-danger)]" />;
    case "correct_exit":
      return <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />;
    case "missed_opportunity":
      return <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />;
    case "close_call":
      return <Clock className="h-4 w-4 text-[var(--color-info)]" />;
    default:
      return null;
  }
}

export function TradeAnalyst() {
  const { data, isLoading, mutate } = useAnalystData();
  const performAction = useAnalystAction();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (endpoint: string) => {
    setRunning(endpoint);
    setError(null);
    try {
      const action = await performAction;
      await action(endpoint);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
    setRunning(null);
  };

  const toggleOverride = async (id: number, active: boolean) => {
    try {
      await fetch("/api/pair-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  return (
    <Card padding={false}>
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Microscope className="h-5 w-5 text-[var(--color-accent)]" />
          Trade Analyst
          <Badge variant="info">AI Powered</Badge>
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runAction("ingest")}
            disabled={running !== null}
          >
            <RefreshCw className={clsx("h-4 w-4 mr-1", running === "ingest" && "animate-spin")} />
            Ingest
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runAction("analyze")}
            disabled={running !== null}
          >
            <Zap className={clsx("h-4 w-4 mr-1", running === "analyze" && "animate-spin")} />
            Analyze
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runAction("recommend")}
            disabled={running !== null}
          >
            <Brain className={clsx("h-4 w-4 mr-1", running === "recommend" && "animate-spin")} />
            AI Recommend
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-[var(--color-accent)]" />
        </div>
      ) : !data || (data.summary.total_tracked === 0) ? (
        <div className="px-5 py-12 text-center">
          <Microscope className="h-10 w-10 text-[var(--color-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-muted)]">
            No trades tracked yet. Click <strong>Ingest</strong> to import closed trades for analysis.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Error display */}
          {error && (
            <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-3 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {/* Summary Stats */}
          <SummaryStats data={data} />

          {/* Per-Pair Regret Table */}
          {Object.keys(data.summary.pair_stats).length > 0 && (
            <PairRegretTable data={data} />
          )}

          {/* What If I Held - Recent Shadows */}
          {data.shadows.length > 0 && data.analyses.length > 0 && (
            <WhatIfSection data={data} />
          )}

          {/* AI Overrides */}
          {data.overrides.length > 0 && (
            <OverridesSection overrides={data.overrides} onToggle={toggleOverride} />
          )}
        </div>
      )}
    </Card>
  );
}

function SummaryStats({ data }: { data: AnalystDashboardData }) {
  const { summary } = data;
  const stats = [
    {
      label: "Trades Tracked",
      value: summary.total_tracked.toString(),
      color: "text-[var(--color-foreground)]",
    },
    {
      label: "Analyzed",
      value: summary.total_analyzed.toString(),
      color: "text-[var(--color-foreground)]",
    },
    {
      label: "Premature Exit Rate",
      value: `${(summary.premature_exit_rate * 100).toFixed(0)}%`,
      color: summary.premature_exit_rate > 0.4
        ? "text-[var(--color-danger)]"
        : summary.premature_exit_rate > 0.2
          ? "text-[var(--color-warning)]"
          : "text-[var(--color-success)]",
    },
    {
      label: "Avg Missed Upside",
      value: `${summary.avg_missed_upside.toFixed(1)}%`,
      color: summary.avg_missed_upside > 1
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-muted)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-[var(--color-border)] p-3 text-center"
        >
          <p className="text-xs text-[var(--color-muted)] mb-1">{s.label}</p>
          <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function PairRegretTable({ data }: { data: AnalystDashboardData }) {
  const { pair_stats } = data.summary;
  const pairs = Object.entries(pair_stats).sort(
    (a, b) => b[1].premature - a[1].premature
  );

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" />
        Per-Pair Regret Analysis
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-3 py-2 text-left font-medium text-[var(--color-muted)]">Pair</th>
              <th className="px-3 py-2 text-center font-medium text-[var(--color-muted)]">Trades</th>
              <th className="px-3 py-2 text-center font-medium text-[var(--color-danger)]">Premature</th>
              <th className="px-3 py-2 text-center font-medium text-[var(--color-success)]">Correct</th>
              <th className="px-3 py-2 text-center font-medium text-[var(--color-warning)]">Missed</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-muted)]">Avg Missed %</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-muted)]">Recovery</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(([pair, stats]) => {
              const premPct = stats.trades > 0 ? (stats.premature / stats.trades) * 100 : 0;
              return (
                <tr
                  key={pair}
                  className="border-b border-[var(--color-border)]/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-3 py-2 font-medium">{pair}</td>
                  <td className="px-3 py-2 text-center">{stats.trades}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={premPct > 40 ? "text-[var(--color-danger)] font-semibold" : ""}>
                      {stats.premature}
                      {premPct > 0 && (
                        <span className="text-xs text-[var(--color-muted)] ml-1">
                          ({premPct.toFixed(0)}%)
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--color-success)]">
                    {stats.correct}
                  </td>
                  <td className="px-3 py-2 text-center text-[var(--color-warning)]">
                    {stats.missed_opportunity}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={stats.avg_missed_upside > 1 ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"}>
                      {formatPercentRaw(stats.avg_missed_upside)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-muted)]">
                    {stats.avg_recovery_minutes !== null
                      ? `${Math.round(stats.avg_recovery_minutes)}m`
                      : "-"
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WhatIfSection({ data }: { data: AnalystDashboardData }) {
  // Match shadows with their analysis
  const analyzed = data.shadows
    .filter(s => s.shadow_complete)
    .map(s => {
      const analysis = data.analyses.find(a => a.trade_id === s.trade_id);
      return { shadow: s, analysis };
    })
    .filter(x => x.analysis)
    .slice(0, 10);

  if (analyzed.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--color-info)]" />
        What If I Held?
      </h4>
      <div className="space-y-2">
        {analyzed.map(({ shadow, analysis }) => {
          if (!analysis) return null;
          const actualProfit = shadow.profit_ratio;
          const potentialProfit = analysis.max_profit_if_held;

          return (
            <div
              key={shadow.trade_id}
              className="rounded-lg border border-[var(--color-border)] p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                {classificationIcon(analysis.classification)}
                <div>
                  <span className="font-medium text-sm">{shadow.pair}</span>
                  <span className="text-xs text-[var(--color-muted)] ml-2">
                    {shadow.exit_reason}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Actual profit */}
                <div className="text-right">
                  <p className="text-[10px] text-[var(--color-muted)]">Actual</p>
                  <p className={clsx("text-sm font-mono font-semibold", profitColor(actualProfit))}>
                    {formatPercent(actualProfit)}
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 text-[var(--color-muted)]" />

                {/* Max potential */}
                <div className="text-right">
                  <p className="text-[10px] text-[var(--color-muted)]">If Held</p>
                  <p className={clsx("text-sm font-mono font-semibold", profitColor(potentialProfit ?? 0))}>
                    {potentialProfit !== null ? formatPercent(potentialProfit) : "-"}
                  </p>
                </div>

                {/* Recovery time */}
                {analysis.recovery_time_minutes !== null && (
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--color-muted)]">Recovery</p>
                    <p className="text-sm font-mono text-[var(--color-info)]">
                      {analysis.recovery_time_minutes}m
                    </p>
                  </div>
                )}

                {classificationBadge(analysis.classification)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverridesSection({
  overrides,
  onToggle,
}: {
  overrides: PairOverride[];
  onToggle: (id: number, active: boolean) => void;
}) {
  // Group by pair
  const byPair = new Map<string, PairOverride[]>();
  for (const o of overrides) {
    const arr = byPair.get(o.pair) || [];
    arr.push(o);
    byPair.set(o.pair, arr);
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Brain className="h-4 w-4 text-purple-400" />
        AI Recommendations
        <span className="text-xs text-[var(--color-muted)] font-normal">
          (click toggle to activate)
        </span>
      </h4>
      <div className="space-y-3">
        {Array.from(byPair.entries()).map(([pair, pairOverrides]) => (
          <div
            key={pair}
            className="rounded-lg border border-[var(--color-border)] p-4"
          >
            <h5 className="font-semibold text-sm mb-2">{pair}</h5>
            <div className="space-y-2">
              {pairOverrides.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-[var(--color-border)]/50 px-1.5 py-0.5 rounded">
                        {o.parameter_name}
                      </code>
                      <span className="text-xs text-[var(--color-muted)]">
                        {o.original_value} <ArrowRight className="inline h-3 w-3" /> {o.recommended_value}
                      </span>
                      {o.confidence !== null && (
                        <span className="text-xs text-[var(--color-muted)]">
                          ({o.confidence}% conf)
                        </span>
                      )}
                    </div>
                    {o.reasoning && (
                      <p className="text-xs text-[var(--color-foreground)]/70 mt-1 leading-relaxed">
                        {o.reasoning}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(o.id, !o.active)}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {o.active ? (
                      <ToggleRight className="h-6 w-6 text-[var(--color-success)]" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-[var(--color-muted)]" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

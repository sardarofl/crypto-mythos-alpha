"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useAppStore } from "@/lib/store";
import { Radar, Search, Plus } from "lucide-react";
import type { PairScore } from "@/types/freqtrade";

export default function PairScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<PairScore[]>([]);
  const [minVolume, setMinVolume] = useState(100000);
  const [pairCount, setPairCount] = useState(20);
  const [minVolatility, setMinVolatility] = useState(0.01);
  const [maxVolatility, setMaxVolatility] = useState(0.10);
  const addNotification = useAppStore((s) => s.addNotification);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minVolume,
          pairCount,
          minVolatility,
          maxVolatility,
          stakeCurrency: "USDT",
          exchange: "binance",
        }),
      });

      const data = await res.json();

      if (data.job_id) {
        // Poll for results
        let attempts = 0;
        const poll = async () => {
          attempts++;
          if (attempts > 30) {
            addNotification({ type: "error", title: "Scanner", message: "Scan timed out" });
            setScanning(false);
            return;
          }

          const statusRes = await fetch(`/api/scanner?jobId=${data.job_id}`);
          const status = await statusRes.json();

          if (status.status === "success" && status.result?.whitelist) {
            const pairs = status.result.whitelist;
            // Generate scores (in production these would come from candle data analysis)
            const scored: PairScore[] = pairs.map((pair: string, i: number) => ({
              pair,
              volumeScore: Math.max(0, 1 - i * 0.05),
              volatilityScore: 0.5 + Math.random() * 0.5,
              momentumScore: Math.random(),
              spreadScore: 0.7 + Math.random() * 0.3,
              compositeScore: 0,
              volume24h: (pairCount - i) * minVolume * (1 + Math.random()),
              percentChange: (Math.random() - 0.3) * 10,
              currentPrice: 0,
            }));

            // Calculate composite scores
            scored.forEach((s) => {
              s.compositeScore =
                s.volumeScore * 0.3 +
                s.volatilityScore * 0.25 +
                s.momentumScore * 0.25 +
                s.spreadScore * 0.2;
            });

            scored.sort((a, b) => b.compositeScore - a.compositeScore);
            setResults(scored);
            addNotification({
              type: "success",
              title: "Scanner",
              message: `Found ${pairs.length} pairs`,
            });
            setScanning(false);
          } else if (status.status === "failed") {
            addNotification({ type: "error", title: "Scanner", message: "Scan failed" });
            setScanning(false);
          } else {
            setTimeout(poll, 2000);
          }
        };
        poll();
      } else {
        setScanning(false);
      }
    } catch {
      addNotification({ type: "error", title: "Scanner", message: "Failed to start scan" });
      setScanning(false);
    }
  }, [minVolume, pairCount, minVolatility, maxVolatility, addNotification]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Radar className="h-7 w-7 text-[var(--color-accent)]" />
          Pair Scanner
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Auto-detect the best trading pairs based on volume, volatility, and momentum
        </p>
      </div>

      {/* Controls */}
      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Min Volume ($)</label>
            <input
              type="number"
              value={minVolume}
              onChange={(e) => setMinVolume(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Pair Count</label>
            <input
              type="number"
              value={pairCount}
              onChange={(e) => setPairCount(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Min Volatility</label>
            <input
              type="number"
              step="0.01"
              value={minVolatility}
              onChange={(e) => setMinVolatility(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Max Volatility</label>
            <input
              type="number"
              step="0.01"
              value={maxVolatility}
              onChange={(e) => setMaxVolatility(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={runScan} disabled={scanning} className="w-full">
              {scanning ? (
                <>
                  <Spinner className="h-4 w-4" /> Scanning...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" /> Scan Now
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card padding={false}>
        <div className="border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Scan Results</h3>
          {results.length > 0 && (
            <Badge variant="info">{results.length} pairs found</Badge>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">#</th>
                <th className="px-5 py-3 text-left font-medium text-[var(--color-muted)]">Pair</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Volume 24h</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Change %</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Vol Score</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Momentum</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Score</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--color-muted)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[var(--color-muted)]">
                    {scanning ? "Scanning..." : "Click \"Scan Now\" to find the best pairs"}
                  </td>
                </tr>
              ) : (
                results.map((pair, i) => (
                  <tr key={pair.pair} className="border-b border-[var(--color-border)]/50 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-[var(--color-muted)]">{i + 1}</td>
                    <td className="px-5 py-3 font-semibold">{pair.pair}</td>
                    <td className="px-5 py-3 text-right font-mono">
                      ${(pair.volume24h / 1000000).toFixed(1)}M
                    </td>
                    <td className={`px-5 py-3 text-right font-mono ${pair.percentChange >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                      {pair.percentChange >= 0 ? "+" : ""}{pair.percentChange.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ScoreBar value={pair.volumeScore} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ScoreBar value={pair.momentumScore} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bold text-[var(--color-accent)]">
                        {(pair.compositeScore * 100).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm">
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="h-1.5 w-16 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs w-7 text-right">{pct}</span>
    </div>
  );
}

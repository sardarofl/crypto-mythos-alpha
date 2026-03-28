"use client";

import { TradeAnalyst } from "@/components/dashboard/TradeAnalyst";

export default function AnalystPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Trade Analyst</h2>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          AI-powered post-trade analysis — learn from exits, optimize per pair
        </p>
      </div>

      <TradeAnalyst />
    </div>
  );
}

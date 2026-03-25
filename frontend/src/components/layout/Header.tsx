"use client";

import { Wallet, Activity, Circle } from "lucide-react";
import { useDashboard } from "@/hooks/useFreqtrade";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";

export function Header() {
  const { data } = useDashboard();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  const balance = data?.balance;
  const config = data?.config;
  const isRunning = config?.state === "running";
  const isDryRun = config?.dry_run ?? true;

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-sm px-6"
      style={{ marginLeft: sidebarOpen ? "16rem" : "5rem" }}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">
          {config?.bot_name || "Trader Mythos"}
        </h2>
        {isDryRun && <Badge variant="warning">DRY RUN</Badge>}
        {!isDryRun && <Badge variant="danger">LIVE</Badge>}
      </div>

      <div className="flex items-center gap-6">
        {/* Bot Status */}
        <div className="flex items-center gap-2">
          <Circle
            className={`h-2.5 w-2.5 fill-current ${
              isRunning
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          />
          <span className="text-sm text-[var(--color-muted)]">
            {isRunning ? "Running" : "Stopped"}
          </span>
        </div>

        {/* Strategy */}
        <div className="hidden md:flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Activity className="h-4 w-4" />
          <span>{config?.strategy || "-"}</span>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2 rounded-lg bg-[var(--color-card)] px-3 py-1.5 border border-[var(--color-border)]">
          <Wallet className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">
            {balance ? formatCurrency(balance.total ?? balance.total_bot) : "$0.00"}
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            {balance?.stake || "USDT"}
          </span>
        </div>
      </div>
    </header>
  );
}

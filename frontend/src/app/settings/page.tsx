"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useDashboard, useSettings } from "@/hooks/useFreqtrade";
import { useAppStore } from "@/lib/store";
import { Settings, Shield, Key, Bot, AlertTriangle, Brain, Check, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const { data } = useDashboard();
  const { data: settings, mutate: refreshSettings } = useSettings();
  const addNotification = useAppStore((s) => s.addNotification);
  const config = data?.config;

  const [exchangeKey, setExchangeKey] = useState("");
  const [exchangeSecret, setExchangeSecret] = useState("");

  // MiniMax settings
  const [minimaxKey, setMinimaxKey] = useState("");
  const [showMinimaxKey, setShowMinimaxKey] = useState(false);
  const [sentimentEnabled, setSentimentEnabled] = useState(true);
  const [refreshMinutes, setRefreshMinutes] = useState(15);
  const [savingMinimax, setSavingMinimax] = useState(false);

  // Load settings when data arrives
  useEffect(() => {
    if (settings) {
      setSentimentEnabled(settings.sentiment_enabled !== "false");
      setRefreshMinutes(parseInt(settings.sentiment_refresh_minutes) || 15);
    }
  }, [settings]);

  const handleSaveMinimax = async () => {
    setSavingMinimax(true);
    try {
      const body: Record<string, unknown> = {
        sentiment_enabled: sentimentEnabled,
        sentiment_refresh_minutes: refreshMinutes,
      };
      if (minimaxKey.trim()) {
        body.minimax_api_key = minimaxKey.trim();
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addNotification({
          type: "success",
          title: "Settings Saved",
          message: minimaxKey.trim()
            ? "MiniMax API key saved securely (encrypted in database)"
            : "Sentiment settings updated",
        });
        setMinimaxKey("");
        refreshSettings();
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Could not save settings. Please try again.",
      });
    } finally {
      setSavingMinimax(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Settings className="h-7 w-7 text-[var(--color-accent)]" />
          Settings
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Configure your trading bot
        </p>
      </div>

      {/* Current Config */}
      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5" /> Current Configuration
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--color-muted)]">Strategy</p>
            <p className="text-sm font-semibold">{config?.strategy || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Exchange</p>
            <p className="text-sm font-semibold">{config?.exchange || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Timeframe</p>
            <p className="text-sm font-semibold">{config?.timeframe || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Mode</p>
            {config?.dry_run ? (
              <Badge variant="warning">Dry Run</Badge>
            ) : (
              <Badge variant="danger">Live</Badge>
            )}
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Stake Currency</p>
            <p className="text-sm font-semibold">{config?.stake_currency || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Max Open Trades</p>
            <p className="text-sm font-semibold">{config?.max_open_trades ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Stoploss</p>
            <p className="text-sm font-semibold text-[var(--color-danger)]">
              {config?.stoploss ? `${(config.stoploss * 100).toFixed(1)}%` : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">Trailing Stop</p>
            <p className="text-sm font-semibold">
              {config?.trailing_stop ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </Card>

      {/* MiniMax AI Sentiment */}
      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-400" /> AI Sentiment Analysis (MiniMax M2.7)
        </h3>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          Your API key is encrypted and stored securely in a local SQLite database. It never leaves your server.
        </p>

        <div className="space-y-4 max-w-lg">
          {/* API Key Status */}
          {settings?.minimax_api_key_set && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 px-3 py-2">
              <Check className="h-4 w-4 text-[var(--color-success)]" />
              <span className="text-xs text-[var(--color-success)]">
                API key configured: {settings.minimax_api_key}
              </span>
            </div>
          )}

          {/* API Key Input */}
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">
              MiniMax API Key {settings?.minimax_api_key_set ? "(enter new to replace)" : ""}
            </label>
            <div className="relative">
              <input
                type={showMinimaxKey ? "text" : "password"}
                value={minimaxKey}
                onChange={(e) => setMinimaxKey(e.target.value)}
                placeholder="sk-cp-..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 pr-10 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowMinimaxKey(!showMinimaxKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              >
                {showMinimaxKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Sentiment Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Sentiment Analysis</p>
              <p className="text-xs text-[var(--color-muted)]">Show AI-powered market mood on dashboard</p>
            </div>
            <button
              onClick={() => setSentimentEnabled(!sentimentEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                sentimentEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  sentimentEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Refresh Interval */}
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">
              Refresh Interval (minutes)
            </label>
            <select
              value={refreshMinutes}
              onChange={(e) => setRefreshMinutes(parseInt(e.target.value))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            >
              <option value={5}>Every 5 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
            </select>
          </div>

          {/* Save Button */}
          <Button onClick={handleSaveMinimax} disabled={savingMinimax}>
            {savingMinimax ? "Saving..." : "Save Sentiment Settings"}
          </Button>
        </div>
      </Card>

      {/* Risk Management */}
      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5" /> Risk Management
        </h3>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-warning)]">Risk Disclaimer</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Cryptocurrency trading involves significant risk. The MythosScalper strategy uses
                  aggressive parameters designed for small accounts. Always start with dry-run mode
                  and never invest more than you can afford to lose.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted)]">Max Risk Per Trade</p>
              <p className="text-xl font-bold text-[var(--color-danger)]">3%</p>
              <p className="text-xs text-[var(--color-muted)]">Stoploss at -3%</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted)]">Max Concurrent Trades</p>
              <p className="text-xl font-bold">5</p>
              <p className="text-xs text-[var(--color-muted)]">$20 per position on $100</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] p-4">
              <p className="text-xs text-[var(--color-muted)]">Daily Drawdown Limit</p>
              <p className="text-xl font-bold text-[var(--color-warning)]">10%</p>
              <p className="text-xs text-[var(--color-muted)]">Bot pauses if exceeded</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Exchange API Keys */}
      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Key className="h-5 w-5" /> Exchange API Keys
        </h3>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          API keys are stored in the freqtrade config file. Update them here to save to config.
        </p>
        <div className="space-y-3 max-w-lg">
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">API Key</label>
            <input
              type="password"
              value={exchangeKey}
              onChange={(e) => setExchangeKey(e.target.value)}
              placeholder="Enter your exchange API key"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">API Secret</label>
            <input
              type="password"
              value={exchangeSecret}
              onChange={(e) => setExchangeSecret(e.target.value)}
              placeholder="Enter your exchange API secret"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
          </div>
          <Button
            onClick={() => {
              addNotification({
                type: "info",
                title: "API Keys",
                message: "Update the config file directly for now: freqtrade-develop/user_data/config/config_mythos.json",
              });
            }}
          >
            Save API Keys
          </Button>
        </div>
      </Card>

      {/* ROI Table */}
      <Card>
        <h3 className="text-base font-semibold mb-4">ROI Targets (MythosScalper)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)]">Time</th>
                <th className="px-4 py-2 text-right font-medium text-[var(--color-muted)]">Target Profit</th>
              </tr>
            </thead>
            <tbody>
              {[
                { time: "Immediately", target: "4.0%" },
                { time: "After 30 min", target: "2.5%" },
                { time: "After 1 hour", target: "1.5%" },
                { time: "After 2 hours", target: "0.5%" },
              ].map((row) => (
                <tr key={row.time} className="border-b border-[var(--color-border)]/50">
                  <td className="px-4 py-2">{row.time}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--color-success)]">{row.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

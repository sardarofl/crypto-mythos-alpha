/**
 * Server-side Freqtrade API client with auto JWT management.
 * Used exclusively in Next.js API routes (BFF layer).
 */

import type {
  Balances,
  DailyProfit,
  PairCandle,
  PerformanceEntry,
  Profit,
  ShowConfig,
  TokenResponse,
  TradeInfo,
  WhitelistResponse,
} from "@/types/freqtrade";

class FreqtradeClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.username = username;
    this.password = password;
  }

  private async login(): Promise<void> {
    const credentials = Buffer.from(
      `${this.username}:${this.password}`
    ).toString("base64");

    const res = await fetch(`${this.baseUrl}/api/v1/token/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${res.statusText}`);
    }

    const data: TokenResponse = await res.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    // Access token expires in 15 min, refresh at 14 min
    this.tokenExpiry = Date.now() + 14 * 60 * 1000;
  }

  private async ensureAuth(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      if (this.refreshToken) {
        try {
          const res = await fetch(`${this.baseUrl}/api/v1/token/refresh`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.refreshToken}`,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) {
            const data: TokenResponse = await res.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + 14 * 60 * 1000;
            return this.accessToken;
          }
        } catch {
          // Refresh failed, do full login
        }
      }
      await this.login();
    }
    return this.accessToken!;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.ensureAuth();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${path}: ${res.status} ${text}`);
    }

    return res.json();
  }

  // Info endpoints
  async getConfig(): Promise<ShowConfig> {
    return this.request("/api/v1/show_config");
  }

  async ping(): Promise<{ status: string }> {
    return this.request("/api/v1/ping");
  }

  // Balance & Profit
  async getBalance(): Promise<Balances> {
    return this.request("/api/v1/balance");
  }

  async getProfit(): Promise<Profit> {
    return this.request("/api/v1/profit");
  }

  async getDaily(days: number = 30): Promise<DailyProfit> {
    return this.request(`/api/v1/daily?timescale=${days}`);
  }

  // Trades
  async getOpenTrades(): Promise<TradeInfo[]> {
    return this.request("/api/v1/status");
  }

  async getTrades(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ trades: TradeInfo[]; trades_count: number; total_trades: number }> {
    return this.request(`/api/v1/trades?limit=${limit}&offset=${offset}`);
  }

  async getPerformance(): Promise<PerformanceEntry[]> {
    return this.request("/api/v1/performance");
  }

  // Pair data
  async getWhitelist(): Promise<WhitelistResponse> {
    return this.request("/api/v1/whitelist");
  }

  async getPairCandles(
    pair: string,
    timeframe: string = "5m",
    limit: number = 500
  ): Promise<PairCandle> {
    return this.request(
      `/api/v1/pair_candles?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}&limit=${limit}`
    );
  }

  // Bot control
  async startBot(): Promise<BotStatus> {
    return this.request("/api/v1/start", { method: "POST" });
  }

  async stopBot(): Promise<BotStatus> {
    return this.request("/api/v1/stop", { method: "POST" });
  }

  async pauseBot(): Promise<BotStatus> {
    return this.request("/api/v1/pause", { method: "POST" });
  }

  // Force trade
  async forceEntry(
    pair: string,
    side: string = "long",
    price?: number,
    stakeAmount?: number
  ): Promise<TradeInfo> {
    return this.request("/api/v1/forceenter", {
      method: "POST",
      body: JSON.stringify({
        pair,
        side,
        ...(price && { price }),
        ...(stakeAmount && { stakeamount: stakeAmount }),
      }),
    });
  }

  async forceExit(tradeid: number, ordertype?: string): Promise<{ result: string }> {
    return this.request("/api/v1/forceexit", {
      method: "POST",
      body: JSON.stringify({
        tradeid: String(tradeid),
        ...(ordertype && { ordertype }),
      }),
    });
  }

  // Pairlist evaluation
  async evaluatePairlist(
    config: Record<string, unknown>
  ): Promise<{ status: string; job_id?: string }> {
    return this.request("/api/v1/pairlists/evaluate", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getPairlistResult(
    jobId: string
  ): Promise<{ status: string; result?: { whitelist: string[] } }> {
    return this.request(`/api/v1/pairlists/evaluate/${jobId}`);
  }

  // Backtest
  async startBacktest(config: Record<string, unknown>): Promise<{ status: string }> {
    return this.request("/api/v1/backtest", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getBacktestStatus(): Promise<Record<string, unknown>> {
    return this.request("/api/v1/backtest");
  }

  async deleteBacktest(): Promise<{ status: string }> {
    return this.request("/api/v1/backtest", { method: "DELETE" });
  }

  // Strategies
  async getStrategies(): Promise<{ strategies: string[] }> {
    return this.request("/api/v1/strategies");
  }

  // WebSocket token
  getWsToken(): string {
    return process.env.FREQTRADE_WS_TOKEN || "";
  }
}

interface BotStatus {
  status: string;
}

// Singleton instance
let clientInstance: FreqtradeClient | null = null;

export function getClient(): FreqtradeClient {
  if (!clientInstance) {
    const url = process.env.FREQTRADE_URL || "http://127.0.0.1:8080";
    const user = process.env.FREQTRADE_USERNAME || "mythos";
    const pass = process.env.FREQTRADE_PASSWORD || "mythos_alpha_2024";
    clientInstance = new FreqtradeClient(url, user, pass);
  }
  return clientInstance;
}

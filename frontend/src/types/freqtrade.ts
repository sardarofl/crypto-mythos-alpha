// Freqtrade API response types

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface Balance {
  currency: string;
  free: number;
  balance: number;
  used: number;
  bot_owned: number;
  est_stake: number;
  est_stake_bot: number;
  stake: string;
  side: string;
  is_position: boolean;
  position: number;
  is_bot_managed: boolean;
}

export interface Balances {
  currencies: Balance[];
  total: number;
  total_bot: number;
  symbol: string;
  value: number;
  value_bot: number;
  stake: string;
  starting_capital: number;
  starting_capital_ratio: number;
  starting_capital_pct: number;
  starting_capital_fiat: number;
  note: string;
}

export interface Order {
  amount: number;
  cost: number;
  filled: number;
  ft_order_side: string;
  order_date: string;
  order_timestamp: number;
  order_filled_date: string;
  order_type: string;
  pair: string;
  price: number;
  remaining: number;
  status: string;
  order_id: string;
}

export interface TradeInfo {
  trade_id: number;
  pair: string;
  base_currency: string;
  quote_currency: string;
  is_open: boolean;
  exchange: string;
  stake_amount: number;
  amount: number;
  open_rate: number;
  close_rate: number | null;
  current_rate: number;
  profit_ratio: number;
  profit_abs: number;
  profit_fiat: number;
  profit_pct: number;
  realized_profit: number;
  realized_profit_fiat: number;
  close_profit: number | null;
  close_profit_abs: number | null;
  open_date: string;
  open_timestamp: number;
  close_date: string | null;
  close_timestamp: number | null;
  open_fill_date: string | null;
  open_order: string | null;
  stoploss_current_dist: number;
  stoploss_current_dist_ratio: number;
  stoploss_current_dist_pct: number;
  stop_loss_abs: number;
  stop_loss_pct: number;
  stop_loss_ratio: number;
  min_rate: number;
  max_rate: number;
  enter_tag: string | null;
  exit_reason: string | null;
  orders: Order[];
  leverage: number;
  trading_mode: string;
  funding_fees: number;
}

export interface Profit {
  profit_closed_coin: number;
  profit_closed_percent_mean: number;
  profit_closed_ratio_mean: number;
  profit_closed_percent_sum: number;
  profit_closed_ratio_sum: number;
  profit_closed_percent: number;
  profit_closed_ratio: number;
  profit_closed_fiat: number;
  profit_all_coin: number;
  profit_all_percent_mean: number;
  profit_all_ratio_mean: number;
  profit_all_percent_sum: number;
  profit_all_ratio_sum: number;
  profit_all_percent: number;
  profit_all_ratio: number;
  profit_all_fiat: number;
  trade_count: number;
  closed_trade_count: number;
  first_trade_date: string;
  first_trade_timestamp: number;
  latest_trade_date: string;
  latest_trade_timestamp: number;
  avg_duration: string;
  best_pair: string;
  best_rate: number;
  best_pair_profit_ratio: number;
  winning_trades: number;
  losing_trades: number;
  profit_factor: number;
  winrate: number;
  expectancy: number;
  expectancy_ratio: number;
  max_drawdown: number;
  max_drawdown_abs: number;
  trading_volume: number;
  bot_start_date: string;
  bot_start_timestamp: number;
}

export interface DailyRecord {
  date: string;
  abs_profit: number;
  rel_profit: number;
  starting_balance: number;
  fiat_value: number;
  trade_count: number;
}

export interface DailyProfit {
  data: DailyRecord[];
  fiat_display_currency: string;
  stake_currency: string;
}

export interface ShowConfig {
  version: string;
  strategy_version: string | null;
  strategy: string;
  timeframe: string;
  timeframe_ms: number;
  max_open_trades: number;
  stake_currency: string;
  stake_amount: string | number;
  available_capital: number;
  trading_mode: string;
  stoploss: number;
  trailing_stop: boolean;
  minimal_roi: Record<string, number>;
  dry_run: boolean;
  state: string;
  bot_name: string;
  exchange: string;
}

export interface BotStatus {
  status: string;
}

export interface PairCandle {
  columns: string[];
  data: (string | number)[][];
  length: number;
  pair: string;
  timeframe: string;
  timeframe_ms: number;
}

export interface PerformanceEntry {
  pair: string;
  profit: number;
  profit_abs: number;
  count: number;
}

export interface WhitelistResponse {
  whitelist: string[];
  length: number;
  method: string[];
}

export interface BlacklistResponse {
  blacklist: string[];
  blacklist_reason: Record<string, string>;
  length: number;
  method: string[];
}

// Dashboard aggregated types
export interface DashboardData {
  balance: Balances | null;
  profit: Profit | null;
  openTrades: TradeInfo[];
  config: ShowConfig | null;
  daily: DailyRecord[];
}

// Pair scanner types
export interface PairScore {
  pair: string;
  volumeScore: number;
  volatilityScore: number;
  momentumScore: number;
  spreadScore: number;
  compositeScore: number;
  volume24h: number;
  percentChange: number;
  currentPrice: number;
}

// WebSocket message types
export interface WsMessage {
  type: string;
  data?: unknown;
}

# Trader Mythos - Solution Architecture

## System Overview

```
+============================================================================+
|                           YOUR VPS (Linux)                                  |
|                                                                            |
|  +---------------------------+       +----------------------------------+  |
|  |   FREQTRADE ENGINE        |       |   NEXT.JS DASHBOARD              |  |
|  |   (Python)                |       |   (Node.js - Port 3000)          |  |
|  |                           |       |                                  |  |
|  |  +---------------------+  |  API  |  +----------------------------+  |  |
|  |  | MythosScalper       |  | <---> |  | /api/bot                   |  |  |
|  |  | Strategy            |  |:8080  |  | (Backend-for-Frontend)     |  |  |
|  |  +---------------------+  |       |  +----------------------------+  |  |
|  |  | SentimentCache      |--|------>|  | /api/sentiment             |  |  |
|  |  | (reads sentiment)   |  |:3000  |  | (MiniMax + News + F&G)    |  |  |
|  |  +---------------------+  |       |  +----------------------------+  |  |
|  |                           |       |  | /api/settings              |  |  |
|  |  +---------------------+  |       |  | (API key storage)         |  |  |
|  |  | Wallets Engine      |  |       |  +----------------------------+  |  |
|  |  | (balance calc)      |  |       |                                  |  |
|  |  +---------------------+  |       |  +----------------------------+  |  |
|  |                           |       |  | React Dashboard UI         |  |  |
|  |  +---------------------+  |       |  | (Browser - Port 3000)      |  |  |
|  |  | REST API Server     |  |       |  +----------------------------+  |  |
|  |  | (Port 8080)         |  |       |                                  |  |
|  |  +---------------------+  |       +----------------------------------+  |
|  |                           |                                             |
|  +---------------------------+                                             |
|              |                                                             |
|              v                                                             |
|  +---------------------------+       +----------------------------------+  |
|  | tradesv3.dryrun.sqlite    |       | settings.sqlite                  |  |
|  | (Trades, Orders, Locks)   |       | (Encrypted API keys)             |  |
|  +---------------------------+       +----------------------------------+  |
|                                                                            |
+============================================================================+
         |                    |                       |
         v                    v                       v
+----------------+  +------------------+  +---------------------+
| BYBIT EXCHANGE |  | GOOGLE NEWS RSS  |  | MINIMAX M2.7 API    |
| (Market data   |  | (Free headlines  |  | (AI sentiment       |
|  via CCXT)     |  |  for sentiment)  |  |  analysis)          |
+----------------+  +------------------+  +---------------------+
                                          |
                              +-----------+-----------+
                              | ALTERNATIVE.ME API    |
                              | (Fear & Greed Index)  |
                              +-----------------------+
```

## Wallet / Balance Flow (THE MONEY)

```
WHERE DOES THE $100 COME FROM?
==============================

config_mythos_dry.json
    |
    |  "dry_run_wallet": 100     <-- THIS IS THE SEED. Hardcoded in config.
    |  "dry_run": true           <-- No real money. Simulated.
    |
    v
Freqtrade Wallets Engine (wallets.py)
    |
    |  On EVERY cycle (every 5 seconds), recalculates from scratch:
    |
    |  balance = $100 (seed)
    |          + sum(closed trade profits)      <-- from SQLite
    |          + sum(open trade partial profits) <-- from SQLite
    |          - sum(open trade stakes)          <-- capital locked in positions
    |          - sum(pending orders)
    |
    |  This is NOT stored anywhere. It's DERIVED every time.
    |
    v
Freqtrade REST API (/api/v1/balance)
    |
    |  Returns JSON:
    |  {
    |    "total": 101.81,          <-- ALL assets (USDT + coins at market rate)
    |    "total_bot": 80.52,       <-- Only bot-tracked assets (CAN BE WRONG)
    |    "starting_capital": 99,   <-- Seed minus initial fees
    |    "currencies": [...]       <-- Per-coin breakdown
    |  }
    |
    v
Next.js /api/bot route (BFF proxy)
    |
    |  Fetches from freqtrade, passes through to frontend
    |
    v
Dashboard PortfolioCards.tsx
    |
    |  totalValue = balance.total       <-- We use TOTAL, not total_bot
    |  startingCapital = balance.starting_capital
    |  P&L = totalValue - startingCapital
    |
    v
DISPLAYED TO YOU: "$101.81 (+2.84%)"
```

## Trading Workflow

```
EVERY 5 MINUTES (one candle cycle):
====================================

1. FETCH MARKET DATA
   Bybit Exchange --[CCXT]--> Freqtrade
   |  Downloads latest 5m candles for all 10 pairs
   |  BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, LINK, DOT, NEAR

2. CALCULATE INDICATORS
   MythosScalper.populate_indicators()
   |  EMA(8), EMA(21), EMA(55)
   |  RSI(14), MACD, Bollinger Bands, ATR
   |  Volume factor (current / 20-period average)
   |  EMA crossover detection

3. CHECK ENTRY SIGNALS
   MythosScalper.populate_entry_trend()
   |  ALL conditions must be true:
   |  [x] EMA fast crossed above EMA slow (within last 3 candles)
   |  [x] Price above EMA trend (uptrend)
   |  [x] RSI between 35-65 (sweet spot)
   |  [x] Volume spike > 1.5x average
   |  [x] MACD histogram positive and increasing

4. SENTIMENT CHECK (NEW - Option B)
   MythosScalper.confirm_trade_entry()
   |
   |  Fetches from Dashboard API: http://127.0.0.1:3000/api/sentiment
   |  (cached for 5 minutes)
   |
   |  Gate: If coin is BEARISH with >70% confidence --> BLOCK TRADE
   |  Gate: If daily drawdown > 10% --> BLOCK TRADE

5. POSITION SIZING (SENTIMENT-BOOSTED)
   MythosScalper.custom_stake_amount()
   |
   |  base_stake = free_balance / available_slots
   |
   |  Sentiment multiplier:
   |  +-------------------------------+
   |  | Bullish  60-100% conf: +20-30%|
   |  | Bullish  40-59%  conf: +10%   |
   |  | Neutral  any:          0%     |
   |  | Bearish  40-59%  conf: -20%   |
   |  | Bearish  60-100% conf: -30-40%|
   |  +-------------------------------+
   |
   |  Fear & Greed overlay:
   |  +-------------------------------+
   |  | F&G < 20 (Extreme Fear): -25% |
   |  | F&G 20-60:               0%   |
   |  | F&G > 60 (Greed):       +15%  |
   |  +-------------------------------+
   |
   |  final_stake = base_stake * multiplier (clamped 0.3x - 1.5x)

6. EXECUTE TRADE
   Freqtrade --> Bybit (simulated in dry-run)
   |  Places limit buy order
   |  Records in tradesv3.dryrun.sqlite

7. MONITOR & EXIT
   On every subsequent candle:
   |
   |  Auto-exit triggers:
   |  [ROI]      +4% immediate, +2.5% after 30m, +1.5% after 1h, +0.5% after 2h
   |  [Stoploss] -3% (or ATR-based dynamic, whichever is tighter)
   |  [Trailing] Activates at +2.5%, trails at 1.5%
   |  [Signal]   EMA cross down, RSI overbought (>75), volume drying up
```

## Sentiment Analysis Flow

```
EVERY 5 MINUTES (on dashboard refresh or strategy request):
============================================================

1. FETCH NEWS
   Google News RSS (FREE, no API key)
   |  "cryptocurrency bitcoin ethereum solana..."
   |  Returns ~100-200 headlines
   |  Filtered to top 25 most relevant

2. FETCH FEAR & GREED
   alternative.me/crypto/fear-and-greed-index/
   |  Returns: { value: 8, classification: "Extreme Fear" }

3. AI ANALYSIS
   Headlines --> MiniMax M2.7 API
   |
   |  Prompt: "Analyze these crypto headlines for each coin,
   |           return sentiment (bullish/bearish/neutral),
   |           confidence (0-100), and a human-readable summary"
   |
   |  Response (after stripping <think> tags):
   |  {
   |    "overall_summary": "Markets are fearful due to...",
   |    "coins": [
   |      { "coin": "BTC", "sentiment": "bearish", "confidence": 65,
   |        "summary": "Bitcoin faces pressure from..." },
   |      ...
   |    ]
   |  }

4. CACHED & SERVED
   Stored in memory (5 min TTL)
   |
   +--> Dashboard UI (SentimentPanel component)
   |    Shows human-readable summary, per-coin cards, F&G gauge
   |
   +--> MythosScalper strategy (SentimentCache class)
        Adjusts position sizing and blocks bearish trades
```

## Data Storage

```
+------------------------------------------+
| tradesv3.dryrun.sqlite                   |
| (Managed by Freqtrade)                   |
|------------------------------------------|
| trades    | Every trade: pair, amounts,  |
|           | prices, profit, timestamps   |
|           | THIS IS YOUR TRADE HISTORY   |
|------------------------------------------|
| orders    | Individual buy/sell orders    |
|           | tied to each trade           |
|------------------------------------------|
| pairlocks | Cooldown periods after       |
|           | losses on specific pairs     |
|------------------------------------------|
| NOTE: Wallet balance is NOT stored here. |
| It's recalculated every cycle from the   |
| config seed ($100) + trade history.      |
+------------------------------------------+

+------------------------------------------+
| settings.sqlite                          |
| (Managed by Dashboard)                   |
|------------------------------------------|
| settings  | key-value pairs              |
|           | - minimax_api_key (encrypted) |
|           | - other future settings       |
|           | Encrypted with AES-256-GCM   |
+------------------------------------------+
```

## Key Insight: No Real Money Exists Anywhere

```
In DRY-RUN mode:
- The $100 is a NUMBER in a config file
- Freqtrade SIMULATES trades against real market prices
- The SQLite DB records simulated trade results
- The wallet balance is MATH: $100 + profits - losses
- Bybit exchange is only used for PRICE DATA, never for orders
- To go LIVE: change "dry_run": false, add real Bybit API keys
```

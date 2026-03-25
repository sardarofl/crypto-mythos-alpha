"""
MythosScalper - Aggressive momentum scalping strategy for small accounts.
Optimized for $100 starting capital targeting 10x growth.
Uses EMA crossovers, RSI momentum, volume spikes, and ATR-based risk management.
Sentiment-boosted: adjusts position size based on AI market sentiment.
"""

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from functools import reduce
from urllib.request import Request, urlopen
from urllib.error import URLError

import numpy as np
import talib.abstract as ta
from pandas import DataFrame

from freqtrade.persistence import Trade
from freqtrade.strategy import (
    BooleanParameter,
    DecimalParameter,
    IntParameter,
    IStrategy,
)

logger = logging.getLogger(__name__)


class SentimentCache:
    """Fetches and caches sentiment data from the dashboard API."""

    def __init__(self, api_url: str = "http://127.0.0.1:3000/api/sentiment", ttl: int = 300):
        self.api_url = api_url
        self.ttl = ttl  # Cache for 5 minutes
        self._data: dict | None = None
        self._last_fetch: float = 0
        self._fear_greed: int | None = None
        self._coin_sentiments: dict[str, dict] = {}

    def _fetch(self) -> None:
        now = time.time()
        if self._data and (now - self._last_fetch) < self.ttl:
            return  # Cache still valid

        try:
            req = Request(self.api_url, headers={"Accept": "application/json"})
            with urlopen(req, timeout=5) as resp:
                self._data = json.loads(resp.read().decode())
                self._last_fetch = now

                # Parse fear & greed
                fg = self._data.get("fearGreed")
                self._fear_greed = fg.get("value") if fg else None

                # Parse per-coin sentiments
                self._coin_sentiments = {}
                for coin in self._data.get("coins", []):
                    self._coin_sentiments[coin["coin"]] = {
                        "sentiment": coin.get("sentiment", "neutral"),
                        "confidence": coin.get("confidence", 0),
                    }

                logger.info(
                    f"[Sentiment] Updated: F&G={self._fear_greed}, "
                    f"coins={list(self._coin_sentiments.keys())}"
                )
        except (URLError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"[Sentiment] Fetch failed: {e}")

    def get_coin_sentiment(self, pair: str) -> tuple[str, int]:
        """Returns (sentiment, confidence) for a trading pair like 'BTC/USDT'."""
        self._fetch()
        coin = pair.split("/")[0]
        data = self._coin_sentiments.get(coin, {})
        return data.get("sentiment", "neutral"), data.get("confidence", 0)

    def get_fear_greed(self) -> int | None:
        """Returns Fear & Greed value 0-100, or None if unavailable."""
        self._fetch()
        return self._fear_greed


class MythosScalper(IStrategy):
    INTERFACE_VERSION = 3

    # ROI table - aggressive take-profit targets
    minimal_roi = {
        "0": 0.04,      # 4% immediate
        "30": 0.025,    # 2.5% after 30min
        "60": 0.015,    # 1.5% after 1h
        "120": 0.005,   # 0.5% after 2h
    }

    stoploss = -0.03  # 3% stoploss - tight for capital preservation

    # Trailing stop
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.025
    trailing_only_offset_is_reached = True

    # Trading settings
    timeframe = "5m"
    can_short = False  # Spot only - no liquidation risk
    process_only_new_candles = True
    startup_candle_count = 55  # Need enough candles for EMA(55)

    # Position sizing
    position_adjustment_enable = False

    # Sentiment integration
    sentiment = SentimentCache()

    # Hyperopt parameters
    buy_ema_fast = IntParameter(5, 15, default=8, space="buy", optimize=True)
    buy_ema_slow = IntParameter(15, 30, default=21, space="buy", optimize=True)
    buy_ema_trend = IntParameter(40, 70, default=55, space="buy", optimize=True)
    buy_rsi_low = IntParameter(25, 45, default=35, space="buy", optimize=True)
    buy_rsi_high = IntParameter(55, 75, default=65, space="buy", optimize=True)
    buy_volume_factor = DecimalParameter(1.0, 3.0, default=1.5, decimals=1, space="buy", optimize=True)

    sell_rsi_high = IntParameter(65, 85, default=75, space="sell", optimize=True)
    sell_volume_decline_candles = IntParameter(2, 5, default=3, space="sell", optimize=True)

    # Drawdown protection
    max_daily_drawdown = DecimalParameter(0.05, 0.15, default=0.10, decimals=2, space="protection", optimize=False)

    # Plot config for FreqUI
    plot_config = {
        "main_plot": {
            "ema_fast": {"color": "#00ff88"},
            "ema_slow": {"color": "#ff8800"},
            "ema_trend": {"color": "#8888ff"},
            "bb_upperband": {"color": "#444444"},
            "bb_lowerband": {"color": "#444444"},
        },
        "subplots": {
            "RSI": {
                "rsi": {"color": "#cc33cc"},
            },
            "MACD": {
                "macd": {"color": "#0088ff"},
                "macdsignal": {"color": "#ff4444"},
                "macdhist": {"color": "#888888", "type": "bar"},
            },
            "Volume Factor": {
                "volume_factor": {"color": "#ffff00"},
            },
        },
    }

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # EMAs
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.buy_ema_fast.value)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.buy_ema_slow.value)
        dataframe["ema_trend"] = ta.EMA(dataframe, timeperiod=self.buy_ema_trend.value)

        # RSI
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)

        # MACD
        macd = ta.MACD(dataframe)
        dataframe["macd"] = macd["macd"]
        dataframe["macdsignal"] = macd["macdsignal"]
        dataframe["macdhist"] = macd["macdhist"]

        # Bollinger Bands
        bollinger = ta.BBANDS(dataframe, timeperiod=20, nbdevup=2.0, nbdevdn=2.0)
        dataframe["bb_upperband"] = bollinger["upperband"]
        dataframe["bb_middleband"] = bollinger["middleband"]
        dataframe["bb_lowerband"] = bollinger["lowerband"]
        dataframe["bb_width"] = (
            (dataframe["bb_upperband"] - dataframe["bb_lowerband"]) / dataframe["bb_middleband"]
        )

        # ATR for dynamic stoploss
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=14)

        # Volume analysis
        dataframe["volume_sma"] = ta.SMA(dataframe["volume"], timeperiod=20)
        dataframe["volume_factor"] = dataframe["volume"] / dataframe["volume_sma"]

        # EMA crossover detection
        dataframe["ema_cross_up"] = (
            (dataframe["ema_fast"] > dataframe["ema_slow"])
            & (dataframe["ema_fast"].shift(1) <= dataframe["ema_slow"].shift(1))
        ).astype(int)

        dataframe["ema_cross_down"] = (
            (dataframe["ema_fast"] < dataframe["ema_slow"])
            & (dataframe["ema_fast"].shift(1) >= dataframe["ema_slow"].shift(1))
        ).astype(int)

        # Momentum: MACD histogram increasing
        dataframe["macd_hist_increasing"] = (
            dataframe["macdhist"] > dataframe["macdhist"].shift(1)
        ).astype(int)

        # Volume declining for N candles
        for i in range(2, 6):
            col = f"volume_declining_{i}"
            conditions = [
                dataframe["volume"].shift(j) < dataframe["volume_sma"].shift(j)
                for j in range(i)
            ]
            dataframe[col] = reduce(lambda a, b: a & b, conditions).astype(int)

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        conditions = [
            # EMA fast crossed above EMA slow (within last 3 candles for flexibility)
            (
                (dataframe["ema_cross_up"] == 1)
                | (dataframe["ema_cross_up"].shift(1) == 1)
                | (dataframe["ema_cross_up"].shift(2) == 1)
            ),
            # EMA fast is above EMA slow (confirmation)
            (dataframe["ema_fast"] > dataframe["ema_slow"]),
            # Price above trend EMA (uptrend)
            (dataframe["close"] > dataframe["ema_trend"]),
            # RSI in sweet spot (not overbought, not oversold)
            (dataframe["rsi"] > self.buy_rsi_low.value),
            (dataframe["rsi"] < self.buy_rsi_high.value),
            # Volume spike
            (dataframe["volume_factor"] > self.buy_volume_factor.value),
            # MACD histogram positive and increasing
            (dataframe["macdhist"] > 0),
            (dataframe["macd_hist_increasing"] == 1),
            # Basic volume filter
            (dataframe["volume"] > 0),
        ]

        dataframe.loc[reduce(lambda a, b: a & b, conditions), "enter_long"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        conditions_signal = [
            # EMA fast crossed below EMA slow
            (
                (dataframe["ema_cross_down"] == 1)
                | (dataframe["ema_cross_down"].shift(1) == 1)
            ),
            (dataframe["volume"] > 0),
        ]

        conditions_overbought = [
            # RSI overbought
            (dataframe["rsi"] > self.sell_rsi_high.value),
            (dataframe["volume"] > 0),
        ]

        vol_decline_col = f"volume_declining_{self.sell_volume_decline_candles.value}"
        conditions_volume_dry = [
            # Volume drying up
            (dataframe[vol_decline_col] == 1),
            # And EMA fast trending down
            (dataframe["ema_fast"] < dataframe["ema_fast"].shift(1)),
            (dataframe["volume"] > 0),
        ]

        # Combine: exit on any of these conditions
        signal_exit = reduce(lambda a, b: a & b, conditions_signal)
        overbought_exit = reduce(lambda a, b: a & b, conditions_overbought)
        volume_dry_exit = reduce(lambda a, b: a & b, conditions_volume_dry)

        dataframe.loc[signal_exit | overbought_exit | volume_dry_exit, "exit_long"] = 1

        # Tag the exits
        dataframe.loc[signal_exit, "exit_tag"] = "ema_cross_down"
        dataframe.loc[overbought_exit, "exit_tag"] = "rsi_overbought"
        dataframe.loc[volume_dry_exit, "exit_tag"] = "volume_dry"

        return dataframe

    def custom_stoploss(
        self, pair: str, trade: Trade, current_time: datetime,
        current_rate: float, current_profit: float, after_fill: bool,
        **kwargs,
    ) -> float:
        """ATR-based dynamic stoploss that adapts to volatility."""
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe.empty:
            return self.stoploss

        last_candle = dataframe.iloc[-1]
        atr = last_candle.get("atr", 0)

        if atr > 0 and current_rate > 0:
            # Stoploss at 2x ATR below current price
            atr_stoploss = -(atr * 2) / current_rate
            # Don't make stoploss wider than default
            return max(atr_stoploss, self.stoploss)

        return self.stoploss

    def custom_stake_amount(
        self, pair: str, current_time: datetime, current_rate: float,
        proposed_stake: float, min_stake: float | None, max_stake: float,
        leverage: float, entry_tag: str | None, side: str, **kwargs,
    ) -> float:
        """
        Sentiment-boosted position sizing.

        Base: equal split across slots.
        Then adjusted by AI sentiment:
          - Bullish (high confidence) → up to +30% more stake
          - Bearish → up to -40% less stake (or skip entirely)
          - Neutral → no change
          - Fear & Greed < 20 → reduce all positions by 25%
          - Fear & Greed > 60 → boost all positions by 15%
        """
        max_trades = self.config.get("max_open_trades", 5)
        if max_trades <= 0:
            return proposed_stake

        # Base stake: divide balance equally across available slots
        total_balance = self.wallets.get_free(self.config["stake_currency"])
        open_trades = Trade.get_trades_proxy(is_open=True)
        slots_available = max_trades - len(open_trades)

        if slots_available <= 0:
            return 0

        base_stake = total_balance / slots_available

        # --- Sentiment adjustment ---
        sentiment, confidence = self.sentiment.get_coin_sentiment(pair)
        fear_greed = self.sentiment.get_fear_greed()

        multiplier = 1.0

        # Per-coin sentiment boost/reduction
        if sentiment == "bullish" and confidence >= 60:
            # High-confidence bullish: +20% to +30%
            # At conf=60: +0.20, at conf=100: +0.20+0.10=+0.30
            multiplier += 0.20 + (confidence - 60) / 400
        elif sentiment == "bullish" and confidence >= 40:
            # Moderate bullish: +10%
            multiplier += 0.10
        elif sentiment == "bearish" and confidence >= 60:
            # High-confidence bearish: -30% to -40%
            # At conf=60: -0.30, at conf=100: -0.30-0.10=-0.40
            multiplier -= 0.30 + (confidence - 60) / 400
        elif sentiment == "bearish" and confidence >= 40:
            # Moderate bearish: -20%
            multiplier -= 0.20

        # Fear & Greed global adjustment
        if fear_greed is not None:
            if fear_greed < 20:
                # Extreme fear: reduce position by 25%
                multiplier *= 0.75
                logger.info(f"[Sentiment] F&G={fear_greed} (extreme fear) → reducing stake 25%")
            elif fear_greed > 60:
                # Greed: boost position by 15%
                multiplier *= 1.15
                logger.info(f"[Sentiment] F&G={fear_greed} (greed) → boosting stake 15%")

        # Clamp multiplier between 0.3x and 1.5x
        multiplier = max(0.3, min(1.5, multiplier))

        adjusted_stake = base_stake * multiplier

        if abs(multiplier - 1.0) > 0.01:
            logger.info(
                f"[Sentiment] {pair}: {sentiment} ({confidence}%) → "
                f"stake {multiplier:.2f}x = ${adjusted_stake:.2f} "
                f"(base ${base_stake:.2f})"
            )

        # Respect minimums
        if min_stake is not None and adjusted_stake < min_stake:
            return 0

        return min(adjusted_stake, max_stake)

    def confirm_trade_entry(
        self, pair: str, order_type: str, amount: float, rate: float,
        time_in_force: str, current_time: datetime, entry_tag: str | None,
        side: str, **kwargs,
    ) -> bool:
        """
        Drawdown circuit breaker + sentiment gate.
        - Skip entries if daily drawdown exceeded.
        - Skip entries if sentiment is bearish with high confidence (>70%).
        """
        # --- Daily drawdown check ---
        today_start = current_time.replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )

        closed_trades = Trade.get_trades_proxy(
            is_open=False,
            close_date=today_start,
        )

        if closed_trades:
            daily_profit = sum(t.close_profit or 0 for t in closed_trades)
            if daily_profit < -self.max_daily_drawdown.value:
                logger.info(
                    f"Skipping {pair} entry: daily drawdown {daily_profit:.2%} "
                    f"exceeds limit {-self.max_daily_drawdown.value:.2%}"
                )
                return False

        # --- Sentiment gate ---
        sentiment, confidence = self.sentiment.get_coin_sentiment(pair)
        if sentiment == "bearish" and confidence >= 70:
            logger.info(
                f"[Sentiment] BLOCKING {pair} entry: bearish with {confidence}% confidence"
            )
            return False

        return True

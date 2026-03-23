"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "./store";

function getWsUrl() {
  if (typeof window === "undefined") return "ws://127.0.0.1:8080/api/v1/message/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${proto}//${host}:8080/api/v1/message/ws`;
}
const WS_URL = getWsUrl();

interface WsMessage {
  type: string;
  data?: Record<string, unknown>;
}

export function useTradeWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const { setConnected, addNotification } = useAppStore();

  const connect = useCallback(() => {
    const wsToken = process.env.NEXT_PUBLIC_FREQTRADE_WS_TOKEN || "FNY3aXFMMPlEZAbnpOQySw";
    const ws = new WebSocket(`${WS_URL}?token=${wsToken}`);

    ws.onopen = () => {
      setConnected(true);
      // Subscribe to trade events
      ws.send(
        JSON.stringify({
          type: "subscribe",
          data: [
            "entry",
            "exit",
            "entry_fill",
            "exit_fill",
            "new_candle",
          ],
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [setConnected]);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      switch (msg.type) {
        case "entry":
          addNotification({
            type: "info",
            title: "Entry Signal",
            message: `Entry signal for ${(msg.data as Record<string, unknown>)?.pair || "unknown"}`,
          });
          break;
        case "entry_fill":
          addNotification({
            type: "success",
            title: "Trade Opened",
            message: `Bought ${(msg.data as Record<string, unknown>)?.pair || "unknown"}`,
          });
          break;
        case "exit":
          addNotification({
            type: "warning",
            title: "Exit Signal",
            message: `Exit signal for ${(msg.data as Record<string, unknown>)?.pair || "unknown"}`,
          });
          break;
        case "exit_fill":
          addNotification({
            type: "success",
            title: "Trade Closed",
            message: `Sold ${(msg.data as Record<string, unknown>)?.pair || "unknown"}`,
          });
          break;
      }
    },
    [addNotification]
  );

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}

import { create } from "zustand";
import type { Balances, DailyRecord, Profit, ShowConfig, TradeInfo } from "@/types/freqtrade";

interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: number;
}

interface AppState {
  // Bot state
  config: ShowConfig | null;
  balance: Balances | null;
  profit: Profit | null;
  openTrades: TradeInfo[];
  dailyData: DailyRecord[];
  isConnected: boolean;
  botRunning: boolean;

  // UI state
  sidebarOpen: boolean;
  notifications: Notification[];

  // Actions
  setConfig: (config: ShowConfig | null) => void;
  setBalance: (balance: Balances | null) => void;
  setProfit: (profit: Profit | null) => void;
  setOpenTrades: (trades: TradeInfo[]) => void;
  setDailyData: (data: DailyRecord[]) => void;
  setConnected: (connected: boolean) => void;
  setBotRunning: (running: boolean) => void;
  toggleSidebar: () => void;
  addNotification: (n: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: null,
  balance: null,
  profit: null,
  openTrades: [],
  dailyData: [],
  isConnected: false,
  botRunning: false,
  sidebarOpen: true,
  notifications: [],

  setConfig: (config) => set({ config }),
  setBalance: (balance) => set({ balance }),
  setProfit: (profit) => set({ profit }),
  setOpenTrades: (openTrades) => set({ openTrades }),
  setDailyData: (dailyData) => set({ dailyData }),
  setConnected: (isConnected) => set({ isConnected }),
  setBotRunning: (botRunning) => set({ botRunning }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        ...s.notifications,
        { ...n, id: crypto.randomUUID(), timestamp: Date.now() },
      ].slice(-10),
    })),
  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));

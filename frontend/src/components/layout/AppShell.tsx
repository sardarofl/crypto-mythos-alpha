"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Notifications } from "./Notifications";
import { useAppStore } from "@/lib/store";
import { useTradeWebSocket } from "@/lib/websocket";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  useTradeWebSocket();

  return (
    <>
      <Sidebar />
      <div
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? "16rem" : "5rem" }}
      >
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <Notifications />
    </>
  );
}

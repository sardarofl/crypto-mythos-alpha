"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Radar,
  CandlestickChart,
  FlaskConical,
  Settings,
  Swords,
  ChevronLeft,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pair-scanner", label: "Pair Scanner", icon: Radar },
  { href: "/trading", label: "Trading", icon: CandlestickChart },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[var(--color-sidebar)] border-r border-[var(--color-border)] transition-all duration-300",
        sidebarOpen ? "w-64" : "w-20"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-[var(--color-border)]">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent)]">
            <Swords className="h-5 w-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-base font-bold tracking-tight">Trader Mythos</h1>
              <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest">Alpha</p>
            </div>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          className="text-[var(--color-muted)] hover:text-white transition-colors"
        >
          <ChevronLeft
            className={clsx("h-5 w-5 transition-transform", !sidebarOpen && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "text-[var(--color-muted)] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] p-4">
        {sidebarOpen && (
          <p className="text-xs text-[var(--color-muted)]">
            Powered by Freqtrade
          </p>
        )}
      </div>
    </aside>
  );
}

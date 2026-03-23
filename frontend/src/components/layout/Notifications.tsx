"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useAppStore } from "@/lib/store";

const typeStyles = {
  success: "border-[var(--color-success)] bg-[var(--color-success)]/10",
  error: "border-[var(--color-danger)] bg-[var(--color-danger)]/10",
  warning: "border-[var(--color-warning)] bg-[var(--color-warning)]/10",
  info: "border-[var(--color-info)] bg-[var(--color-info)]/10",
};

export function Notifications() {
  const { notifications, removeNotification } = useAppStore();

  useEffect(() => {
    // Auto-dismiss after 5s
    const timers = notifications.map((n) =>
      setTimeout(() => removeNotification(n.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, removeNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={clsx(
            "rounded-lg border p-3 shadow-lg animate-in slide-in-from-right",
            typeStyles[n.type]
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">{n.message}</p>
            </div>
            <button onClick={() => removeNotification(n.id)}>
              <X className="h-4 w-4 text-[var(--color-muted)]" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

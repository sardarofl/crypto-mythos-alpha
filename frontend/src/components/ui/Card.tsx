"use client";

import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]",
        padding && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}

export function StatCard({ title, value, change, changeType = "neutral", icon }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--color-muted)]">{title}</p>
          <h3 className="mt-1 text-2xl font-bold">{value}</h3>
          {change && (
            <p
              className={clsx("mt-1 text-sm font-medium", {
                "text-[var(--color-success)]": changeType === "positive",
                "text-[var(--color-danger)]": changeType === "negative",
                "text-[var(--color-muted)]": changeType === "neutral",
              })}
            >
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

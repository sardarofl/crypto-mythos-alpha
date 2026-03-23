"use client";

import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "danger" | "warning" | "info" | "neutral";
  className?: string;
}

const variants = {
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  danger: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  info: "bg-[var(--color-info)]/15 text-[var(--color-info)]",
  neutral: "bg-[var(--color-muted)]/15 text-[var(--color-muted)]",
};

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

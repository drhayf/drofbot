import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "accent" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-ground-default text-ink-secondary border border-border-subtle",
  success: "bg-emerald-50 text-semantic-success border border-emerald-200",
  warning: "bg-amber-50 text-semantic-warning border border-amber-200",
  error: "bg-red-50 text-semantic-error border border-red-200",
  accent: "bg-accent-surface text-accent-deep border border-accent-muted",
  muted: "bg-ground-muted text-ink-tertiary border border-border-subtle",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

/**
 * Small label badge for status, tags, categories.
 */
export function Badge({ children, variant = "default", className = "", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Placeholder shown when a list/view has no content yet.
 * Calm, inviting tone — not clinical "No data found".
 */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {icon && <div className="text-ink-tertiary mb-4 [&_svg]:w-10 [&_svg]:h-10">{icon}</div>}
      <h3 className="font-display text-lg text-ink-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-secondary max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

/**
 * Base card component — white surface with subtle border.
 * Cards are the primary content container in the dashboard.
 */
export function Card({ children, className = "", onClick, hoverable = false }: CardProps) {
  return (
    <div
      className={`bg-surface-raised border border-border-subtle rounded-card shadow-card ${
        hoverable ? "transition-shadow duration-fast hover:shadow-card-hover cursor-pointer" : ""
      } ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 border-b border-border-subtle ${className}`}>{children}</div>;
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

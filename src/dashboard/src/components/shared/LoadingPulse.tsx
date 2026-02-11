/**
 * Gentle loading indicator — pulsing dots.
 * Matches the "Quiet Intelligence" feel (no spinners).
 */
export function LoadingPulse({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="flex gap-1.5">
        <span
          className="loading-pulse w-2 h-2 rounded-full bg-accent-muted"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="loading-pulse w-2 h-2 rounded-full bg-accent-muted"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="loading-pulse w-2 h-2 rounded-full bg-accent-muted"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

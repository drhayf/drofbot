import { WifiOff } from "lucide-react";
import { useState, useEffect } from "react";
import { isOnline, onConnectionChange } from "../../utils/offline";

/**
 * Subtle offline indicator banner — shows when the network is disconnected.
 * Positioned below the header, fades in/out.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    return onConnectionChange(setOnline);
  }, []);

  if (online) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 bg-caution/10 border-b border-caution/20 text-sm text-caution animate-fade-in"
      role="alert"
    >
      <WifiOff size={14} />
      <span>You're offline — showing cached data</span>
    </div>
  );
}

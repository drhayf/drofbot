import { useEffect, useRef } from "react";
import { getSupabase } from "../api/supabase";

/**
 * Hook for subscribing to Supabase real-time changes on a table.
 * Calls `onData` whenever an INSERT/UPDATE/DELETE event occurs.
 * Gracefully no-ops if Supabase isn't configured.
 */
export function useRealtime(
  table: string,
  onData: (payload: { eventType: string; new: unknown; old: unknown }) => void,
  filter?: string,
) {
  const callbackRef = useRef(onData);
  callbackRef.current = onData;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`dashboard-${table}`)
      .on(
        "postgres_changes" as "system",
        { event: "*", schema: "public", table, filter } as unknown as { event: "system" },
        (payload: unknown) => {
          const p = payload as { eventType: string; new: unknown; old: unknown };
          callbackRef.current(p);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}

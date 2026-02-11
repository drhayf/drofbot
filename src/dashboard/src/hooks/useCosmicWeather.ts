import { useEffect } from "react";
import { useCosmicStore } from "../stores/cosmic";

/**
 * Periodically refreshes cosmic weather data.
 * Polls every 15 minutes (cosmic data changes slowly).
 */
export function useCosmicWeather() {
  const { weather, isLoading, fetch: fetchCosmic } = useCosmicStore();

  useEffect(() => {
    fetchCosmic();
    const interval = setInterval(fetchCosmic, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCosmic]);

  return { weather, isLoading };
}

/**
 * Council Registry — the extensible core.
 *
 * Register systems: council.register(new CardologySystem())
 * Calculate all:    council.calculateAll(birthMoment)
 * Get timestamp:    council.getCosmicTimestamp(birthMoment)
 * Add new system:   Implement CosmicSystem interface, register. Done.
 */

import type {
  BirthMoment,
  CosmicState,
  CosmicSystem,
  CosmicTimestamp,
  RecalcInterval,
} from "./types.js";

interface CacheEntry {
  state: CosmicState;
  expires: Date;
}

/**
 * Calculate the expiration time for a given recalc interval.
 */
function calculateExpiration(interval: RecalcInterval, now: Date): Date {
  const ms = now.getTime();
  switch (interval.type) {
    case "hours":
      return new Date(ms + interval.hours * 60 * 60 * 1000);
    case "daily":
      return new Date(ms + 24 * 60 * 60 * 1000);
    case "periodic":
      return new Date(ms + interval.days * 24 * 60 * 60 * 1000);
    case "realtime":
      return new Date(ms + interval.minutes * 60 * 1000);
  }
}

export class CouncilRegistry {
  private systems = new Map<string, CosmicSystem>();
  private stateCache = new Map<string, CacheEntry>();

  /**
   * Register a cosmic system.
   * Replaces any existing system with the same name.
   */
  register(system: CosmicSystem): void {
    this.systems.set(system.name, system);
    // Invalidate cache for this system on re-registration
    this.stateCache.delete(system.name);
  }

  /**
   * Unregister a cosmic system by name.
   */
  unregister(name: string): void {
    this.systems.delete(name);
    this.stateCache.delete(name);
  }

  /**
   * Get a registered system by name.
   */
  getSystem(name: string): CosmicSystem | undefined {
    return this.systems.get(name);
  }

  /**
   * List all registered systems.
   */
  listSystems(): CosmicSystem[] {
    return [...this.systems.values()];
  }

  /**
   * Get the number of registered systems.
   */
  get size(): number {
    return this.systems.size;
  }

  /**
   * Calculate all systems, using cache when fresh.
   * Systems that require birth data but receive none return null and are skipped.
   * Systems that throw errors are logged and skipped (graceful degradation).
   */
  async calculateAll(birth: BirthMoment | null, now?: Date): Promise<Map<string, CosmicState>> {
    const currentTime = now ?? new Date();
    const results = new Map<string, CosmicState>();

    const promises = [...this.systems.entries()].map(async ([name, system]) => {
      try {
        // Check cache
        const cached = this.stateCache.get(name);
        if (cached && cached.expires > currentTime) {
          return { name, state: cached.state };
        }

        // Calculate fresh
        const state = await system.calculate(birth, currentTime);
        if (state) {
          // Cache the result
          this.stateCache.set(name, {
            state,
            expires: calculateExpiration(system.recalcInterval, currentTime),
          });
          return { name, state };
        }
        return { name, state: null };
      } catch {
        // Graceful degradation: one system failing doesn't affect others
        return { name, state: null };
      }
    });

    const settled = await Promise.all(promises);
    for (const { name, state } of settled) {
      if (state) {
        results.set(name, state);
      }
    }

    return results;
  }

  /**
   * Generate a cosmic timestamp for memory enrichment.
   * Contains the state of all registered systems at this moment.
   */
  async getCosmicTimestamp(birth: BirthMoment | null, now?: Date): Promise<CosmicTimestamp> {
    const currentTime = now ?? new Date();
    const allStates = await this.calculateAll(birth, currentTime);
    const systems: Record<string, CosmicState> = {};

    for (const [name, state] of allStates) {
      systems[name] = state;
    }

    return {
      datetime: currentTime,
      systems,
    };
  }

  /**
   * Invalidate cache for a specific system or all systems.
   */
  invalidateCache(system?: string): void {
    if (system) {
      this.stateCache.delete(system);
    } else {
      this.stateCache.clear();
    }
  }
}

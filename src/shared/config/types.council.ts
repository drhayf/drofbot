import type { BirthMoment } from "../../brain/council/types.js";

/**
 * Council configuration — operator + agent birth data,
 * system selection, and briefing schedule.
 */
export type CouncilConfig = {
  /** Master switch for the Council system. Default: true. */
  enabled?: boolean;
  /** Operator's birth data for natal calculations. */
  operatorBirth?: BirthMomentConfig;
  /** Drofbot's birth data (default: fork creation timestamp). */
  agentBirth?: BirthMomentConfig;
  /** Which systems to activate (default: all registered). */
  enabledSystems?: string[];
  /** Briefing schedule (cron expressions). */
  briefingSchedule?: {
    morning?: string;
    midday?: string;
    evening?: string;
  };
  /** Which channel to send briefings to (default: first configured). */
  primaryChannel?: string;
};

/**
 * Serializable birth moment config (dates stored as ISO strings).
 */
export type BirthMomentConfig = {
  datetime: string; // ISO 8601
  latitude: number;
  longitude: number;
  timezone: string; // IANA timezone
};

/**
 * Convert a BirthMomentConfig to a BirthMoment (parse datetime string).
 */
export function parseBirthMomentConfig(config: BirthMomentConfig): BirthMoment {
  return {
    datetime: new Date(config.datetime),
    latitude: config.latitude,
    longitude: config.longitude,
    timezone: config.timezone,
  };
}

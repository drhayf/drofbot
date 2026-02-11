/**
 * Hands Configuration Types
 *
 * Configuration for the Brain/Hands split deployment mode.
 * When `hands.enabled` is true, the Gateway can accept Worker connections
 * and route local-only tool calls to a remote Worker process.
 */

export type HandsConfig = {
  /** Enable Brain/Hands split mode. Default: false (single-machine). */
  enabled?: boolean;

  /**
   * Shared secret for Worker authentication.
   * Can also be set via DROFBOT_WORKER_SECRET env var.
   */
  workerSecret?: string;

  /** Heartbeat interval in seconds. Default: 30. */
  heartbeatInterval?: number;

  /** Default task execution timeout in seconds. Default: 300 (5 min). */
  taskTimeout?: number;

  /**
   * Brain URL for the Worker to connect to (used by the Worker process).
   * E.g. "wss://my-vps:18789" or "ws://localhost:18789"
   * Can also be set via DROFBOT_BRAIN_URL env var.
   */
  brainUrl?: string;
};

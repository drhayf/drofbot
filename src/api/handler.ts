/**
 * Dashboard API — Gateway Integration
 *
 * Creates a request handler compatible with the gateway's handler chain.
 * Intercepts requests starting with `/api/` and delegates to the Express app.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createDashboardApi } from "./server.js";

let _handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

/**
 * Create a dashboard API request handler for the gateway.
 * Returns a function matching the HooksRequestHandler signature:
 * returns true if handled, false to pass through.
 */
export function createDashboardApiHandler(): (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean> {
  if (!_handler) {
    const app = createDashboardApi();
    _handler = app;
  }

  const handler = _handler;

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = req.url ?? "/";

    // Only handle /api/* requests
    if (!url.startsWith("/api/") && url !== "/api") {
      return false;
    }

    // Delegate to Express
    handler(req, res);
    return true;
  };
}

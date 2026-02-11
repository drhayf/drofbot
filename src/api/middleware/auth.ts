/**
 * Dashboard API — Auth Middleware
 *
 * Validates Bearer token in the Authorization header.
 * Single-user system — one token, no sessions, no OAuth.
 */

import type { Request, Response, NextFunction } from "express";
import { getDashboardToken } from "../server.js";

/**
 * Express middleware that validates Bearer token authentication.
 * Returns 401 if token is missing or invalid.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const expectedToken = getDashboardToken();

  if (!expectedToken) {
    res.status(503).json({ error: "Dashboard token not configured" });
    return;
  }

  if (token !== expectedToken) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  next();
}
